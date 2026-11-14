using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IPlaybackService
{
    Task<ServiceResult<PlaybackState>> GetPlaybackAsync(string userId, Guid roomId);

    Task<ServiceResult<PlaybackCommandResult>> PlayAsync(string userId, Guid roomId, double positionSeconds);

    Task<ServiceResult<PlaybackCommandResult>> PauseAsync(string userId, Guid roomId, double positionSeconds);

    Task<ServiceResult<PlaybackCommandResult>> SeekAsync(string userId, Guid roomId, double positionSeconds);

    // A system action (no user): if the video was playing, stop it at the position it has reached
    Task PauseWhenRoomEmptyAsync(Guid roomId);
}