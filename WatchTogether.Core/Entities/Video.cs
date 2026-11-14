namespace WatchTogether.Core.Entities;

public class Video
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public WatchRoom? Room { get; set; }

    public string UploadedByUserId { get; set; } = string.Empty;

    public ApplicationUser? UploadedByUser { get; set; }

    // The name the uploader's file had. Display text only, never used to build a path.
    public string OriginalFileName { get; set; } = string.Empty;

    // The server-generated name of the file on disk
    public string StoredFileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long FileSizeBytes { get; set; }

    public double DurationSeconds { get; set; }

    public DateTime UploadedAtUtc { get; set; }
}