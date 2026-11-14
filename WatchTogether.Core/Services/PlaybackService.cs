using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Services;

public class PlaybackService : IPlaybackService
{
    private const int MaxAttempts = 3;

    // A command that would move the playback by less than this counts as "nothing changed"
    private const double NoChangeToleranceSeconds = 0.25;

    private readonly IRoomRepository _roomRepository;

    public PlaybackService(IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<ServiceResult<PlaybackState>> GetPlaybackAsync(string userId, Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult<PlaybackState>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        return ServiceResult<PlaybackState>.Success(PlaybackState.FromRoom(room));
    }

    public Task<ServiceResult<PlaybackCommandResult>> PlayAsync(string userId, Guid roomId, double positionSeconds)
    {
        return ApplyCommandAsync(userId, roomId, true, positionSeconds);
    }

    public Task<ServiceResult<PlaybackCommandResult>> PauseAsync(string userId, Guid roomId, double positionSeconds)
    {
        return ApplyCommandAsync(userId, roomId, false, positionSeconds);
    }

    // A seek keeps the current play/pause state, so the target is "null" (no change)
    public Task<ServiceResult<PlaybackCommandResult>> SeekAsync(string userId, Guid roomId, double positionSeconds)
    {
        return ApplyCommandAsync(userId, roomId, null, positionSeconds);
    }

    public async Task PauseWhenRoomEmptyAsync(Guid roomId)
    {
        for (int attempt = 0; attempt < MaxAttempts; attempt++)
        {
            WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

            if (room == null || !room.IsPlaying)
            {
                return;
            }

            DateTime now = DateTime.UtcNow;

            double position = PlaybackCalculator.GetExpectedPosition(
                room.IsPlaying,
                room.PlaybackPositionSeconds,
                room.PlaybackUpdatedAtUtc,
                now,
                room.CurrentVideo?.DurationSeconds);

            room.SetPlayback(false, position, now);

            if (await _roomRepository.TrySaveChangesAsync())
            {
                return;
            }

            _roomRepository.ClearTracking();
        }
    }

    private async Task<ServiceResult<PlaybackCommandResult>> ApplyCommandAsync(
        string userId,
        Guid roomId,
        bool? isPlaying,
        double requestedPositionSeconds)
    {
        if (double.IsNaN(requestedPositionSeconds)
            || double.IsInfinity(requestedPositionSeconds)
            || requestedPositionSeconds < 0)
        {
            return ServiceResult<PlaybackCommandResult>.Failure(
                ServiceErrorType.Validation,
                "The position must be a number that is zero or greater.");
        }

        for (int attempt = 0; attempt < MaxAttempts; attempt++)
        {
            // Always start from fresh data. After a collision the old copy is out of date.
            WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

            if (room == null || !IsMember(room, userId))
            {
                return ServiceResult<PlaybackCommandResult>.Failure(ServiceErrorType.NotFound, "Room not found.");
            }

            // The rule from the spec, checked on the server every single time
            if (room.HostUserId != userId)
            {
                return ServiceResult<PlaybackCommandResult>.Failure(
                    ServiceErrorType.Forbidden,
                    "Only the host can control playback.");
            }

            if (room.CurrentVideo == null)
            {
                return ServiceResult<PlaybackCommandResult>.Failure(
                    ServiceErrorType.Validation,
                    "Choose a video first.");
            }

            DateTime now = DateTime.UtcNow;
            double duration = room.CurrentVideo.DurationSeconds;

            double newPosition = Math.Min(requestedPositionSeconds, duration);
            bool newIsPlaying = isPlaying ?? room.IsPlaying;

            double expectedPositionNow = PlaybackCalculator.GetExpectedPosition(
                room.IsPlaying,
                room.PlaybackPositionSeconds,
                room.PlaybackUpdatedAtUtc,
                now,
                duration);

            bool nothingChanges = newIsPlaying == room.IsPlaying
                && Math.Abs(newPosition - expectedPositionNow) < NoChangeToleranceSeconds;

            if (nothingChanges)
            {
                return ServiceResult<PlaybackCommandResult>.Success(new PlaybackCommandResult
                {
                    State = PlaybackState.FromRoom(room),
                    Changed = false
                });
            }

            room.SetPlayback(newIsPlaying, newPosition, now);

            if (await _roomRepository.TrySaveChangesAsync())
            {
                return ServiceResult<PlaybackCommandResult>.Success(new PlaybackCommandResult
                {
                    State = PlaybackState.FromRoom(room),
                    Changed = true
                });
            }

            // Someone changed the playback at the very same moment (for example a second host tab).
            // Throw away our stale copy and try again.
            _roomRepository.ClearTracking();
        }

        return ServiceResult<PlaybackCommandResult>.Failure(
            ServiceErrorType.Validation,
            "Playback is busy. Please try again.");
    }

    private static bool IsMember(WatchRoom room, string userId)
    {
        return room.Participants.Any(member => member.UserId == userId);
    }
}