using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Data.Configurations;

public class RoleConfiguration : IEntityTypeConfiguration<Role>
{
    public void Configure(EntityTypeBuilder<Role> builder)
    {
        builder.ToTable("Roles");
        builder.HasKey(r => r.RoleId);
        builder.Property(r => r.RoleName).IsRequired().HasMaxLength(50);
        builder.HasIndex(r => r.RoleName).IsUnique();
        builder.Property(r => r.RoleDescription).HasMaxLength(255);
        builder.Property(r => r.IsActive).HasDefaultValue(true);
        builder.Property(r => r.CreatedAt).HasDefaultValueSql("sysutcdatetime()");
    }
}
