using System.ComponentModel.DataAnnotations;

namespace PepperFarm.Api.DTOs.Tasks;

public class CreateTaskDto
{
    [Required]
    [MaxLength(200)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    [Required]
    public string TaskType { get; set; } = string.Empty;

    public string Priority { get; set; } = "medium";

    public int? AssignedToUserId { get; set; }

    public DateTime? DueDate { get; set; }

    public int? PepperId { get; set; }
    public int? ZoneId { get; set; }
}
