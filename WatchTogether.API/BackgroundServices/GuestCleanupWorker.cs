using WatchTogether.API.Hubs;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.BackgroundServices;

// Deletes guest accounts (and everything that blocks their deletion) once they are old enough
public class GuestCleanupWorker : BackgroundService
{
    // A big backlog is worked off over several sweeps instead of one long one
    private const int MaxGuestsPerSweep = 50;

    // Safety floor, so a typo in the settings can never wipe guests who just arrived
    private const double MinimumLifetimeMinutes = 0.1;

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly GuestCleanupOptions _options;
    private readonly ILogger<GuestCleanupWorker> _logger;

    public GuestCleanupWorker(
        IServiceScopeFactory scopeFactory,
        GuestCleanupOptions options,
        ILogger<GuestCleanupWorker> logger)
    {
        _scopeFactory = scopeFactory;
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
                await SweepAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception exception)
            {
                _logger.LogError(exception, "The guest cleanup sweep failed. It will try again.");
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

    private async Task SweepAsync(CancellationToken stoppingToken)
    {
        double lifetimeMinutes = Math.Max(MinimumLifetimeMinutes, _options.GuestLifetimeMinutes);
        DateTime cutoffUtc = DateTime.UtcNow.AddMinutes(-lifetimeMinutes);

        List<string> expiredGuestIds;

        using (IServiceScope scope = _scopeFactory.CreateScope())
        {
            var cleanupService = scope.ServiceProvider.GetRequiredService<IGuestCleanupService>();
            expiredGuestIds = await cleanupService.GetExpiredGuestIdsAsync(cutoffUtc, MaxGuestsPerSweep);
        }

        if (expiredGuestIds.Count == 0)
        {
            return;
        }

        int removed = 0;

        foreach (string guestId in expiredGuestIds)
        {
            stoppingToken.ThrowIfCancellationRequested();

            try
            {
                if (await RemoveGuestAsync(guestId))
                {
                    removed++;
                }
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // This guest stays in the database and is tried again on the next sweep
                _logger.LogError(exception, "Could not remove expired guest {GuestId}.", guestId);
            }
        }

        _logger.LogInformation("Guest cleanup: removed {Removed} of {Found} expired guests.", removed, expiredGuestIds.Count);
    }

    // Returns true when the guest account is gone
    private async Task<bool> RemoveGuestAsync(string guestId)
    {
        // One scope (and so one DbContext) per guest keeps every guest independent of the others
        using IServiceScope scope = _scopeFactory.CreateScope();
        var roomService = scope.ServiceProvider.GetRequiredService<IRoomService>();
        var roomNotifier = scope.ServiceProvider.GetRequiredService<IRoomNotifier>();
        var cleanupService = scope.ServiceProvider.GetRequiredService<IGuestCleanupService>();

        List<WatchRoom> rooms = await roomService.GetMyRoomsAsync(guestId);

        foreach (WatchRoom room in rooms)
        {
            if (room.HostUserId == guestId)
            {
                // Their own room: same code path as "Delete room" (database rows and video files)
                ServiceResult deleteResult = await roomService.DeleteRoomAsync(guestId, room.Id);

                if (!IsDoneOrAlreadyGone(deleteResult))
                {
                    _logger.LogWarning("Could not delete guest room {RoomId}: {Error}", room.Id, deleteResult.Errors[0]);
                    return false;
                }

                await roomNotifier.RoomDeletedAsync(room.Id);
            }
            else
            {
                // Someone else's room: the guest just leaves it
                ServiceResult leaveResult = await roomService.LeaveRoomAsync(guestId, room.Id);

                if (!IsDoneOrAlreadyGone(leaveResult))
                {
                    _logger.LogWarning("Guest could not leave room {RoomId}: {Error}", room.Id, leaveResult.Errors[0]);
                    return false;
                }

                await roomNotifier.UserLeftRoomAsync(room.Id, guestId);
            }
        }

        ServiceResult accountResult = await cleanupService.DeleteGuestAccountAsync(guestId);

        if (!accountResult.Succeeded)
        {
            _logger.LogWarning("Could not delete guest account {GuestId}: {Error}", guestId, accountResult.Errors[0]);
            return false;
        }

        return true;
    }

    // "Not found" means somebody else (for example the public room sweeper) already did the job
    private static bool IsDoneOrAlreadyGone(ServiceResult result)
    {
        return result.Succeeded || result.ErrorType == ServiceErrorType.NotFound;
    }
}