using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Interfaces;

public interface IVideoRepository
{
    Task<Video?> GetByIdAsync(Guid videoId);

    Task<List<Video>> GetByRoomAsync(Guid roomId);

    Task<List<string>> GetStoredFileNamesForRoomAsync(Guid roomId);

    Task AddAsync(Video video);

    Task DeleteAsync(Video video);
}