using Microsoft.AspNetCore.Identity;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Services;

public class AuthService : IAuthService
{
    private const int MinDisplayNameLength = 2;
    private const int MaxDisplayNameLength = 32;

    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ITokenService _tokenService;

    public AuthService(UserManager<ApplicationUser> userManager, ITokenService tokenService)
    {
        _userManager = userManager;
        _tokenService = tokenService;
    }

    public async Task<AuthResult> RegisterAsync(string email, string password, string displayName)
    {
        string cleanEmail = email.Trim();
        string cleanDisplayName = displayName.Trim();

        if (!IsValidDisplayName(cleanDisplayName))
        {
            return AuthResult.Failure($"Display name must be between {MinDisplayNameLength} and {MaxDisplayNameLength} characters.");
        }

        ApplicationUser? existingUser = await _userManager.FindByEmailAsync(cleanEmail);
        if (existingUser != null)
        {
            return AuthResult.Failure("An account with this email already exists.");
        }

        var newUser = new ApplicationUser
        {
            UserName = cleanEmail,
            Email = cleanEmail,
            DisplayName = cleanDisplayName,
            CreatedAt = DateTime.UtcNow
        };

        IdentityResult createResult = await _userManager.CreateAsync(newUser, password);
        if (!createResult.Succeeded)
        {
            return AuthResult.Failure(createResult.Errors.Select(error => error.Description));
        }

        string token = _tokenService.CreateToken(newUser);
        return AuthResult.Success(newUser, token);
    }

    public async Task<AuthResult> LoginAsync(string email, string password)
    {
        const string invalidCredentialsMessage = "Invalid email or password.";

        ApplicationUser? user = await _userManager.FindByEmailAsync(email.Trim());
        if (user == null)
        {
            return AuthResult.Failure(invalidCredentialsMessage);
        }

        if (await _userManager.IsLockedOutAsync(user))
        {
            return AuthResult.Failure("Too many failed attempts. Please try again in a few minutes.");
        }

        bool passwordIsCorrect = await _userManager.CheckPasswordAsync(user, password);
        if (!passwordIsCorrect)
        {
            await _userManager.AccessFailedAsync(user);
            return AuthResult.Failure(invalidCredentialsMessage);
        }

        await _userManager.ResetAccessFailedCountAsync(user);

        string token = _tokenService.CreateToken(user);
        return AuthResult.Success(user, token);
    }

    public async Task<ApplicationUser?> GetUserByIdAsync(string userId)
    {
        return await _userManager.FindByIdAsync(userId);
    }

    public async Task<AuthResult> UpdateDisplayNameAsync(string userId, string displayName)
    {
        string cleanDisplayName = displayName.Trim();

        if (!IsValidDisplayName(cleanDisplayName))
        {
            return AuthResult.Failure($"Display name must be between {MinDisplayNameLength} and {MaxDisplayNameLength} characters.");
        }

        ApplicationUser? user = await _userManager.FindByIdAsync(userId);
        if (user == null)
        {
            return AuthResult.Failure("User not found.");
        }

        user.DisplayName = cleanDisplayName;

        IdentityResult updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded)
        {
            return AuthResult.Failure(updateResult.Errors.Select(error => error.Description));
        }

        return AuthResult.Success(user);
    }

    private static bool IsValidDisplayName(string displayName)
    {
        return displayName.Length >= MinDisplayNameLength
            && displayName.Length <= MaxDisplayNameLength;
    }
}