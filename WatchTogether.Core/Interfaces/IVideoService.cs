using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IVideoService
{
    Task<ServiceResult<Video>> UploadVideoAsync(
        string userId,
        Guid roomId,
        string originalFileName,
        long fileSizeBytes,
        Stream content,
        CancellationToken cancellationToken);

    Task<ServiceResult<List<Video>>> GetRoomVideosAsync(string userId, Guid roomId);

    Task<ServiceResult<Video>> GetVideoAsync(string userId, Guid videoId);

    Task<ServiceResult<VideoStreamInfo>> OpenVideoStreamAsync(string userId, Guid videoId);

    Task<ServiceResult<Video>> DeleteVideoAsync(string userId, Guid videoId);
}