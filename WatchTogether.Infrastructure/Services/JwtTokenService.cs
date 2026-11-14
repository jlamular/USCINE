using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;
using WatchTogether.Infrastructure.Settings;

namespace WatchTogether.Infrastructure.Services;

public class JwtTokenService : ITokenService
{
    // A different audience from login tokens: a stream token can never be used to log in, and vice versa
    private const string StreamAudience = "WatchTogether.VideoStream";
    private const string VideoIdClaim = "vid";

    private readonly JwtSettings _jwtSettings;

    public JwtTokenService(JwtSettings jwtSettings)
    {
        _jwtSettings = jwtSettings;
    }

    public string CreateToken(ApplicationUser user)
    {
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.Id),
                new Claim(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty)
            }),
            Issuer = _jwtSettings.Issuer,
            Audience = _jwtSettings.Audience,
            Expires = DateTime.UtcNow.AddMinutes(_jwtSettings.ExpirationMinutes),
            SigningCredentials = CreateSigningCredentials()
        };

        return new JsonWebTokenHandler().CreateToken(tokenDescriptor);
    }

    public GeneratedToken CreateStreamToken(string userId, Guid videoId)
    {
        DateTime expiresAt = DateTime.UtcNow.AddMinutes(_jwtSettings.StreamTokenExpirationMinutes);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId),
                new Claim(VideoIdClaim, videoId.ToString())
            }),
            Issuer = _jwtSettings.Issuer,
            Audience = StreamAudience,
            Expires = expiresAt,
            SigningCredentials = CreateSigningCredentials()
        };

        string token = new JsonWebTokenHandler().CreateToken(tokenDescriptor);

        return new GeneratedToken
        {
            Token = token,
            ExpiresAtUtc = expiresAt
        };
    }

    public async Task<StreamTokenClaims?> ValidateStreamTokenAsync(string token)
    {
        var tokenHandler = new JsonWebTokenHandler { MapInboundClaims = false };

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = StreamAudience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = CreateSigningKey(),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };

        TokenValidationResult result = await tokenHandler.ValidateTokenAsync(token, validationParameters);
        if (!result.IsValid)
        {
            return null;
        }

        string? userId = result.ClaimsIdentity.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        string? videoIdText = result.ClaimsIdentity.FindFirst(VideoIdClaim)?.Value;

        if (userId == null || !Guid.TryParse(videoIdText, out Guid videoId))
        {
            return null;
        }

        return new StreamTokenClaims
        {
            UserId = userId,
            VideoId = videoId
        };
    }

    private SymmetricSecurityKey CreateSigningKey()
    {
        return new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SecretKey));
    }

    private SigningCredentials CreateSigningCredentials()
    {
        return new SigningCredentials(CreateSigningKey(), SecurityAlgorithms.HmacSha256);
    }
}