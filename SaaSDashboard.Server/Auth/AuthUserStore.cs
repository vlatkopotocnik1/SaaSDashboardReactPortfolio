using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Auth;

public class AuthUserStore
{
    private readonly AppDbContext _dbContext;
    private readonly PasswordHasher<AuthUser> _passwordHasher = new();

    public AuthUserStore(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<AuthUser?> ValidateCredentials(string username, string password)
    {
        var normalized = username.ToLower();
        var user = await _dbContext.Users.SingleOrDefaultAsync(
            item => item.Username.ToLower() == normalized);
        if (user is null)
        {
            return null;
        }

        var result = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, password);
        return result == PasswordVerificationResult.Success ? user : null;
    }

    public Task<AuthUser?> FindById(Guid id)
    {
        return _dbContext.Users.SingleOrDefaultAsync(user => user.Id == id);
    }
}
