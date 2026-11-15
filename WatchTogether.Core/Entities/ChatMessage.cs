namespace WatchTogether.Core.Entities;

public class ChatMessage
{
    // A number that only goes up, so "newer than message 42" is a simple comparison
    public long Id { get; set; }

    public Guid RoomId { get; set; }

    public WatchRoom? Room { get; set; }

    public string UserId { get; set; } = string.Empty;

    public ApplicationUser? User { get; set; }

    public string Text { get; set; } = string.Empty;

    public DateTime SentAtUtc { get; set; }
}