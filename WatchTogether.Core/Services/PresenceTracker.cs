using WatchTogether.Core.Interfaces;

namespace WatchTogether.Core.Services;

public class PresenceTracker : IPresenceTracker
{
    private class ConnectionInfo
    {
        public string UserId { get; set; } = string.Empty;

        public HashSet<Guid> RoomIds { get; } = new HashSet<Guid>();
    }

    // Many requests run at the same time, so every access to the dictionaries is wrapped in this lock
    private readonly object _lock = new object();

    // roomId -> (userId -> that user's connection ids in the room)
    private readonly Dictionary<Guid, Dictionary<string, HashSet<string>>> _rooms =
        new Dictionary<Guid, Dictionary<string, HashSet<string>>>();

    // connectionId -> who owns it and which rooms it is in
    private readonly Dictionary<string, ConnectionInfo> _connections =
        new Dictionary<string, ConnectionInfo>();

    public bool AddConnection(Guid roomId, string userId, string connectionId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users))
            {
                users = new Dictionary<string, HashSet<string>>();
                _rooms[roomId] = users;
            }

            bool wasOnline = users.ContainsKey(userId);

            if (!users.TryGetValue(userId, out HashSet<string>? userConnections))
            {
                userConnections = new HashSet<string>();
                users[userId] = userConnections;
            }

            userConnections.Add(connectionId);

            if (!_connections.TryGetValue(connectionId, out ConnectionInfo? info))
            {
                info = new ConnectionInfo { UserId = userId };
                _connections[connectionId] = info;
            }

            info.RoomIds.Add(roomId);

            return !wasOnline;
        }
    }

    public bool RemoveConnection(Guid roomId, string userId, string connectionId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users)
                || !users.TryGetValue(userId, out HashSet<string>? userConnections))
            {
                return false;
            }

            bool removed = userConnections.Remove(connectionId);
            ForgetRoomForConnection(connectionId, roomId);

            if (!removed || userConnections.Count > 0)
            {
                return false;
            }

            users.Remove(userId);
            if (users.Count == 0)
            {
                _rooms.Remove(roomId);
            }

            return true;
        }
    }

    public IReadOnlyList<Guid> RemoveConnectionFromAllRooms(string connectionId)
    {
        lock (_lock)
        {
            var roomsWhereUserWentOffline = new List<Guid>();

            if (!_connections.TryGetValue(connectionId, out ConnectionInfo? info))
            {
                return roomsWhereUserWentOffline;
            }

            _connections.Remove(connectionId);

            foreach (Guid roomId in info.RoomIds)
            {
                if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users)
                    || !users.TryGetValue(info.UserId, out HashSet<string>? userConnections))
                {
                    continue;
                }

                userConnections.Remove(connectionId);

                if (userConnections.Count == 0)
                {
                    users.Remove(info.UserId);
                    roomsWhereUserWentOffline.Add(roomId);

                    if (users.Count == 0)
                    {
                        _rooms.Remove(roomId);
                    }
                }
            }

            return roomsWhereUserWentOffline;
        }
    }

    public IReadOnlyCollection<string> GetOnlineUserIds(Guid roomId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users))
            {
                return new List<string>();
            }

            return users.Keys.ToList();
        }
    }

    public IReadOnlyList<string> RemoveUserFromRoom(Guid roomId, string userId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users)
                || !users.TryGetValue(userId, out HashSet<string>? userConnections))
            {
                return new List<string>();
            }

            List<string> removedConnectionIds = userConnections.ToList();

            foreach (string connectionId in removedConnectionIds)
            {
                ForgetRoomForConnection(connectionId, roomId);
            }

            users.Remove(userId);
            if (users.Count == 0)
            {
                _rooms.Remove(roomId);
            }

            return removedConnectionIds;
        }
    }

    public IReadOnlyList<string> RemoveRoom(Guid roomId)
    {
        lock (_lock)
        {
            if (!_rooms.TryGetValue(roomId, out Dictionary<string, HashSet<string>>? users))
            {
                return new List<string>();
            }

            List<string> removedConnectionIds = users.Values.SelectMany(connections => connections).ToList();

            foreach (string connectionId in removedConnectionIds)
            {
                ForgetRoomForConnection(connectionId, roomId);
            }

            _rooms.Remove(roomId);

            return removedConnectionIds;
        }
    }

    // Must be called while holding the lock
    private void ForgetRoomForConnection(string connectionId, Guid roomId)
    {
        if (_connections.TryGetValue(connectionId, out ConnectionInfo? info))
        {
            info.RoomIds.Remove(roomId);

            if (info.RoomIds.Count == 0)
            {
                _connections.Remove(connectionId);
            }
        }
    }
}