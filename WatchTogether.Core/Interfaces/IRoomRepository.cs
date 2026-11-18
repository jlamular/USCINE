using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Interfaces;

public interface IRoomRepository
{
    Task<WatchRoom?> GetByIdWithParticipantsAsync(Guid roomId);

    Task<WatchRoom?> GetByCodeAsync(string roomCode);

    Task<List<WatchRoom>> GetRoomsForUserAsync(string userId);

    // All rooms marked public, newest first. Whether the host is online is decided in RoomService.
    Task<List<WatchRoom>> GetPublicRoomsAsync();

    Task<bool> RoomCodeExistsAsync(string roomCode);

    Task<bool> IsMemberAsync(Guid roomId, string userId);

    Task AddRoomAsync(WatchRoom room);

    Task AddParticipantAsync(RoomParticipant participant);

    Task RemoveParticipantAsync(RoomParticipant participant);

    Task DeleteRoomAsync(WatchRoom room);

    Task SaveChangesAsync();

    Task<bool> TrySaveChangesAsync();

    void ClearTracking();
}