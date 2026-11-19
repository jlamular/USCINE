using WatchTogether.API.Hubs;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.BackgroundServices;

// Runs for the whole life of the application. Every few seconds it looks for public rooms
// whose host is gone, and closes the ones that have been without a host for too long.
public class PublicRoomGraceService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPresenceTracker _presenceTracker;
    private readonly PublicRoomOptions _options;
    private readonly ILogger<PublicRoomGraceService> _logger;

    // roomId -> the moment we first noticed that the host was gone.
    // Only this one background loop touches it, so it needs no lock.
    private readonly Dictionary<Guid, DateTime> _hostOfflineSince = new Dictionary<Guid, DateTime>();

    public PublicRoomGraceService(
        IServiceScopeFactory scopeFactory,
        IPresenceTracker presenceTracker,
        PublicRoomOptions options,
        ILogger<PublicRoomGraceService> logger)
    {
        _scopeFactory = scopeFactory;
        _presenceTracker = presenceTracker;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        TimeSpan interval = TimeSpan.FromSeconds(Math.Max(1, _options.SweepIntervalSeconds));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SweepAsync();
            }
            catch (Exception exception)
            {
                // One bad sweep (for example a database hiccup) must never stop the service for good
                _logger.LogError(exception, "The public room sweep failed. It will try again.");
            }

            try
            {
                await Task.Delay(interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task SweepAsync()
    {
        // The services we need are "scoped" (one per request), so a background service creates its own scope
        using IServiceScope scope = _scopeFactory.CreateScope();
        IRoomService roomService = scope.ServiceProvider.GetRequiredService<IRoomService>();
        IRoomNotifier roomNotifier = scope.ServiceProvider.GetRequiredService<IRoomNotifier>();

        List<WatchRoom> roomsWithoutHost = await roomService.GetPublicRoomsWithOfflineHostAsync();
        DateTime now = DateTime.UtcNow;

        // Forget rooms whose host came back, and rooms that no longer exist
        HashSet<Guid> stillWithoutHost = roomsWithoutHost.Select(room => room.Id).ToHashSet();
        List<Guid> toForget = _hostOfflineSince.Keys
            .Where(roomId => !stillWithoutHost.Contains(roomId))
            .ToList();

        foreach (Guid roomId in toForget)
        {
            _hostOfflineSince.Remove(roomId);
        }

        foreach (WatchRoom room in roomsWithoutHost)
        {
            // First time we see this room without its host: the grace period starts now
            if (!_hostOfflineSince.TryGetValue(room.Id, out DateTime offlineSince))
            {
                _hostOfflineSince[room.Id] = now;
                continue;
            }

            if ((now - offlineSince).TotalSeconds < _options.HostGraceSeconds)
            {
                continue;
            }

            await CloseRoomAsync(roomService, roomNotifier, room);
        }
    }

    private async Task CloseRoomAsync(IRoomService roomService, IRoomNotifier roomNotifier, WatchRoom room)
    {
        // Last-second check: the host may have just reconnected
        if (_presenceTracker.GetOnlineUserIds(room.Id).Contains(room.HostUserId))
        {
            _hostOfflineSince.Remove(room.Id);
            return;
        }

        try
        {
            // The same code path as the host pressing "Delete room": it also removes the video files
            ServiceResult result = await roomService.DeleteRoomAsync(room.HostUserId, room.Id);

            if (!result.Succeeded)
            {
                _logger.LogWarning("Could not close public room {RoomId}: {Error}", room.Id, result.Errors[0]);
                return;
            }

            // Everyone still in the room gets "RoomClosed" and is sent back to the dashboard
            await roomNotifier.RoomDeletedAsync(room.Id);
            _hostOfflineSince.Remove(room.Id);

            _logger.LogInformation("Closed public room {RoomId} after the host was away too long.", room.Id);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Failed to close public room {RoomId}.", room.Id);
        }
    }
}