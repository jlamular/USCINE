using System.ComponentModel.DataAnnotations;

namespace WatchTogether.API.DTOs;

public class CreateRoomRequestDto
{
    [Required]
    [StringLength(50, MinimumLength = 1, ErrorMessage = "Room name must be between 1 and 50 characters.")]
    public string RoomName { get; set; } = string.Empty;

    public bool IsPublic { get; set; }
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

    public bool IsOnline { get; set; }

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
    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; }
}

public class RoomDetailsDto
{
    public Guid Id { get; set; }

    public string RoomCode { get; set; } = string.Empty;

    public string RoomName { get; set; } = string.Empty;

    public string HostUserId { get; set; } = string.Empty;

    public bool IsHost { get; set; }
    public bool IsPublic { get; set; }

    public DateTime CreatedAt { get; set; }
    public VideoDto? CurrentVideo { get; set; }
    public List<ParticipantDto> Participants { get; set; } = new List<ParticipantDto>();
    
}

// Sent to everyone in a room over SignalR. It has nothing specific to one viewer,
// because the same message goes to every connection in the group.
public class RoomStateDto
{
    public Guid RoomId { get; set; }
    public VideoDto? CurrentVideo { get; set; }

    public List<ParticipantDto> Participants { get; set; } = new List<ParticipantDto>();
    
}

// What a visitor sees in the "Join Public Room" list. There is deliberately no room code here.
public class PublicRoomDto
{
    public Guid Id { get; set; }

    public string RoomName { get; set; } = string.Empty;

    public string HostDisplayName { get; set; } = string.Empty;

    public int ParticipantCount { get; set; }

    public int OnlineCount { get; set; }

    // true when the current user already belongs to this room
    public bool IsMember { get; set; }

    public DateTime CreatedAt { get; set; }
}