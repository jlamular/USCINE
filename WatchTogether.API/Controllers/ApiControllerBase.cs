using Microsoft.AspNetCore.Mvc;
using WatchTogether.API.DTOs;
using WatchTogether.API.Extensions;
using WatchTogether.Core.Models;

namespace WatchTogether.API.Controllers;

public abstract class ApiControllerBase : ControllerBase
{
    // Our tokens always contain a user id, so a missing one is a bug, not a user error
    protected string CurrentUserId
    {
        get
        {
            return User.GetUserId()
                ?? throw new InvalidOperationException("The authenticated request has no user id claim.");
        }
    }

    protected IActionResult ToErrorResponse(ServiceResult result)
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