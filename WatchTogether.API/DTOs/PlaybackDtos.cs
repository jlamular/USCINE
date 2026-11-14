namespace WatchTogether.API.DTOs;

public class PlaybackStateDto
{
    public Guid RoomId { get; set; }

    public Guid? VideoId { get; set; }

    public bool IsPlaying { get; set; }

    public double PositionSeconds { get; set; }

    // Times are plain numbers (milliseconds since 1970). That avoids every time zone and date-parsing problem.
    public long UpdatedAtUnixMs { get; set; }

    public long ServerTimeUnixMs { get; set; }

    public long Version { get; set; }
}