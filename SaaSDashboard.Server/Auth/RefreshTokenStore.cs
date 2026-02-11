using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace SaaSDashboard.Server.Auth;

public class RefreshTokenStore
{
    private readonly ConcurrentDictionary<string, RefreshToken> _tokens = new();

    public RefreshToken IssueToken(AuthUser user, int daysToExpire)
    {
        var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        var refreshToken = new RefreshToken(token, user.Id, DateTimeOffset.UtcNow.AddDays(daysToExpire));
        _tokens[token] = refreshToken;
        return refreshToken;
    }

    public RefreshToken? GetToken(string token)
    {
        return _tokens.TryGetValue(token, out var refreshToken) ? refreshToken : null;
    }

    public void Revoke(string token)
    {
        _tokens.TryRemove(token, out _);
    }
}

public record RefreshToken(string Token, Guid UserId, DateTimeOffset ExpiresAt);
