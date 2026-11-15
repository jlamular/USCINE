using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IChatService
{
    Task<ServiceResult<ChatMessage>> SendMessageAsync(string userId, Guid roomId, string text);

    // Use beforeId for older messages, afterId for newer ones, neither for the latest. Never both.
    Task<ServiceResult<List<ChatMessage>>> GetMessagesAsync(
        string userId,
        Guid roomId,
        long? beforeId,
        long? afterId,
        int? limit);
}