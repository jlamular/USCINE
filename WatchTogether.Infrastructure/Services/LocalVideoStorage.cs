using Microsoft.Extensions.Logging;
using WatchTogether.Core.Interfaces;
using WatchTogether.Infrastructure.Settings;

namespace WatchTogether.Infrastructure.Services;

public class LocalVideoStorage : IVideoStorage
{
    private readonly string _rootPath;
    private readonly ILogger<LocalVideoStorage> _logger;

    public LocalVideoStorage(StorageSettings settings, ILogger<LocalVideoStorage> logger)
    {
        _logger = logger;
        _rootPath = Path.GetFullPath(settings.VideosRootPath);
        Directory.CreateDirectory(_rootPath);
    }

    public async Task<string> SaveAsync(Stream content, CancellationToken cancellationToken)
    {
        // The name is generated here. Nothing the user typed ever becomes part of the path.
        string storedFileName = $"{Guid.NewGuid():N}.mp4";
        string fullPath = GetSafePath(storedFileName);

        try
        {
            await using var target = new FileStream(
                fullPath,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                bufferSize: 81920,
                useAsync: true);

            await content.CopyToAsync(target, cancellationToken);
        }
        catch
        {
            // A failed or cancelled upload must not leave a half-written file behind
            Delete(storedFileName);
            throw;
        }

        return storedFileName;
    }

    public Stream? OpenRead(string storedFileName)
    {
        string fullPath = GetSafePath(storedFileName);

        if (!File.Exists(fullPath))
        {
            return null;
        }

        // FileShare.Delete lets someone delete the file while it is being streamed.
        // Without it, Windows refuses the delete and the file would stay on disk forever.
        return new FileStream(
            fullPath,
            FileMode.Open,
            FileAccess.Read,
            FileShare.Read | FileShare.Delete,
            bufferSize: 81920,
            useAsync: true);
    }

    public bool Delete(string storedFileName)
    {
        try
        {
            File.Delete(GetSafePath(storedFileName));
            return true;
        }
        catch (IOException exception)
        {
            _logger.LogWarning(
                exception,
                "Could not delete video file {StoredFileName}. It stays on disk as an orphan.",
                storedFileName);
            return false;
        }
        catch (UnauthorizedAccessException exception)
        {
            _logger.LogWarning(
                exception,
                "Not allowed to delete video file {StoredFileName}. It stays on disk as an orphan.",
                storedFileName);
            return false;
        }
    }

    // Defence against path traversal: the final path must stay inside the video folder
    private string GetSafePath(string storedFileName)
    {
        string fullPath = Path.GetFullPath(Path.Combine(_rootPath, storedFileName));

        if (!fullPath.StartsWith(_rootPath + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("Invalid stored file name.");
        }

        return fullPath;
    }
}