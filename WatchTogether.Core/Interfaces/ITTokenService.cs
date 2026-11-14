using WatchTogether.Core.Entities;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Interfaces;

public interface ITokenService
{
    string CreateToken(ApplicationUser user);

    GeneratedToken CreateStreamToken(string userId, Guid videoId);

    Task<StreamTokenClaims?> ValidateStreamTokenAsync(string token);
}