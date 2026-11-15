using WatchTogether.Core.Interfaces;

namespace WatchTogether.Core.Services;

// A "sliding window": a user may send at most MaxMessages in any period of WindowSeconds.
// It is registered as a singleton, so it remembers across requests. Many requests run at once, so we lock.
public class ChatRateLimiter : IChatRateLimiter
{
    private const int MaxMessages = 5;
    private const int WindowSeconds = 10;

    private readonly object _lock = new object();
    private readonly Dictionary<string, Queue<DateTime>> _recentMessages = new Dictionary<string, Queue<DateTime>>();

    public bool TryAcquire(string userId)
    {
        DateTime now = DateTime.UtcNow;

        lock (_lock)
        {
            if (!_recentMessages.TryGetValue(userId, out Queue<DateTime>? sentAt))
            {
                sentAt = new Queue<DateTime>();
                _recentMessages[userId] = sentAt;
            }

            // Forget messages that are older than the window
            while (sentAt.Count > 0 && (now - sentAt.Peek()).TotalSeconds > WindowSeconds)
            {
                sentAt.Dequeue();
            }

            if (sentAt.Count >= MaxMessages)
            {
                return false;
            }

            sentAt.Enqueue(now);
            return true;
        }
    }
}