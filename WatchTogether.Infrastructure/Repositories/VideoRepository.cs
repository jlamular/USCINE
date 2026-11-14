using Microsoft.EntityFrameworkCore;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Infrastructure.Data;

namespace WatchTogether.Infrastructure.Repositories;

public class VideoRepository : IVideoRepository
{
    private readonly AppDbContext _dbContext;

    public VideoRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<Video?> GetByIdAsync(Guid videoId)
    {
        return await _dbContext.Videos
            .Include(video => video.UploadedByUser)
            .FirstOrDefaultAsync(video => video.Id == videoId);
    }

    public async Task<List<Video>> GetByRoomAsync(Guid roomId)
    {
        return await _dbContext.Videos
            .AsNoTracking()
            .Include(video => video.UploadedByUser)
            .Where(video => video.RoomId == roomId)
            .OrderByDescending(video => video.UploadedAtUtc)
            .ToListAsync();
    }

    public async Task<List<string>> GetStoredFileNamesForRoomAsync(Guid roomId)
    {
        return await _dbContext.Videos
            .Where(video => video.RoomId == roomId)
            .Select(video => video.StoredFileName)
            .ToListAsync();
    }

    public async Task AddAsync(Video video)
    {
        _dbContext.Videos.Add(video);
        await _dbContext.SaveChangesAsync();
    }

    public async Task DeleteAsync(Video video)
    {
        _dbContext.Videos.Remove(video);
        await _dbContext.SaveChangesAsync();
    }
}