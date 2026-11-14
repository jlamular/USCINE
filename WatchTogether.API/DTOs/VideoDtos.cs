namespace WatchTogether.API.DTOs;

public class VideoDto
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public string FileName { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }

    public double DurationSeconds { get; set; }

    public string UploadedByDisplayName { get; set; } = string.Empty;

    public DateTime UploadedAt { get; set; }
}

public class SelectVideoRequestDto
{
    // null means "no video"
    public Guid? VideoId { get; set; }
}

public class StreamTokenResponseDto
{
    public string Token { get; set; } = string.Empty;

    public DateTime ExpiresAt { get; set; }
}