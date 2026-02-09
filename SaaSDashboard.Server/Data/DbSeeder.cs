using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public static class DbSeeder
{
    public static async Task EnsureSeededAsync(AppDbContext dbContext)
    {
        var permissions = await EnsurePermissionsAsync(dbContext);
        var adminRole = await EnsureRoleAsync(dbContext, "Admin", "Full access to the workspace.", permissions);
        var userRole = await EnsureRoleAsync(dbContext, "User", "Standard workspace access.", permissions
            .Where(item => item.Key is "users.view" or "organizations.view")
            .ToList());

        var hasher = new PasswordHasher<AuthUser>();
        var org = await EnsureOrganizationAsync(dbContext, "Acme Corp");
        var platformTeam = await EnsureTeamAsync(dbContext, org, "Platform");
        var salesTeam = await EnsureTeamAsync(dbContext, org, "Sales");

        await EnsureUserAsync(dbContext, hasher, "admin", adminRole.Name, "admin", org, platformTeam);
        await EnsureUserAsync(dbContext, hasher, "user", userRole.Name, "user", org, salesTeam);
        await dbContext.SaveChangesAsync();
    }

    private static async Task<List<Permission>> EnsurePermissionsAsync(AppDbContext dbContext)
    {
        var permissions = new List<Permission>
        {
            new() { Key = "users.view", Label = "View users", Description = "See users and profile details." },
            new() { Key = "users.manage", Label = "Manage users", Description = "Create, edit, and deactivate users." },
            new() { Key = "organizations.view", Label = "View organizations", Description = "See organizations and teams." },
            new() { Key = "organizations.manage", Label = "Manage organizations", Description = "Create and edit organizations or teams." },
            new() { Key = "roles.manage", Label = "Manage roles", Description = "Edit role permissions and access levels." },
            new() { Key = "billing.view", Label = "View billing", Description = "Read billing history and invoices." },
            new() { Key = "settings.manage", Label = "Manage settings", Description = "Update workspace settings." }
        };

        var resolved = new List<Permission>();

        foreach (var permission in permissions)
        {
            var existing = await dbContext.Permissions.FirstOrDefaultAsync(item => item.Key == permission.Key);
            if (existing is null)
            {
                dbContext.Permissions.Add(permission);
                resolved.Add(permission);
            }
            else
            {
                existing.Label = permission.Label;
                existing.Description = permission.Description;
                resolved.Add(existing);
            }
        }

        return resolved;
    }

    private static async Task<Role> EnsureRoleAsync(
        AppDbContext dbContext,
        string name,
        string description,
        List<Permission> permissions)
    {
        var role = await dbContext.Roles
            .Include(item => item.RolePermissions)
            .FirstOrDefaultAsync(item => item.Name == name);

        if (role is null)
        {
            role = new Role { Name = name };
            dbContext.Roles.Add(role);
        }

        role.Name = name;
        role.Description = description;

        var permissionIds = permissions.Select(item => item.Id).ToHashSet();
        role.RolePermissions.RemoveAll(item => !permissionIds.Contains(item.PermissionId));

        foreach (var permission in permissions)
        {
            if (!role.RolePermissions.Any(item => item.PermissionId == permission.Id))
            {
                role.RolePermissions.Add(new RolePermission
                {
                    RoleId = role.Id,
                    PermissionId = permission.Id
                });
            }
        }

        return role;
    }

    private static async Task<Organization> EnsureOrganizationAsync(AppDbContext dbContext, string name)
    {
        var org = await dbContext.Organizations.FirstOrDefaultAsync(item => item.Name == name);
        if (org is null)
        {
            org = new Organization { Name = name };
            dbContext.Organizations.Add(org);
        }

        org.Name = name;
        return org;
    }

    private static async Task<Team> EnsureTeamAsync(AppDbContext dbContext, Organization org, string name)
    {
        var team = await dbContext.Teams.FirstOrDefaultAsync(
            item => item.OrganizationId == org.Id && item.Name == name);
        if (team is null)
        {
            team = new Team { Name = name, OrganizationId = org.Id };
            dbContext.Teams.Add(team);
        }

        team.Name = name;
        team.OrganizationId = org.Id;
        return team;
    }

    private static async Task EnsureUserAsync(
        AppDbContext dbContext,
        PasswordHasher<AuthUser> hasher,
        string username,
        string role,
        string password,
        Organization organization,
        Team team)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Username == username);
        if (user is null)
        {
            user = new AuthUser { Username = username, Role = role };
            dbContext.Users.Add(user);
        }

        user.Role = role;
        user.OrganizationId = organization.Id;
        user.TeamId = team.Id;
        user.PasswordHash = hasher.HashPassword(user, password);
    }
}
