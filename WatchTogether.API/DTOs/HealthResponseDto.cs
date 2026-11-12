namespace WatchTogether.API.DTOs;

public class HealthResponseDto
{
    public string Status { get; set; } = string.Empty;
    public string Database { get; set; } = string.Empty;
    public DateTime ServerTimeUtc { get; set; }
}