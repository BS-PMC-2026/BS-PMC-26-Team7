using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Data.Configurations;

public class TaskConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("Tasks");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Title)
            .IsRequired()
            .HasMaxLength(200);

        builder.Property(t => t.Description)
            .HasMaxLength(1000);

        builder.Property(t => t.Status)
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("todo");

        builder.Property(t => t.Priority)
            .IsRequired()
            .HasMaxLength(50)
            .HasDefaultValue("medium");

        builder.Property(t => t.TaskType)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(t => t.CreatedAt)
            .HasDefaultValueSql("SYSDATETIME()");

        builder.Property(t => t.UpdatedAt)
            .HasDefaultValueSql("SYSDATETIME()");

        builder.HasOne(t => t.CreatedBy)
            .WithMany()
            .HasForeignKey(t => t.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(t => t.AssignedTo)
            .WithMany()
            .HasForeignKey(t => t.AssignedToUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
