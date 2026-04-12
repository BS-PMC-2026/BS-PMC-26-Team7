using Microsoft.EntityFrameworkCore;
using PepperFarm.Api.Data;
using PepperFarm.Api.DTOs.Tasks;
using PepperFarm.Api.Models;
using PepperFarm.Api.Services;

namespace PepperFarm.Tests;

public class TaskServiceTests : IDisposable
{
    private readonly AppDbContext _db;
    private readonly TaskService _sut;

    // Seeded role IDs
    private const int ManagerRoleId = 1;
    private const int WorkerRoleId = 2;

    // Seeded user IDs
    private const int ManagerUserId = 10;
    private const int WorkerUserId = 20;
    private const int AnotherManagerUserId = 30;

    public TaskServiceTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        _db = new AppDbContext(options);

        // Seed roles
        _db.Roles.AddRange(
            new Role { RoleId = ManagerRoleId, RoleName = "FarmManager" },
            new Role { RoleId = WorkerRoleId,  RoleName = "Worker" }
        );

        // Seed users
        _db.Users.AddRange(
            new User { UserId = ManagerUserId,        FullName = "Alice Manager", Email = "alice@farm.com", PasswordHash = "x", RoleId = ManagerRoleId },
            new User { UserId = WorkerUserId,          FullName = "Bob Worker",    Email = "bob@farm.com",   PasswordHash = "x", RoleId = WorkerRoleId  },
            new User { UserId = AnotherManagerUserId,  FullName = "Carol Manager", Email = "carol@farm.com", PasswordHash = "x", RoleId = ManagerRoleId }
        );

        _db.SaveChanges();
        _sut = new TaskService(_db);
    }

    // ------------------------------------------------------------------ //
    // 1. Valid task creation (unassigned)
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_ValidRequest_ReturnsCreatedTask()
    {
        var dto = new CreateTaskDto
        {
            Title    = "Water the peppers",
            TaskType = "irrigation",
            Priority = "medium",
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(dto.Title, result.Title);
        Assert.Equal("todo", result.Status);
        Assert.Equal(ManagerUserId, result.CreatedByUserId);
        Assert.Null(result.AssignedToUserId);
    }

    // ------------------------------------------------------------------ //
    // 2. Missing required title — caught by DTO validation ([Required]),
    //    so the service receives an empty string; we verify it still saves
    //    and the controller layer is responsible for [Required] rejection.
    //    This test verifies the service does NOT duplicate that guard.
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_EmptyTitle_ServiceStillProcesses()
    {
        // [Required] is enforced at the controller / model-binding layer.
        // If somehow an empty title reaches the service it will be saved
        // as-is (DB constraint not hit in InMemory). We document this boundary.
        var dto = new CreateTaskDto
        {
            Title    = "",   // bypassing controller validation
            TaskType = "inspection",
            Priority = "low",
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        // Service itself doesn't block empty title — that's the controller's job.
        Assert.Null(error);
        Assert.NotNull(result);
    }

    // ------------------------------------------------------------------ //
    // 3. Assigned user does not exist
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_AssignedUserNotFound_ReturnsError()
    {
        var dto = new CreateTaskDto
        {
            Title            = "Harvest zone B",
            TaskType         = "harvesting",
            Priority         = "high",
            AssignedToUserId = 9999, // non-existent
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(result);
        Assert.Equal("Assigned user does not exist.", error);
    }

    // ------------------------------------------------------------------ //
    // 4. Assigned user exists but is not a Worker
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_AssignedUserNotWorker_ReturnsError()
    {
        var dto = new CreateTaskDto
        {
            Title            = "Check irrigation",
            TaskType         = "inspection",
            Priority         = "medium",
            AssignedToUserId = AnotherManagerUserId, // is a FarmManager, not Worker
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(result);
        Assert.Equal("Tasks can only be assigned to Workers.", error);
    }

    // ------------------------------------------------------------------ //
    // 5. Invalid priority value
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_InvalidPriority_ReturnsError()
    {
        var dto = new CreateTaskDto
        {
            Title    = "Fertilize row 3",
            TaskType = "fertilizing",
            Priority = "urgent", // not in allowed set
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(result);
        Assert.Contains("Invalid priority", error);
    }

    // ------------------------------------------------------------------ //
    // 6. Valid due date (today) — should succeed
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_DueDateToday_Succeeds()
    {
        var dto = new CreateTaskDto
        {
            Title    = "Plant seedlings",
            TaskType = "planting",
            Priority = "high",
            DueDate  = DateTime.UtcNow.Date,
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(dto.DueDate, result.DueDate);
    }

    // ------------------------------------------------------------------ //
    // 7. Due date in the past — should fail
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_DueDateInPast_ReturnsError()
    {
        var dto = new CreateTaskDto
        {
            Title    = "Old task",
            TaskType = "inspection",
            Priority = "low",
            DueDate  = DateTime.UtcNow.Date.AddDays(-1),
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(result);
        Assert.Equal("DueDate cannot be in the past.", error);
    }

    // ------------------------------------------------------------------ //
    // 8. Caller is not a FarmManager
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_CallerNotManager_ReturnsError()
    {
        var dto = new CreateTaskDto
        {
            Title    = "Do something",
            TaskType = "other",
            Priority = "low",
        };

        var (result, error) = await _sut.CreateTaskAsync(WorkerUserId, dto);

        Assert.Null(result);
        Assert.Equal("Only FarmManagers can create tasks.", error);
    }

    // ------------------------------------------------------------------ //
    // 9. Valid assignment to a Worker
    // ------------------------------------------------------------------ //
    [Fact]
    public async Task CreateTask_ValidWorkerAssignment_ReturnsTaskWithAssignee()
    {
        var dto = new CreateTaskDto
        {
            Title            = "Water zone C",
            TaskType         = "irrigation",
            Priority         = "critical",
            AssignedToUserId = WorkerUserId,
        };

        var (result, error) = await _sut.CreateTaskAsync(ManagerUserId, dto);

        Assert.Null(error);
        Assert.NotNull(result);
        Assert.Equal(WorkerUserId, result.AssignedToUserId);
    }

    public void Dispose() => _db.Dispose();
}
