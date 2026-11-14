namespace WatchTogether.Core.Models;

public class VideoStreamInfo
{
    public Stream Stream { get; set; } = Stream.Null;

    public string ContentType { get; set; } = string.Empty;
}