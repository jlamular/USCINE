using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;
using WatchTogether.Infrastructure.Data;

namespace WatchTogether.Infrastructure.Services;

public class GuestCleanupService : IGuestCleanupService
{
    private readonly AppDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;

    public GuestCleanupService(AppDbContext dbContext, UserManager<ApplicationUser> userManager)
    {
        _dbContext = dbContext;
        _userManager = userManager;
    }

    public async Task<List<string>> GetExpiredGuestIdsAsync(DateTime cutoffUtc, int maxCount)
    {
        return await _dbContext.Users
            .AsNoTracking()
            .Where(user => user.IsGuest && user.CreatedAt < cutoffUtc)
            .OrderBy(user => user.CreatedAt)
            .Select(user => user.Id)
            .Take(maxCount)
            .ToListAsync();
    }

    public async Task<ServiceResult> DeleteGuestAccountAsync(string guestUserId)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(guestUserId);

        // Already gone (for example a second sweep): nothing left to do
        if (user == null)
        {
            return ServiceResult.Success();
        }

        // The most important line of the whole job: a registered account can never be deleted here
        if (!user.IsGuest)
        {
            return ServiceResult.Failure(
                ServiceErrorType.Forbidden,
                "Only guest accounts can be removed by the cleanup job.");
        }

        // Guests cannot chat, so this normally finds nothing. A leftover row would block the user delete.
        await _dbContext.ChatMessages
            .Where(message => message.UserId == guestUserId)
            .ExecuteDeleteAsync();

        IdentityResult result = await _userManager.DeleteAsync(user);
        if (!result.Succeeded)
        {
            string errors = string.Join(" ", result.Errors.Select(error => error.Description));
            return ServiceResult.Failure(ServiceErrorType.Validation, errors);
        }

        return ServiceResult.Success();
    }
}