namespace PepperFarm.Api.Models;

public class PepperVariety
{
    public int PepperId { get; set; }
    public string PepperName { get; set; } = string.Empty;
    public string? ScientificName { get; set; }
    public int? HeatLevelScovilleMin { get; set; }
    public int? HeatLevelScovilleMax { get; set; }
    public decimal? OptimalSoilMoistureMin { get; set; }
    public decimal? OptimalSoilMoistureMax { get; set; }
    public decimal? OptimalTempMinC { get; set; }
    public decimal? OptimalTempMaxC { get; set; }
    public decimal? OptimalSunlightHours { get; set; }
    public string? ImageUrl { get; set; }
    public string? Zone { get; set; }
    public string? GeneralDescription { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
