using Microsoft.EntityFrameworkCore;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Infrastructure.Data;

namespace WatchTogether.Infrastructure.Repositories;

public class ChatRepository : IChatRepository
{
    private readonly AppDbContext _dbContext;

    public ChatRepository(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task AddAsync(ChatMessage message)
    {
        _dbContext.ChatMessages.Add(message);
        await _dbContext.SaveChangesAsync();
    }

    public async Task<ChatMessage?> GetByIdAsync(long messageId)
    {
        return await _dbContext.ChatMessages
            .Include(message => message.User)
            .FirstOrDefaultAsync(message => message.Id == messageId);
    }

    public async Task<List<ChatMessage>> GetLatestAsync(Guid roomId, int limit, long? beforeId)
    {
        IQueryable<ChatMessage> query = _dbContext.ChatMessages
            .AsNoTracking()
            .Include(message => message.User)
            .Where(message => message.RoomId == roomId);

        if (beforeId != null)
        {
            query = query.Where(message => message.Id < beforeId.Value);
        }

        // Take the NEWEST ones first, then flip them so they read oldest to newest
        List<ChatMessage> newestFirst = await query
            .OrderByDescending(message => message.Id)
            .Take(limit)
            .ToListAsync();

        newestFirst.Reverse();
        return newestFirst;
    }

    public async Task<List<ChatMessage>> GetAfterAsync(Guid roomId, long afterId, int limit)
    {
        return await _dbContext.ChatMessages
            .AsNoTracking()
            .Include(message => message.User)
            .Where(message => message.RoomId == roomId && message.Id > afterId)
            .OrderBy(message => message.Id)
            .Take(limit)
            .ToListAsync();
    }
}