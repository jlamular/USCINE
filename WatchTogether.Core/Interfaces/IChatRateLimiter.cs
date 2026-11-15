namespace WatchTogether.Core.Interfaces;

public interface IChatRateLimiter
{
    // Returns false if this user has sent too many messages recently
    bool TryAcquire(string userId);
}