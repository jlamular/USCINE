namespace WatchTogether.Core.Models;

public class StreamTokenClaims
{
    public string UserId { get; set; } = string.Empty;

    public Guid VideoId { get; set; }
}