namespace WatchTogether.Core.Interfaces;

public interface IVideoStorage
{
    // Saves the content under a new server-generated name and returns that name
    Task<string> SaveAsync(Stream content, CancellationToken cancellationToken);

    // Returns null if the file does not exist
    Stream? OpenRead(string storedFileName);

    bool Delete(string storedFileName);
}