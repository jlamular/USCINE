namespace WatchTogether.Infrastructure.Settings;

public class JwtSettings
{
    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SecretKey { get; set; } = string.Empty;

    public int ExpirationMinutes { get; set; } = 60;

    // Guests have no password, so an expired token would lose their account and room.
    // 24 hours matches the planned cleanup window.
    public int GuestTokenExpirationMinutes { get; set; } = 1440;

    public int StreamTokenExpirationMinutes { get; set; } = 360;
}