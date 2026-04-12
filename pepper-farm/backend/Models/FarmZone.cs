namespace PepperFarm.Api.Models;

public class FarmZone
{
    public int ZoneId { get; set; }
    public string ZoneName { get; set; } = string.Empty;
    public string? ZoneCode { get; set; }
    public int? PepperId { get; set; }
    public decimal? AreaSquareMeters { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? SoilType { get; set; }
    public string? IrrigationMethod { get; set; }
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public PepperVariety? Pepper { get; set; }
}
