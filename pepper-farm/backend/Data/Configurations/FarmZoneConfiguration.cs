using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Data.Configurations;

public class FarmZoneConfiguration : IEntityTypeConfiguration<FarmZone>
{
    public void Configure(EntityTypeBuilder<FarmZone> builder)
    {
        builder.ToTable("FarmZones");
        builder.HasKey(z => z.ZoneId);
        builder.Property(z => z.ZoneName).IsRequired().HasMaxLength(100);
        builder.HasIndex(z => z.ZoneName).IsUnique();
        builder.Property(z => z.ZoneCode).HasMaxLength(50);
        builder.HasIndex(z => z.ZoneCode).IsUnique();
        builder.Property(z => z.AreaSquareMeters).HasPrecision(10, 2);
        builder.Property(z => z.Latitude).HasPrecision(9, 6);
        builder.Property(z => z.Longitude).HasPrecision(9, 6);
        builder.Property(z => z.SoilType).HasMaxLength(100);
        builder.Property(z => z.IrrigationMethod).HasMaxLength(100);
        builder.Property(z => z.Notes).HasMaxLength(500);
        builder.Property(z => z.IsActive).HasDefaultValue(true);
        builder.Property(z => z.CreatedAt).HasDefaultValueSql("sysutcdatetime()");
        builder.HasOne(z => z.Pepper)
            .WithMany()
            .HasForeignKey(z => z.PepperId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
