using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public class AppDbContext : DbContext
{
    public DbSet<AuthUser> Users => Set<AuthUser>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Role> Roles => Set<Role>();
    public DbSet<Permission> Permissions => Set<Permission>();
    public DbSet<RolePermission> RolePermissions => Set<RolePermission>();
    public DbSet<Plan> Plans => Set<Plan>();
    public DbSet<Subscription> Subscriptions => Set<Subscription>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<PaymentMethod> PaymentMethods => Set<PaymentMethod>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Role>()
            .HasIndex(role => role.Name)
            .IsUnique();

        modelBuilder.Entity<Permission>()
            .HasIndex(permission => permission.Key)
            .IsUnique();

        modelBuilder.Entity<RolePermission>()
            .HasKey(item => new { item.RoleId, item.PermissionId });

        modelBuilder.Entity<RolePermission>()
            .HasOne(item => item.Role)
            .WithMany(role => role.RolePermissions)
            .HasForeignKey(item => item.RoleId);

        modelBuilder.Entity<RolePermission>()
            .HasOne(item => item.Permission)
            .WithMany(permission => permission.RolePermissions)
            .HasForeignKey(item => item.PermissionId);

        modelBuilder.Entity<Plan>()
            .HasIndex(plan => plan.Name)
            .IsUnique();

        modelBuilder.Entity<Subscription>()
            .HasIndex(subscription => subscription.OrganizationId)
            .IsUnique();

        modelBuilder.Entity<Subscription>()
            .HasOne(subscription => subscription.Organization)
            .WithMany()
            .HasForeignKey(subscription => subscription.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Subscription>()
            .HasOne(subscription => subscription.Plan)
            .WithMany(plan => plan.Subscriptions)
            .HasForeignKey(subscription => subscription.PlanId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Invoice>()
            .HasIndex(invoice => invoice.OrganizationId);

        modelBuilder.Entity<Invoice>()
            .HasOne(invoice => invoice.Organization)
            .WithMany()
            .HasForeignKey(invoice => invoice.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<PaymentMethod>()
            .HasIndex(method => method.OrganizationId);

        modelBuilder.Entity<PaymentMethod>()
            .HasOne(method => method.Organization)
            .WithMany()
            .HasForeignKey(method => method.OrganizationId)
            .OnDelete(DeleteBehavior.Cascade);

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
