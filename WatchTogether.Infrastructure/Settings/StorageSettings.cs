namespace WatchTogether.Infrastructure.Settings;

public class StorageSettings
{
    // A relative path is resolved against the API project folder (see Program.cs)
    public string VideosRootPath { get; set; } = "App_Data/videos";

    public int MaxVideoSizeMb { get; set; } = 1024;
}