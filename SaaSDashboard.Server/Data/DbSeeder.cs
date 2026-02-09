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

        var plans = await EnsurePlansAsync(dbContext);
        await EnsureSubscriptionAsync(dbContext, org, plans);
        await EnsurePaymentMethodsAsync(dbContext, org);
        await EnsureInvoicesAsync(dbContext, org);

        await EnsureUserAsync(dbContext, hasher, "admin", adminRole.Name, "admin", org, platformTeam);
        await EnsureUserAsync(dbContext, hasher, "user", userRole.Name, "user", org, salesTeam);
        await dbContext.SaveChangesAsync();
    }

    private static async Task<List<Plan>> EnsurePlansAsync(AppDbContext dbContext)
    {
        var plans = new List<Plan>
        {
            new() { Name = "Starter", Description = "For small teams getting started.", PriceMonthly = 29, PriceYearly = 290, IsPopular = false },
            new() { Name = "Growth", Description = "For scaling product teams.", PriceMonthly = 79, PriceYearly = 790, IsPopular = true },
            new() { Name = "Enterprise", Description = "For regulated or large orgs.", PriceMonthly = 199, PriceYearly = 1990, IsPopular = false }
        };

        var resolved = new List<Plan>();

        foreach (var plan in plans)
        {
            var existing = await dbContext.Plans.FirstOrDefaultAsync(item => item.Name == plan.Name);
            if (existing is null)
            {
                dbContext.Plans.Add(plan);
                resolved.Add(plan);
            }
            else
            {
                existing.Description = plan.Description;
                existing.PriceMonthly = plan.PriceMonthly;
                existing.PriceYearly = plan.PriceYearly;
                existing.IsPopular = plan.IsPopular;
                resolved.Add(existing);
            }
        }

        return resolved;
    }

    private static async Task EnsureSubscriptionAsync(AppDbContext dbContext, Organization org, List<Plan> plans)
    {
        var plan = plans.FirstOrDefault(item => item.Name == "Growth") ?? plans.First();
        var subscription = await dbContext.Subscriptions
            .Include(item => item.Plan)
            .FirstOrDefaultAsync(item => item.OrganizationId == org.Id);

        if (subscription is null)
        {
            subscription = new Subscription
            {
                OrganizationId = org.Id,
                PlanId = plan.Id
            };
            dbContext.Subscriptions.Add(subscription);
        }

        subscription.PlanId = plan.Id;
        subscription.Status = "Active";
        subscription.BillingCycle = "Monthly";
        subscription.CurrentPeriodStart = DateTimeOffset.UtcNow.AddDays(-10);
        subscription.CurrentPeriodEnd = DateTimeOffset.UtcNow.AddDays(20);
        subscription.CancelAtPeriodEnd = false;
        subscription.SeatsUsed = 12;
        subscription.SeatsLimit = 20;
        subscription.StorageUsedGb = 45;
        subscription.StorageLimitGb = 100;
        subscription.ApiCallsUsed = 18000;
        subscription.ApiCallsLimit = 50000;
    }

    private static async Task EnsurePaymentMethodsAsync(AppDbContext dbContext, Organization org)
    {
        var existing = await dbContext.PaymentMethods
            .Where(item => item.OrganizationId == org.Id)
            .ToListAsync();

        if (existing.Count == 0)
        {
            dbContext.PaymentMethods.AddRange(
                new PaymentMethod
                {
                    OrganizationId = org.Id,
                    Brand = "Visa",
                    Last4 = "4242",
                    ExpMonth = 11,
                    ExpYear = DateTimeOffset.UtcNow.Year + 2,
                    IsDefault = true
                },
                new PaymentMethod
                {
                    OrganizationId = org.Id,
                    Brand = "Mastercard",
                    Last4 = "4444",
                    ExpMonth = 5,
                    ExpYear = DateTimeOffset.UtcNow.Year + 3,
                    IsDefault = false
                });
        }
    }

    private static async Task EnsureInvoicesAsync(AppDbContext dbContext, Organization org)
    {
        var existing = await dbContext.Invoices.AnyAsync(item => item.OrganizationId == org.Id);
        if (existing)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var invoices = new List<Invoice>();
        for (var i = 0; i < 3; i++)
        {
            var periodEnd = now.AddMonths(-i);
            var periodStart = periodEnd.AddMonths(-1);
            invoices.Add(new Invoice
            {
                OrganizationId = org.Id,
                Number = $"INV-{periodEnd:yyyyMM}-ACME",
                IssuedAt = periodEnd.AddDays(-2),
                DueAt = periodEnd.AddDays(5),
                PaidAt = periodEnd.AddDays(1),
                Amount = 79,
                Currency = "USD",
                Status = "Paid",
                PeriodStart = periodStart,
                PeriodEnd = periodEnd
            });
        }

        dbContext.Invoices.AddRange(invoices);
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
