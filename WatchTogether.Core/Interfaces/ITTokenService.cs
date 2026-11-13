using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Interfaces;

public interface ITokenService
{
    string CreateToken(ApplicationUser user);
}