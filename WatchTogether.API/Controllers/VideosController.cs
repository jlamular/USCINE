using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchTogether.API.DTOs;
using WatchTogether.API.Extensions;
using WatchTogether.API.Hubs;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public class VideosController : ControllerBase
{
    // The hard ceiling for the request body (2 GB plus room for the form overhead).
    // The configurable limit in appsettings.json is enforced by VideoService and must not be larger than this.
    private const long MaxUploadRequestBytes = 2L * 1024 * 1024 * 1024 + 16L * 1024 * 1024;

    private readonly IVideoService _videoService;
    private readonly ITokenService _tokenService;
    private readonly IRoomNotifier _roomNotifier;

    public VideosController(
        IVideoService videoService,
        ITokenService tokenService,
        IRoomNotifier roomNotifier)
    {
        _videoService = videoService;
        _tokenService = tokenService;
        _roomNotifier = roomNotifier;
    }

    private string CurrentUserId
    {
        get
        {
            return User.GetUserId()
                ?? throw new InvalidOperationException("The authenticated request has no user id claim.");
        }
    }

    [HttpPost("rooms/{roomId:guid}/videos")]
    [RequestSizeLimit(MaxUploadRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadRequestBytes)]
    public async Task<IActionResult> UploadVideo(Guid roomId, IFormFile file, CancellationToken cancellationToken)
    {
        ServiceResult<Video> result;

        await using (Stream content = file.OpenReadStream())
        {
            result = await _videoService.UploadVideoAsync(
                CurrentUserId,
                roomId,
                file.FileName,
                file.Length,
                content,
                cancellationToken);
        }

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return StatusCode(StatusCodes.Status201Created, RoomMapper.ToVideoDto(result.Value!));
    }

    [HttpGet("rooms/{roomId:guid}/videos")]
    public async Task<IActionResult> GetRoomVideos(Guid roomId)
    {
        ServiceResult<List<Video>> result = await _videoService.GetRoomVideosAsync(CurrentUserId, roomId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return Ok(result.Value!.Select(RoomMapper.ToVideoDto).ToList());
    }

    [HttpDelete("videos/{videoId:guid}")]
    public async Task<IActionResult> DeleteVideo(Guid videoId)
    {
        ServiceResult<Video> result = await _videoService.DeleteVideoAsync(CurrentUserId, videoId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        // If it was the video being shown, everyone's room state just changed
        await _roomNotifier.NotifyRoomStateChangedAsync(result.Value!.RoomId);

        return NoContent();
    }

    // Step 1 of watching: the logged-in user asks for a stream token for one video
    [HttpPost("videos/{videoId:guid}/stream-token")]
    public async Task<IActionResult> CreateStreamToken(Guid videoId)
    {
        ServiceResult<Video> result = await _videoService.GetVideoAsync(CurrentUserId, videoId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        GeneratedToken token = _tokenService.CreateStreamToken(CurrentUserId, videoId);

        return Ok(new StreamTokenResponseDto
        {
            Token = token.Token,
            ExpiresAt = token.ExpiresAtUtc
        });
    }

    // Step 2: the <video> tag requests the file. It cannot send an Authorization header,
    // so this endpoint accepts the stream token from the query string instead.
    [AllowAnonymous]
    [HttpGet("videos/{videoId:guid}/stream")]
    public async Task<IActionResult> StreamVideo(Guid videoId, [FromQuery] string? token)
    {
        if (string.IsNullOrEmpty(token))
        {
            return Unauthorized();
        }

        StreamTokenClaims? claims = await _tokenService.ValidateStreamTokenAsync(token);

        // The token must belong to THIS video
        if (claims == null || claims.VideoId != videoId)
        {
            return Unauthorized();
        }

        // Re-check membership on every request: leaving the room cuts off access immediately
        ServiceResult<VideoStreamInfo> result = await _videoService.OpenVideoStreamAsync(claims.UserId, videoId);

        if (!result.Succeeded)
        {
            return NotFound();
        }

        Response.Headers["X-Content-Type-Options"] = "nosniff";

        // enableRangeProcessing makes seeking work: the browser asks for byte ranges, not the whole file
        return File(result.Value!.Stream, result.Value.ContentType, enableRangeProcessing: true);
    }

    private IActionResult ToErrorResponse(ServiceResult result)
    {
        var body = new ErrorResponseDto { Errors = result.Errors.ToList() };

        return result.ErrorType switch
        {
            ServiceErrorType.NotFound => NotFound(body),
            ServiceErrorType.Forbidden => StatusCode(StatusCodes.Status403Forbidden, body),
            _ => BadRequest(body)
        };
    }
}