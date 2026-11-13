using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;

namespace WatchTogether.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
    }
}