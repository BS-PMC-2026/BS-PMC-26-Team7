namespace PepperFarm.Api.Models;

public class TaskItem
{
    public int Id { get; set; }

    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }

    public string Status { get; set; } = "todo";
    public string Priority { get; set; } = "medium";
    public string TaskType { get; set; } = string.Empty;

    public int CreatedByUserId { get; set; }
    public int? AssignedToUserId { get; set; }

    public DateTime? DueDate { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public int? PepperId { get; set; }
    public int? ZoneId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public User CreatedBy { get; set; } = null!;
    public User? AssignedTo { get; set; }
}
