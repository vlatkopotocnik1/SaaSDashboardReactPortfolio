using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public static class DbSeeder
{
    public static async Task EnsureSeededAsync(AppDbContext dbContext)
    {
        var hasher = new PasswordHasher<AuthUser>();
        await EnsureUserAsync(dbContext, hasher, "admin", "Admin", "admin");
        await EnsureUserAsync(dbContext, hasher, "user", "User", "user");
        await dbContext.SaveChangesAsync();
    }

    private static async Task EnsureUserAsync(
        AppDbContext dbContext,
        PasswordHasher<AuthUser> hasher,
        string username,
        string role,
        string password)
    {
        var user = await dbContext.Users.FirstOrDefaultAsync(item => item.Username == username);
        if (user is null)
        {
            user = new AuthUser { Username = username, Role = role };
            dbContext.Users.Add(user);
        }

        user.Role = role;
        user.PasswordHash = hasher.HashPassword(user, password);
    }
}
