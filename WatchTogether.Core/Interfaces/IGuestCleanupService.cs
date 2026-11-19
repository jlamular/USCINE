using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IGuestCleanupService
{
    // Ids of guest accounts created before cutoffUtc, oldest first. Registered users are never returned.
    Task<List<string>> GetExpiredGuestIdsAsync(DateTime cutoffUtc, int maxCount);

    // Deletes the guest's chat messages and the account itself.
    // Refuses (Forbidden) for any account that is not a guest.
    Task<ServiceResult> DeleteGuestAccountAsync(string guestUserId);
}