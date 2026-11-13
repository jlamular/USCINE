using WatchTogether.Core.Entities;

namespace WatchTogether.Core.Models;

public class AuthResult
{
    public bool Succeeded { get; private set; }

    public ApplicationUser? User { get; private set; }

    public string? Token { get; private set; }

    public List<string> Errors { get; private set; } = new List<string>();

    public static AuthResult Success(ApplicationUser user, string? token = null)
    {
        return new AuthResult
        {
            Succeeded = true,
            User = user,
            Token = token
        };
    }

    public static AuthResult Failure(IEnumerable<string> errors)
    {
        return new AuthResult
        {
            Succeeded = false,
            Errors = errors.ToList()
        };
    }

    public static AuthResult Failure(string error)
    {
        return Failure(new[] { error });
    }
}