using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Interfaces;

public interface IRoomRepository
{
    Task<WatchRoom?> GetByIdWithParticipantsAsync(Guid roomId);

    Task<WatchRoom?> GetByCodeAsync(string roomCode);

    Task<List<WatchRoom>> GetRoomsForUserAsync(string userId);

    Task<bool> RoomCodeExistsAsync(string roomCode);

    Task<bool> IsMemberAsync(Guid roomId, string userId);

    Task AddRoomAsync(WatchRoom room);

    Task AddParticipantAsync(RoomParticipant participant);

    Task RemoveParticipantAsync(RoomParticipant participant);

    Task DeleteRoomAsync(WatchRoom room);

    Task SaveChangesAsync();
}
