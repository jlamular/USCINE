using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchTogether.API.DTOs;
using WatchTogether.API.Extensions;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms")]
public class RoomsController : ControllerBase
{
    private readonly IRoomService _roomService;

    public RoomsController(IRoomService roomService)
    {
        _roomService = roomService;
    }

    // Our tokens always contain a user id, so a missing one is a bug, not a user error
    private string CurrentUserId
    {
        get
        {
            return User.GetUserId()
                ?? throw new InvalidOperationException("The authenticated request has no user id claim.");
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetMyRooms()
    {
        List<WatchRoom> rooms = await _roomService.GetMyRoomsAsync(CurrentUserId);

        List<RoomSummaryDto> summaries = rooms
            .Select(room => RoomMapper.ToSummary(room, CurrentUserId))
            .ToList();

        return Ok(summaries);
    }

    [HttpPost]
    public async Task<IActionResult> CreateRoom(CreateRoomRequestDto request)
    {
        ServiceResult<WatchRoom> result = await _roomService.CreateRoomAsync(CurrentUserId, request.RoomName);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        RoomDetailsDto details = RoomMapper.ToDetails(result.Value!, CurrentUserId);
        return CreatedAtAction(nameof(GetRoom), new { roomId = details.Id }, details);
    }

    [HttpPost("join")]
    public async Task<IActionResult> JoinRoom(JoinRoomRequestDto request)
    {
        ServiceResult<WatchRoom> result = await _roomService.JoinRoomAsync(CurrentUserId, request.RoomCode);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return Ok(RoomMapper.ToDetails(result.Value!, CurrentUserId));
    }

    [HttpGet("{roomId:guid}")]
    public async Task<IActionResult> GetRoom(Guid roomId)
    {
        ServiceResult<WatchRoom> result = await _roomService.GetRoomAsync(CurrentUserId, roomId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return Ok(RoomMapper.ToDetails(result.Value!, CurrentUserId));
    }

    [HttpPost("{roomId:guid}/leave")]
    public async Task<IActionResult> LeaveRoom(Guid roomId)
    {
        ServiceResult result = await _roomService.LeaveRoomAsync(CurrentUserId, roomId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return NoContent();
    }

    [HttpDelete("{roomId:guid}")]
    public async Task<IActionResult> DeleteRoom(Guid roomId)
    {
        ServiceResult result = await _roomService.DeleteRoomAsync(CurrentUserId, roomId);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return NoContent();
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