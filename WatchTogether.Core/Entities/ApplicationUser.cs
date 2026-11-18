using Microsoft.AspNetCore.Identity;

namespace WatchTogether.Core.Entities;

public class ApplicationUser : IdentityUser
{
    public string DisplayName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }

    // true for the temporary accounts created by "Try as Guest"
    public bool IsGuest { get; set; }
}