using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Interfaces;

public interface IChatRepository
{
    Task AddAsync(ChatMessage message);

    // Includes the sender, so the display name is available
    Task<ChatMessage?> GetByIdAsync(long messageId);

    // The newest messages (optionally only those older than beforeId), returned oldest first
    Task<List<ChatMessage>> GetLatestAsync(Guid roomId, int limit, long? beforeId);

    // Messages newer than afterId, oldest first
    Task<List<ChatMessage>> GetAfterAsync(Guid roomId, long afterId, int limit);
}