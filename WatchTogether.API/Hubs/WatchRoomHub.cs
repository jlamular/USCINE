using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using WatchTogether.API.Extensions;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Hubs;

[Authorize]
public class WatchRoomHub : Hub
{
    private readonly IRoomService _roomService;
    private readonly IPresenceTracker _presenceTracker;
    private readonly IRoomNotifier _roomNotifier;

    public WatchRoomHub(
        IRoomService roomService,
        IPresenceTracker presenceTracker,
        IRoomNotifier roomNotifier)
    {
        _roomService = roomService;
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

    private string GetCurrentUserId()
    {
        return Context.User?.GetUserId()
            ?? throw new HubException("You must be logged in.");
    }
}