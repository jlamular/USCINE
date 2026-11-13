namespace WatchTogether.API.Hubs;

// Lets normal controllers (REST) push real-time messages to people who have a room open
public interface IRoomNotifier
{
    Task NotifyRoomStateChangedAsync(Guid roomId);

    Task UserLeftRoomAsync(Guid roomId, string userId);

    Task RoomDeletedAsync(Guid roomId);
}