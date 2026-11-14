using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IRoomService
{
    Task<ServiceResult<WatchRoom>> CreateRoomAsync(string userId, string roomName);

    Task<ServiceResult<WatchRoom>> JoinRoomAsync(string userId, string roomCode);

    Task<List<WatchRoom>> GetMyRoomsAsync(string userId);

    Task<ServiceResult<WatchRoom>> GetRoomAsync(string userId, Guid roomId);

    Task<ServiceResult> LeaveRoomAsync(string userId, Guid roomId);

    Task<ServiceResult> DeleteRoomAsync(string userId, Guid roomId);

    Task<ServiceResult<WatchRoom>> SelectCurrentVideoAsync(string userId, Guid roomId, Guid? videoId);
}