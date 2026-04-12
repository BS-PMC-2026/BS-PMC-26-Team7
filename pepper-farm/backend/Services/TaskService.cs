using Microsoft.EntityFrameworkCore;
using PepperFarm.Api.Data;
using PepperFarm.Api.DTOs.Tasks;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Services;

public class TaskService
{
    private readonly AppDbContext _db;

    public TaskService(AppDbContext db)
    {
        _db = db;
    }

    public async Task<(TaskResponseDto? Result, string? Error)> CreateTaskAsync(int createdByUserId, CreateTaskDto dto)
    {
        var caller = await _db.Users
            .Include(u => u.Role)
            .FirstOrDefaultAsync(u => u.UserId == createdByUserId);

        if (caller == null)
            return (null, "Caller user does not exist.");

        if (caller.Role.RoleName != "FarmManager")
            return (null, "Only FarmManagers can create tasks.");

        string[] allowedPriorities = ["low", "medium", "high", "critical"];
        if (!allowedPriorities.Contains(dto.Priority))
            return (null, $"Invalid priority '{dto.Priority}'. Allowed values: low, medium, high, critical.");

        if (dto.DueDate.HasValue && dto.DueDate.Value < DateTime.UtcNow.Date)
            return (null, "DueDate cannot be in the past.");

        if (dto.AssignedToUserId.HasValue)
        {
            var assignee = await _db.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.UserId == dto.AssignedToUserId.Value);

            if (assignee == null)
                return (null, "Assigned user does not exist.");

            if (assignee.Role.RoleName != "Worker")
                return (null, "Tasks can only be assigned to Workers.");
        }

        var task = new TaskItem
        {
            Title = dto.Title,
            Description = dto.Description,
            TaskType = dto.TaskType,
            Priority = dto.Priority,
            Status = "todo",
            CreatedByUserId = createdByUserId,
            AssignedToUserId = dto.AssignedToUserId,
            DueDate = dto.DueDate,
            PepperId = dto.PepperId,
            ZoneId = dto.ZoneId,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.Tasks.Add(task);
        await _db.SaveChangesAsync();

        return (MapToResponse(task), null);
    }

    private static TaskResponseDto MapToResponse(TaskItem task) => new()
    {
        Id = task.Id,
        Title = task.Title,
        Description = task.Description,
        Status = task.Status,
        Priority = task.Priority,
        TaskType = task.TaskType,
        CreatedByUserId = task.CreatedByUserId,
        AssignedToUserId = task.AssignedToUserId,
        DueDate = task.DueDate,
        StartedAt = task.StartedAt,
        CompletedAt = task.CompletedAt,
        PepperId = task.PepperId,
        ZoneId = task.ZoneId,
        CreatedAt = task.CreatedAt,
        UpdatedAt = task.UpdatedAt
    };
}
