using Microsoft.EntityFrameworkCore;
using PepperFarm.Api.Data.Configurations;
using PepperFarm.Api.Models;

namespace PepperFarm.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Role> Roles => Set<Role>();
    public DbSet<User> Users => Set<User>();
    public DbSet<PepperVariety> PepperVarieties => Set<PepperVariety>();
    public DbSet<FarmZone> FarmZones => Set<FarmZone>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new RoleConfiguration());
        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new PepperVarietyConfiguration());
        modelBuilder.ApplyConfiguration(new FarmZoneConfiguration());
        modelBuilder.ApplyConfiguration(new TaskConfiguration());
    }
}
