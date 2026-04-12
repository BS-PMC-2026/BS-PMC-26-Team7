using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Data.Configurations;

public class PepperVarietyConfiguration : IEntityTypeConfiguration<PepperVariety>
{
    public void Configure(EntityTypeBuilder<PepperVariety> builder)
    {
        builder.ToTable("PepperVarieties");
        builder.HasKey(p => p.PepperId);
        builder.Property(p => p.PepperName).IsRequired().HasMaxLength(100);
        builder.HasIndex(p => p.PepperName).IsUnique();
        builder.Property(p => p.ScientificName).HasMaxLength(150);
        builder.Property(p => p.ImageUrl).HasMaxLength(500);
        builder.Property(p => p.Zone).HasMaxLength(500);
        builder.Property(p => p.GeneralDescription).HasMaxLength(1000);
        builder.Property(p => p.OptimalSoilMoistureMin).HasPrecision(5, 2);
        builder.Property(p => p.OptimalSoilMoistureMax).HasPrecision(5, 2);
        builder.Property(p => p.OptimalTempMinC).HasPrecision(5, 2);
        builder.Property(p => p.OptimalTempMaxC).HasPrecision(5, 2);
        builder.Property(p => p.OptimalSunlightHours).HasPrecision(4, 2);
        builder.Property(p => p.IsActive).HasDefaultValue(true);
        builder.Property(p => p.CreatedAt).HasDefaultValueSql("sysutcdatetime()");
    }
}
