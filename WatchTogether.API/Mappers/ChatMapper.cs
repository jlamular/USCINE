using WatchTogether.API.DTOs;
using WatchTogether.Core.Entities;

namespace WatchTogether.API.Mappers;

public static class ChatMapper
{
    public static ChatMessageDto ToDto(ChatMessage message)
    {
        return new ChatMessageDto
        {
            Id = message.Id,
            RoomId = message.RoomId,
            UserId = message.UserId,
            DisplayName = message.User?.DisplayName ?? string.Empty,
            Text = message.Text,
            SentAt = message.SentAtUtc
        };
    }
}