using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Models;

// A snapshot of a room's playback "anchor": where the video was, and when the host last acted
public class PlaybackState
{
    public Guid RoomId { get; set; }

    public Guid? VideoId { get; set; }

    public bool IsPlaying { get; set; }

    // The position at the moment UpdatedAtUtc. It is not the position "right now".
    public double PositionSeconds { get; set; }

    public DateTime UpdatedAtUtc { get; set; }

    // Increases with every change. Clients ignore anything that is not newer than what they already applied.
    public long Version { get; set; }

    public static PlaybackState FromRoom(WatchRoom room)
    {
        return new PlaybackState
        {
            RoomId = room.Id,
            VideoId = room.CurrentVideoId,
            IsPlaying = room.IsPlaying,
            PositionSeconds = room.PlaybackPositionSeconds,
            UpdatedAtUtc = room.PlaybackUpdatedAtUtc,
            Version = room.PlaybackVersion
        };
    }
}