using Microsoft.AspNetCore.Mvc;
using PepperFarm.Api.DTOs.Tasks;
using PepperFarm.Api.Services;

namespace PepperFarm.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly TaskService _taskService;

    public TasksController(TaskService taskService)
    {
        _taskService = taskService;
    }

    /// <summary>
    /// Creates a new task. The caller's user ID is taken from the JWT claim.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<TaskResponseDto>> CreateTask([FromBody] CreateTaskDto dto)
    {
        // TODO: replace with real JWT claim extraction once auth middleware is wired up
        var createdByUserIdClaim = User.FindFirst("userId")?.Value;
        if (createdByUserIdClaim == null || !int.TryParse(createdByUserIdClaim, out int createdByUserId))
            return Unauthorized();

        var (result, error) = await _taskService.CreateTaskAsync(createdByUserId, dto);
        if (error != null)
            return BadRequest(new { message = error });

        return CreatedAtAction(nameof(CreateTask), new { id = result!.Id }, result);
    }
}
