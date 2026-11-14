using Microsoft.EntityFrameworkCore;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Infrastructure.Data;

namespace WatchTogether.Infrastructure.Repositories;

public class RoomRepository : IRoomRepository
{
    private readonly AppDbContext _dbContext;

    public RoomRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<WatchRoom?> GetByIdWithParticipantsAsync(Guid roomId)
    {
        return await _dbContext.WatchRooms
            .Include(room => room.HostUser)
            .Include(room => room.CurrentVideo)
                .ThenInclude(video => video!.UploadedByUser)
            .Include(room => room.Participants)
                .ThenInclude(participant => participant.User)
            .FirstOrDefaultAsync(room => room.Id == roomId);
    }

    public async Task<WatchRoom?> GetByCodeAsync(string roomCode)
    {
        return await _dbContext.WatchRooms
            .FirstOrDefaultAsync(room => room.RoomCode == roomCode);
    }

    public async Task<List<WatchRoom>> GetRoomsForUserAsync(string userId)
    {
        return await _dbContext.WatchRooms
            .AsNoTracking()
            .Where(room => room.Participants.Any(participant => participant.UserId == userId))
            .Include(room => room.HostUser)
            .Include(room => room.Participants)
            .OrderByDescending(room => room.CreatedAtUtc)
            .ToListAsync();
    }

    public async Task<bool> RoomCodeExistsAsync(string roomCode)
    {
        return await _dbContext.WatchRooms.AnyAsync(room => room.RoomCode == roomCode);
    }

    public async Task<bool> IsMemberAsync(Guid roomId, string userId)
    {
        return await _dbContext.RoomParticipants
            .AnyAsync(participant => participant.RoomId == roomId && participant.UserId == userId);
    }

    public async Task AddRoomAsync(WatchRoom room)
    {
        _dbContext.WatchRooms.Add(room);
        await _dbContext.SaveChangesAsync();
    }

    public async Task AddParticipantAsync(RoomParticipant participant)
    {
        _dbContext.RoomParticipants.Add(participant);
        await _dbContext.SaveChangesAsync();
    }

    public async Task RemoveParticipantAsync(RoomParticipant participant)
    {
        _dbContext.RoomParticipants.Remove(participant);
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteRoomAsync(WatchRoom room)
    {
        _dbContext.WatchRooms.Remove(room);
        await _dbContext.SaveChangesAsync();
    }

    // Saves changes made to rooms that were loaded earlier in this same request
    public async Task SaveChangesAsync()
    {
        await _dbContext.SaveChangesAsync();
    }
}