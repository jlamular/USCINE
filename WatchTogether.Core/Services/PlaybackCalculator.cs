namespace WatchTogether.Core.Services;

public static class PlaybackCalculator
{
    // Where the video should be at nowUtc, given the anchor the host last set
    public static double GetExpectedPosition(
        bool isPlaying,
        double anchorPositionSeconds,
        DateTime anchorUpdatedAtUtc,
        DateTime nowUtc,
        double? durationSeconds)
    {
        double position = anchorPositionSeconds;

        if (isPlaying)
        {
            double elapsedSeconds = (nowUtc - anchorUpdatedAtUtc).TotalSeconds;

            // A negative value would mean the clock went backwards. Ignore it.
            if (elapsedSeconds > 0)
            {
                position += elapsedSeconds;
            }
        }

        if (durationSeconds.HasValue)
        {
            position = Math.Min(position, durationSeconds.Value);
        }

        return Math.Max(0, position);
    }
}