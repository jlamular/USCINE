using WatchTogether.Core.Enums;

namespace WatchTogether.Core.Entities;

public class RoomParticipant
{
    public Guid Id { get; set; }

    public Guid RoomId { get; set; }

    public WatchRoom? Room { get; set; }

    public string UserId { get; set; } = string.Empty;

    public ApplicationUser? User { get; set; }

    public RoomRole Role { get; set; }

    public DateTime JoinedAtUtc { get; set; }
}