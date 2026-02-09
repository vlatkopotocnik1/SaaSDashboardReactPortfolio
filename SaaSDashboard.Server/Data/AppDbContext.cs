using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public class AppDbContext : DbContext
{
    public DbSet<AuthUser> Users => Set<AuthUser>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Team> Teams => Set<Team>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Organization>()
            .HasIndex(org => org.Name)
            .IsUnique();

        modelBuilder.Entity<Team>()
            .HasIndex(team => new { team.OrganizationId, team.Name })
            .IsUnique();

        modelBuilder.Entity<Organization>()
            .HasMany(org => org.Teams)
            .WithOne(team => team.Organization)
            .HasForeignKey(team => team.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<AuthUser>()
            .HasOne(user => user.Organization)
            .WithMany()
            .HasForeignKey(user => user.OrganizationId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AuthUser>()
            .HasOne(user => user.Team)
            .WithMany(team => team.Users)
            .HasForeignKey(user => user.TeamId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<AuthUser>()
            .HasIndex(user => user.Username)
            .IsUnique();

        // Seed data handled by DbSeeder to allow idempotent inserts.
    }
}
