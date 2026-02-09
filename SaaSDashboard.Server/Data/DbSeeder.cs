using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public static class DbSeeder
{
    public static async Task EnsureSeededAsync(AppDbContext dbContext)
    {
        var hasher = new PasswordHasher<AuthUser>();
        var org = await EnsureOrganizationAsync(dbContext, "Acme Corp");
        var platformTeam = await EnsureTeamAsync(dbContext, org, "Platform");
        var salesTeam = await EnsureTeamAsync(dbContext, org, "Sales");

        await EnsureUserAsync(dbContext, hasher, "admin", "Admin", "admin", org, platformTeam);
        await EnsureUserAsync(dbContext, hasher, "user", "User", "user", org, salesTeam);
        await dbContext.SaveChangesAsync();
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
