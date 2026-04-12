using Microsoft.AspNetCore.Mvc;
using PepperFarm.Api.DTOs.Users;
using PepperFarm.Api.Services;

namespace PepperFarm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly UserService _userService;

    public UsersController(UserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// Returns all active workers available for task assignment.
    /// </summary>
    [HttpGet("workers")]
    public async Task<ActionResult<List<UserResponseDto>>> GetWorkers()
    {
        var workers = await _userService.GetWorkersAsync();
        return Ok(workers);
    }
}
