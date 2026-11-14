using Microsoft.AspNetCore.SignalR;
using WatchTogether.API.DTOs;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Hubs;

public class RoomNotifier : IRoomNotifier
{
    private readonly IHubContext<WatchRoomHub> _hubContext;
    private readonly IRoomRepository _roomRepository;
    private readonly IPresenceTracker _presenceTracker;
    private readonly IPlaybackService _playbackService;

    public RoomNotifier(
        IHubContext<WatchRoomHub> hubContext,
        IRoomRepository roomRepository,
        IPresenceTracker presenceTracker,
        IPlaybackService playbackService)
    {
        _hubContext = hubContext;
        _roomRepository = roomRepository;
        _presenceTracker = presenceTracker;
        _playbackService = playbackService;
    }

    public async Task NotifyRoomStateChangedAsync(Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);
        if (room == null)
        {
            return;
        }

        IReadOnlyCollection<string> onlineUserIds = _presenceTracker.GetOnlineUserIds(roomId);
        RoomStateDto state = RoomMapper.ToRoomState(room, onlineUserIds);

        await _hubContext.Clients
            .Group(WatchRoomHub.GroupName(roomId))
            .SendAsync(HubEvents.RoomStateUpdated, state);

        // Nobody is watching any more: stop the clock, so a movie does not "play" for hours in an empty room
        if (onlineUserIds.Count == 0)
        {
            await _playbackService.PauseWhenRoomEmptyAsync(roomId);
        }
    }

    public async Task NotifyPlaybackChangedAsync(Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);
        if (room == null)
        {
            return;
        }

        await BroadcastPlaybackAsync(PlaybackState.FromRoom(room));
    }

    public async Task BroadcastPlaybackAsync(PlaybackState state)
    {
        await _hubContext.Clients
            .Group(WatchRoomHub.GroupName(state.RoomId))
            .SendAsync(HubEvents.PlaybackUpdated, RoomMapper.ToPlaybackDto(state));
    }

    public async Task UserLeftRoomAsync(Guid roomId, string userId)
    {
        // The user is no longer a member, so none of their connections may keep receiving this room's events
        IReadOnlyList<string> connectionIds = _presenceTracker.RemoveUserFromRoom(roomId, userId);

        foreach (string connectionId in connectionIds)
        {
            await _hubContext.Groups.RemoveFromGroupAsync(connectionId, WatchRoomHub.GroupName(roomId));
        }

        await NotifyRoomStateChangedAsync(roomId);
    }

    public async Task RoomDeletedAsync(Guid roomId)
    {
        string groupName = WatchRoomHub.GroupName(roomId);

        await _hubContext.Clients.Group(groupName).SendAsync(HubEvents.RoomClosed, roomId);

        IReadOnlyList<string> connectionIds = _presenceTracker.RemoveRoom(roomId);

        foreach (string connectionId in connectionIds)
        {
            await _hubContext.Groups.RemoveFromGroupAsync(connectionId, groupName);
        }
    }
}