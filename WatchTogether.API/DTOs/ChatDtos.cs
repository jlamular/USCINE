namespace WatchTogether.API.DTOs;

public class ChatMessageDto
{
    public long Id { get; set; }

    public Guid RoomId { get; set; }

    public string UserId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;

    public DateTime SentAt { get; set; }
}