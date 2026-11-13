using WatchTogether.API.DTOs;
using WatchTogether.Core.Entities;

namespace WatchTogether.API.Mappers;

public static class RoomMapper
{
    public static RoomSummaryDto ToSummary(WatchRoom room, string currentUserId)
    {
        return new RoomSummaryDto
        {
            Id = room.Id,
            RoomCode = room.RoomCode,
            RoomName = room.RoomName,
            HostDisplayName = room.HostUser?.DisplayName ?? string.Empty,
            ParticipantCount = room.Participants.Count,
            IsHost = room.HostUserId == currentUserId,
            CreatedAt = room.CreatedAtUtc
        };
    }

    public static RoomDetailsDto ToDetails(WatchRoom room, string currentUserId)
    {
        return new RoomDetailsDto
        {
            Id = room.Id,
            RoomCode = room.RoomCode,
            RoomName = room.RoomName,
            HostUserId = room.HostUserId,
            IsHost = room.HostUserId == currentUserId,
            CreatedAt = room.CreatedAtUtc,
            Participants = room.Participants
                .OrderBy(participant => participant.JoinedAtUtc)
                .Select(participant => new ParticipantDto
                {
                    UserId = participant.UserId,
                    DisplayName = participant.User?.DisplayName ?? string.Empty,
                    IsHost = participant.UserId == room.HostUserId,
                    JoinedAt = participant.JoinedAtUtc
                })
                .ToList()
        };
    }
}