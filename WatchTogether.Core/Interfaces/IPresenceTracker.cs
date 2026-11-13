namespace WatchTogether.Core.Interfaces;

// Keeps track of who currently has a room open. This is live state kept in memory, not in the database.
public interface IPresenceTracker
{
    // Returns true if this connection made the user newly online in the room
    bool AddConnection(Guid roomId, string userId, string connectionId);

    // Returns true if the user has no connections left in the room (they just went offline)
    bool RemoveConnection(Guid roomId, string userId, string connectionId);

    // Used when a connection drops. Returns the rooms in which the user just went offline.
    IReadOnlyList<Guid> RemoveConnectionFromAllRooms(string connectionId);

    IReadOnlyCollection<string> GetOnlineUserIds(Guid roomId);

    // Used when a user leaves a room permanently. Returns the connections that were removed.
    IReadOnlyList<string> RemoveUserFromRoom(Guid roomId, string userId);

    // Used when a room is deleted. Returns all connections that were in it.
    IReadOnlyList<string> RemoveRoom(Guid roomId);
}