namespace WatchTogether.API.BackgroundServices;

// Read from the "PublicRooms" section of appsettings.json
public class PublicRoomOptions
{
    // How long a public room survives without its host before it is closed
    public int HostGraceSeconds { get; set; } = 120;

    // How often the sweeper looks. The real wait is the grace period plus up to one interval.
    public int SweepIntervalSeconds { get; set; } = 15;
}