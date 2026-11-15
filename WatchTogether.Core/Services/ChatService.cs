using System.Text;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Services;

public class ChatService : IChatService
{
    private const int MaxMessageLength = 1000;
    private const int DefaultPageSize = 50;
    private const int MaxPageSize = 100;

    private readonly IRoomRepository _roomRepository;
    private readonly IChatRepository _chatRepository;
    private readonly IChatRateLimiter _rateLimiter;

    public ChatService(
        IRoomRepository roomRepository,
        IChatRepository chatRepository,
        IChatRateLimiter rateLimiter)
    {
        _roomRepository = roomRepository;
        _chatRepository = chatRepository;
        _rateLimiter = rateLimiter;
    }

    public async Task<ServiceResult<ChatMessage>> SendMessageAsync(string userId, Guid roomId, string text)
    {
        // 1. Cheap checks first. A rejected typo should not use up the user's message allowance.
        string cleanText = CleanText(text);

        if (cleanText.Length == 0)
        {
            return ServiceResult<ChatMessage>.Failure(ServiceErrorType.Validation, "Type a message first.");
        }

        if (cleanText.Length > MaxMessageLength)
        {
            return ServiceResult<ChatMessage>.Failure(
                ServiceErrorType.Validation,
                $"Messages can be at most {MaxMessageLength} characters.");
        }

        // 2. Only members of the room may write in it
        bool isMember = await _roomRepository.IsMemberAsync(roomId, userId);
        if (!isMember)
        {
            return ServiceResult<ChatMessage>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        // 3. No flooding
        if (!_rateLimiter.TryAcquire(userId))
        {
            return ServiceResult<ChatMessage>.Failure(
                ServiceErrorType.Validation,
                "You are sending messages too fast. Please wait a moment.");
        }

        // 4. The server decides who sent it and when. Nothing from the client is trusted here.
        var message = new ChatMessage
        {
            RoomId = roomId,
            UserId = userId,
            Text = cleanText,
            SentAtUtc = DateTime.UtcNow
        };

        await _chatRepository.AddAsync(message);

        // Read it back with the sender included, so the display name is available
        ChatMessage? savedMessage = await _chatRepository.GetByIdAsync(message.Id);
        return ServiceResult<ChatMessage>.Success(savedMessage!);
    }

    public async Task<ServiceResult<List<ChatMessage>>> GetMessagesAsync(
        string userId,
        Guid roomId,
        long? beforeId,
        long? afterId,
        int? limit)
    {
        if (beforeId != null && afterId != null)
        {
            return ServiceResult<List<ChatMessage>>.Failure(
                ServiceErrorType.Validation,
                "Use either 'before' or 'after', not both.");
        }

        bool isMember = await _roomRepository.IsMemberAsync(roomId, userId);
        if (!isMember)
        {
            return ServiceResult<List<ChatMessage>>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        int pageSize = Math.Clamp(limit ?? DefaultPageSize, 1, MaxPageSize);

        List<ChatMessage> messages = afterId != null
            ? await _chatRepository.GetAfterAsync(roomId, afterId.Value, pageSize)
            : await _chatRepository.GetLatestAsync(roomId, pageSize, beforeId);

        return ServiceResult<List<ChatMessage>>.Success(messages);
    }

    // Removes control characters (line breaks, tabs, invisible junk) and trims the ends.
    // A chat message is one line of plain text.
    private static string CleanText(string text)
    {
        var builder = new StringBuilder(text.Length);

        foreach (char character in text)
        {
            if (!char.IsControl(character))
            {
                builder.Append(character);
            }
        }

        return builder.ToString().Trim();
    }
}