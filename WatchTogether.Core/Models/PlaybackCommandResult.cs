namespace WatchTogether.Core.Models;

public class PlaybackCommandResult
{
    public PlaybackState State { get; set; } = new PlaybackState();

    // false when the command would not have changed anything, so nobody needs to be told
    public bool Changed { get; set; }
}