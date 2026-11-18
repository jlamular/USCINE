using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Extensions;

public static class ClaimsPrincipalExtensions
{
    public static string? GetUserId(this ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
    }

    // Reads the signed claim from the verified token. Nothing the client sends as a parameter is involved.
    public static bool IsGuest(this ClaimsPrincipal principal)
    {
        return principal.FindFirstValue(AppClaims.IsGuest) == "true";
    }
}