using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface IAuthService
{
    Task<AuthResult> RegisterAsync(string email, string password, string displayName);

    Task<AuthResult> LoginAsync(string email, string password);

    Task<ApplicationUser?> GetUserByIdAsync(string userId);

    Task<AuthResult> UpdateDisplayNameAsync(string userId, string displayName);
}