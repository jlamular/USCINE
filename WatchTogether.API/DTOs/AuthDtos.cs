using System.ComponentModel.DataAnnotations;

namespace WatchTogether.API.DTOs;

public class RegisterRequestDto
{
    [Required]
    [EmailAddress]
    [StringLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 100 characters.")]
    public string Password { get; set; } = string.Empty;

    [Required]
    [StringLength(32, MinimumLength = 2, ErrorMessage = "Display name must be between 2 and 32 characters.")]
    public string DisplayName { get; set; } = string.Empty;
}

public class LoginRequestDto
{
    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;
}

public class UpdateDisplayNameRequestDto
{
    [Required]
    [StringLength(32, MinimumLength = 2, ErrorMessage = "Display name must be between 2 and 32 characters.")]
    public string DisplayName { get; set; } = string.Empty;
}

public class UserDto
{
    public string Id { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public string DisplayName { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}

public class AuthResponseDto
{
    public string Token { get; set; } = string.Empty;

    public UserDto User { get; set; } = new UserDto();
}

public class ErrorResponseDto
{
    public List<string> Errors { get; set; } = new List<string>();
}