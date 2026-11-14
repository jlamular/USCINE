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

    public DateTime CreatedAtUtc { get; set; }

    public List<RoomParticipant> Participants { get; set; } = new List<RoomParticipant>();

    public List<Video> Videos { get; set; } = new List<Video>();
}