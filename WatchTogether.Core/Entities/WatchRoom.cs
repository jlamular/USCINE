namespace WatchTogether.Core.Entities;

public class WatchRoom
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string RoomName { get; set; } = string.Empty;

    public string HostUserId { get; set; } = string.Empty;

    public ApplicationUser? HostUser { get; set; }

    public Guid? CurrentVideoId { get; set; }

    public Video? CurrentVideo { get; set; }

    // The playback anchor (see PlaybackCalculator)
    public bool IsPlaying { get; set; }

    public double PlaybackPositionSeconds { get; set; }

    public DateTime PlaybackUpdatedAtUtc { get; set; }

    public long PlaybackVersion { get; set; }

    public DateTime CreatedAtUtc { get; set; }

    public List<RoomParticipant> Participants { get; set; } = new List<RoomParticipant>();

    public List<Video> Videos { get; set; } = new List<Video>();

    public void SetPlayback(bool isPlaying, double positionSeconds, DateTime nowUtc)
    {
        IsPlaying = isPlaying;
        PlaybackPositionSeconds = positionSeconds;
        PlaybackUpdatedAtUtc = nowUtc;
        PlaybackVersion++;
    }

    // Used when the video changes or disappears: back to the start, paused
    public void ResetPlayback(DateTime nowUtc)
    {
        SetPlayback(false, 0, nowUtc);
    }
}