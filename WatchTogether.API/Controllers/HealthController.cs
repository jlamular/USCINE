using Microsoft.AspNetCore.Mvc;
using WatchTogether.API.DTOs;
using WatchTogether.Infrastructure.Data;

namespace WatchTogether.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public HealthController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        bool canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);

        var response = new HealthResponseDto
        {
            Status = canConnect ? "Healthy" : "Unhealthy",
            Database = canConnect ? "Connected" : "Unreachable",
            ServerTimeUtc = DateTime.UtcNow
        };

        if (!canConnect)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, response);
        }

        return Ok(response);
    }
}