using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WatchTogether.API.DTOs;
using WatchTogether.API.Extensions;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Hubs;

[Authorize]
public class WatchRoomHub : Hub
{
    private readonly IRoomService _roomService;
    private readonly IPlaybackService _playbackService;
    private readonly IPresenceTracker _presenceTracker;
    private readonly IRoomNotifier _roomNotifier;

    public WatchRoomHub(
        IRoomService roomService,
        IPlaybackService playbackService,
        IPresenceTracker presenceTracker,
        IRoomNotifier roomNotifier)
    {
        _roomService = roomService;
        _playbackService = playbackService;
        _presenceTracker = presenceTracker;
        _roomNotifier = roomNotifier;
    }

    public static string GroupName(Guid roomId)
    {
        return $"room:{roomId}";
    }

    public async Task JoinRoom(Guid roomId)
    {
        string userId = GetCurrentUserId();

        // Having a valid login is not enough: the database must say this user is a member of this room
        ServiceResult<WatchRoom> result = await _roomService.GetRoomAsync(userId, roomId);
        if (!result.Succeeded)
        {
            throw new HubException("Room not found.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(roomId));
        _presenceTracker.AddConnection(roomId, userId, Context.ConnectionId);

        // Everyone in the group, including the caller, receives the fresh participant list
        await _roomNotifier.NotifyRoomStateChangedAsync(roomId);

        // Only the person who just joined (or reconnected) needs the playback state.
        // We read it AFTER joining the group, so a broadcast cannot slip through the gap.
        ServiceResult<PlaybackState> playback = await _playbackService.GetPlaybackAsync(userId, roomId);
        if (playback.Succeeded)
        {
            await Clients.Caller.SendAsync(HubEvents.PlaybackUpdated, RoomMapper.ToPlaybackDto(playback.Value!));
        }
    }

    public async Task LeaveRoom(Guid roomId)
    {
        string userId = GetCurrentUserId();

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(roomId));

        bool wentOffline = _presenceTracker.RemoveConnection(roomId, userId, Context.ConnectionId);
        if (wentOffline)
        {
            await _roomNotifier.NotifyRoomStateChangedAsync(roomId);
        }
    }

    // The three host commands. Each returns the new state to the caller, so the host learns the new version
    // right away. Everyone else (and the host's other tabs) hear about it through the PlaybackUpdated broadcast.
    public Task<PlaybackStateDto> PlayVideo(Guid roomId, double positionSeconds)
    {
        return RunPlaybackCommandAsync(userId => _playbackService.PlayAsync(userId, roomId, positionSeconds));
    }

    public Task<PlaybackStateDto> PauseVideo(Guid roomId, double positionSeconds)
    {
        return RunPlaybackCommandAsync(userId => _playbackService.PauseAsync(userId, roomId, positionSeconds));
    }

    public Task<PlaybackStateDto> SeekVideo(Guid roomId, double positionSeconds)
    {
        return RunPlaybackCommandAsync(userId => _playbackService.SeekAsync(userId, roomId, positionSeconds));
    }

    // Lets a browser measure how far its clock is from the server's
    public long GetServerTime()
    {
        return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // SignalR already removes the connection from its groups. We only update our own presence records.
        IReadOnlyList<Guid> roomsWhereUserWentOffline =
            _presenceTracker.RemoveConnectionFromAllRooms(Context.ConnectionId);

        foreach (Guid roomId in roomsWhereUserWentOffline)
        {
            await _roomNotifier.NotifyRoomStateChangedAsync(roomId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    private async Task<PlaybackStateDto> RunPlaybackCommandAsync(
        Func<string, Task<ServiceResult<PlaybackCommandResult>>> command)
    {
        ServiceResult<PlaybackCommandResult> result = await command(GetCurrentUserId());

        if (!result.Succeeded)
        {
            throw new HubException(result.Errors[0]);
        }

        PlaybackCommandResult outcome = result.Value!;

        // A command that changed nothing is not worth a broadcast
        if (outcome.Changed)
        {
            await _roomNotifier.BroadcastPlaybackAsync(outcome.State);
        }

        return RoomMapper.ToPlaybackDto(outcome.State);
    }

    private string GetCurrentUserId()
    {
        return Context.User?.GetUserId()
            ?? throw new HubException("You must be logged in.");
    }
}