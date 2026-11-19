using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IRoomService
{
    Task<ServiceResult<WatchRoom>> CreateRoomAsync(string userId, string roomName, bool isPublic);

    Task<ServiceResult<WatchRoom>> JoinRoomAsync(string userId, string roomCode);

    // Joins a public room by its id. A room that is not public answers "not found", exactly like a missing room.
    Task<ServiceResult<WatchRoom>> JoinPublicRoomAsync(string userId, Guid roomId);

    Task<List<WatchRoom>> GetMyRoomsAsync(string userId);

    // Public rooms whose host currently has the room open
    Task<List<WatchRoom>> GetPublicRoomsAsync();
        // Public rooms whose host does NOT currently have the room open (used by the grace-period sweeper)
    Task<List<WatchRoom>> GetPublicRoomsWithOfflineHostAsync();

    Task<ServiceResult<WatchRoom>> GetRoomAsync(string userId, Guid roomId);

    Task<ServiceResult> LeaveRoomAsync(string userId, Guid roomId);

    Task<ServiceResult> DeleteRoomAsync(string userId, Guid roomId);

    Task<ServiceResult<WatchRoom>> SelectCurrentVideoAsync(string userId, Guid roomId, Guid? videoId);
}