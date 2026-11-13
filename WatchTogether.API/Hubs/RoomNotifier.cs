using Microsoft.AspNetCore.SignalR;
using WatchTogether.API.DTOs;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;

namespace WatchTogether.API.Hubs;

public class RoomNotifier : IRoomNotifier
{
    private readonly IHubContext<WatchRoomHub> _hubContext;
    private readonly IRoomRepository _roomRepository;
    private readonly IPresenceTracker _presenceTracker;

    public RoomNotifier(
        IHubContext<WatchRoomHub> hubContext,
        IRoomRepository roomRepository,
        IPresenceTracker presenceTracker)
    {
        _hubContext = hubContext;
        _roomRepository = roomRepository;
        _presenceTracker = presenceTracker;
    }

    public async Task NotifyRoomStateChangedAsync(Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);
        if (room == null)
        {
            return;
        }

        RoomStateDto state = RoomMapper.ToRoomState(room, _presenceTracker.GetOnlineUserIds(roomId));

        await _hubContext.Clients
            .Group(WatchRoomHub.GroupName(roomId))
            .SendAsync("RoomStateUpdated", state);
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

        await _hubContext.Clients.Group(groupName).SendAsync("RoomClosed", roomId);

        IReadOnlyList<string> connectionIds = _presenceTracker.RemoveRoom(roomId);

        foreach (string connectionId in connectionIds)
        {
            await _hubContext.Groups.RemoveFromGroupAsync(connectionId, groupName);
        }
    }
}