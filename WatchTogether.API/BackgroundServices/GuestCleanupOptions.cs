namespace WatchTogether.API.BackgroundServices;

// Read from the "GuestCleanup" section of appsettings.json
public class GuestCleanupOptions
{
    // A guest account older than this is deleted. 1440 minutes = 24 hours, the same as the guest token.
    public double GuestLifetimeMinutes { get; set; } = 1440;

    // How often the worker looks. Once an hour is plenty.
    public int SweepIntervalSeconds { get; set; } = 3600;
}