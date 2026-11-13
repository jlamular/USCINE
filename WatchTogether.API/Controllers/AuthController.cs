using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using WatchTogether.API.DTOs;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequestDto request)
    {
        AuthResult result = await _authService.RegisterAsync(
            request.Email,
            request.Password,
            request.DisplayName);

        if (!result.Succeeded)
        {
            return BadRequest(new ErrorResponseDto { Errors = result.Errors });
        }

        return Ok(CreateAuthResponse(result));
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequestDto request)
    {
        AuthResult result = await _authService.LoginAsync(request.Email, request.Password);

        if (!result.Succeeded)
        {
            return Unauthorized(new ErrorResponseDto { Errors = result.Errors });
        }

        return Ok(CreateAuthResponse(result));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        string? userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        ApplicationUser? user = await _authService.GetUserByIdAsync(userId);
        if (user == null)
        {
            return Unauthorized();
        }

        return Ok(MapToUserDto(user));
    }

    [Authorize]
    [HttpPut("me")]
    public async Task<IActionResult> UpdateDisplayName(UpdateDisplayNameRequestDto request)
    {
        string? userId = GetCurrentUserId();
        if (userId == null)
        {
            return Unauthorized();
        }

        AuthResult result = await _authService.UpdateDisplayNameAsync(userId, request.DisplayName);

        if (!result.Succeeded)
        {
            return BadRequest(new ErrorResponseDto { Errors = result.Errors });
        }

        return Ok(MapToUserDto(result.User!));
    }

    private string? GetCurrentUserId()
    {
        return User.FindFirstValue(JwtRegisteredClaimNames.Sub);
    }

    private static AuthResponseDto CreateAuthResponse(AuthResult result)
    {
        return new AuthResponseDto
        {
            Token = result.Token!,
            User = MapToUserDto(result.User!)
        };
    }

    private static UserDto MapToUserDto(ApplicationUser user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email ?? string.Empty,
            DisplayName = user.DisplayName,
            CreatedAt = user.CreatedAt
        };
    }
}