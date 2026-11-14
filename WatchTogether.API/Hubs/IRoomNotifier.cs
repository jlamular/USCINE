using WatchTogether.Core.Models;

namespace WatchTogether.API.Hubs;

// Lets normal controllers (REST) push real-time messages to people who have a room open
public interface IRoomNotifier
{
    Task NotifyRoomStateChangedAsync(Guid roomId);

    // Reads the room's current playback anchor and sends it to everyone in the room
    Task NotifyPlaybackChangedAsync(Guid roomId);

    Task BroadcastPlaybackAsync(PlaybackState state);

    Task UserLeftRoomAsync(Guid roomId, string userId);

    Task RoomDeletedAsync(Guid roomId);
}