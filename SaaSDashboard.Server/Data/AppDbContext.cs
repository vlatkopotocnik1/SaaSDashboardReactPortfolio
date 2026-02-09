using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public class AppDbContext : DbContext
{
    public DbSet<AuthUser> Users => Set<AuthUser>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AuthUser>()
            .HasIndex(user => user.Username)
            .IsUnique();

        // Seed data handled by DbSeeder to allow idempotent inserts.
    }
}
