namespace WatchTogether.API.Hubs;

// The names of the messages the server pushes to browsers.
// They must match HubEvents in client/src/services/signalrService.js exactly.
public static class HubEvents
{
    public const string RoomStateUpdated = "RoomStateUpdated";

    public const string RoomClosed = "RoomClosed";

    public const string PlaybackUpdated = "PlaybackUpdated";
}