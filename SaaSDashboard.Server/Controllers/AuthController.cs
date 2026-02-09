using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using SaaSDashboard.Server.Auth;
using System.IdentityModel.Tokens.Jwt;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AuthUserStore _userStore;
    private readonly RefreshTokenStore _refreshTokenStore;
    private readonly TokenService _tokenService;
    private readonly JwtOptions _options;

    public AuthController(
        AuthUserStore userStore,
        RefreshTokenStore refreshTokenStore,
        TokenService tokenService,
        IOptions<JwtOptions> options)
    {
        _userStore = userStore;
        _refreshTokenStore = refreshTokenStore;
        _tokenService = tokenService;
        _options = options.Value;
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var user = await _userStore.ValidateCredentials(request.Username, request.Password);
        if (user is null)
        {
            return Unauthorized();
        }

        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> Refresh(RefreshRequest request)
    {
        var token = _refreshTokenStore.GetToken(request.RefreshToken);
        if (token is null || token.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            if (token is not null)
            {
                _refreshTokenStore.Revoke(token.Token);
            }
            return Unauthorized();
        }

        var user = await _userStore.FindById(token.UserId);
        if (user is null)
        {
            _refreshTokenStore.Revoke(token.Token);
            return Unauthorized();
        }

        _refreshTokenStore.Revoke(token.Token);
        return Ok(CreateAuthResponse(user));
    }

    [HttpPost("logout")]
    public IActionResult Logout(RefreshRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            _refreshTokenStore.Revoke(request.RefreshToken);
        }

        return Ok();
    }

    [Authorize]
    [HttpGet("me")]
    public ActionResult<UserResponse> Me()
    {
        var username = User.FindFirst("username")?.Value ?? string.Empty;
        var role = User.FindFirst("role")?.Value ?? "User";
        return Ok(new UserResponse(username, role));
    }

    private AuthResponse CreateAuthResponse(AuthUser user)
    {
        var accessToken = _tokenService.CreateAccessToken(user);
        var refreshToken = _refreshTokenStore.IssueToken(user, _options.RefreshTokenDays);
        return new AuthResponse(accessToken, refreshToken.Token, new UserResponse(user.Username, user.Role));
    }
}

public record LoginRequest(string Username, string Password);
public record RefreshRequest(string RefreshToken);
public record AuthResponse(string AccessToken, string RefreshToken, UserResponse User);
public record UserResponse(string Username, string Role);
