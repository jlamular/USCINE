using System.ComponentModel.DataAnnotations;

namespace WatchTogether.API.DTOs;

public class CreateRoomRequestDto
{
    [Required]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Room name must be between 1 and 50 characters.")]
    public string RoomName { get; set; } = string.Empty;
}

public class JoinRoomRequestDto
{
    [Required]
    [StringLength(20)]
    public string RoomCode { get; set; } = string.Empty;
}

public class ParticipantDto
{
    public string UserId { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public bool IsHost { get; set; }

    public DateTime JoinedAt { get; set; }
}

public class RoomSummaryDto
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string RoomName { get; set; } = string.Empty;

    public string HostDisplayName { get; set; } = string.Empty;

    public int ParticipantCount { get; set; }

    public bool IsHost { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class RoomDetailsDto
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string RoomName { get; set; } = string.Empty;

    public string HostUserId { get; set; } = string.Empty;

    public bool IsHost { get; set; }

    public DateTime CreatedAt { get; set; }

    public List<ParticipantDto> Participants { get; set; } = new List<ParticipantDto>();
}