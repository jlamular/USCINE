using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using WatchTogether.API.Mappers;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Controllers;

[ApiController]
[Authorize]
[Route("api/rooms/{roomId:guid}/messages")]
public class ChatController : ApiControllerBase
{
    private readonly IChatService _chatService;

    public ChatController(IChatService chatService)
    {
        _chatService = chatService;
    }

    // GET api/rooms/{roomId}/messages                 -> the latest messages
    // GET api/rooms/{roomId}/messages?before=120      -> messages older than #120
    // GET api/rooms/{roomId}/messages?after=120       -> messages newer than #120 (used to catch up after a disconnect)
    // Add &limit=20 to change the page size (1 to 100, default 50)
    [HttpGet]
    public async Task<IActionResult> GetMessages(
        Guid roomId,
        [FromQuery] long? before,
        [FromQuery] long? after,
        [FromQuery] int? limit)
    {
        ServiceResult<List<ChatMessage>> result = await _chatService.GetMessagesAsync(
            CurrentUserId,
            roomId,
            before,
            after,
            limit);

        if (!result.Succeeded)
        {
            return ToErrorResponse(result);
        }

        return Ok(result.Value!.Select(ChatMapper.ToDto).ToList());
    }
}