using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Auth;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/users")]
[Authorize(Roles = "Admin")]
public class UsersController : ControllerBase
{
    private const int MaxPageSize = 100;
    private readonly AppDbContext _dbContext;
    private readonly PasswordHasher<AuthUser> _passwordHasher = new();

    public UsersController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResponse<UserListItem>>> GetUsers(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        [FromQuery] string? search = null,
        [FromQuery] string? role = null,
        [FromQuery] Guid? organizationId = null,
        [FromQuery] Guid? teamId = null)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = _dbContext.Users.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = search.Trim().ToLower();
            query = query.Where(user => user.Username.ToLower().Contains(normalized));
        }

        if (!string.IsNullOrWhiteSpace(role))
        {
            query = query.Where(user => user.Role == role);
        }

        if (organizationId.HasValue)
        {
            query = query.Where(user => user.OrganizationId == organizationId.Value);
        }

        if (teamId.HasValue)
        {
            query = query.Where(user => user.TeamId == teamId.Value);
        }

        var totalCount = await query.CountAsync();
        var items = await query
            .Include(user => user.Organization)
            .Include(user => user.Team)
            .OrderBy(user => user.Username)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(user => new UserListItem(
                user.Id,
                user.Username,
                user.Role,
                user.OrganizationId,
                user.Organization!.Name,
                user.TeamId,
                user.Team!.Name))
            .ToListAsync();

        return Ok(new PagedResponse<UserListItem>(items, totalCount, page, pageSize));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserListItem>> GetUser(Guid id)
    {
        var user = await _dbContext.Users.AsNoTracking()
            .Where(item => item.Id == id)
            .Select(item => new UserListItem(
                item.Id,
                item.Username,
                item.Role,
                item.OrganizationId,
                item.Organization!.Name,
                item.TeamId,
                item.Team!.Name))
            .SingleOrDefaultAsync();

        if (user is null)
        {
            return NotFound();
        }

        return Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserListItem>> CreateUser(UserCreateRequest request)
    {
        var validationError = ValidateRequest(request.Username, request.Role, request.Password, request.OrganizationId, request.TeamId);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var roleValidation = await ValidateRoleAsync(request.Role);
        if (roleValidation is not null)
        {
            return BadRequest(new { message = roleValidation });
        }

        var normalized = request.Username.Trim().ToLower();
        var exists = await _dbContext.Users.AnyAsync(user => user.Username.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Username is already in use." });
        }

        var teamValidation = await ValidateOrganizationTeamAsync(request.OrganizationId, request.TeamId);
        if (teamValidation is not null)
        {
            return BadRequest(new { message = teamValidation });
        }

        var user = new AuthUser
        {
            Username = request.Username.Trim(),
            Role = request.Role,
            OrganizationId = request.OrganizationId,
            TeamId = request.TeamId
        };
        user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);

        _dbContext.Users.Add(user);
        await _dbContext.SaveChangesAsync();

        var orgName = await _dbContext.Organizations
            .Where(item => item.Id == user.OrganizationId)
            .Select(item => item.Name)
            .SingleAsync();
        var teamName = await _dbContext.Teams
            .Where(item => item.Id == user.TeamId)
            .Select(item => item.Name)
            .SingleAsync();

        return CreatedAtAction(
            nameof(GetUser),
            new { id = user.Id },
            new UserListItem(user.Id, user.Username, user.Role, user.OrganizationId, orgName, user.TeamId, teamName));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UserListItem>> UpdateUser(Guid id, UserUpdateRequest request)
    {
        var validationError = ValidateRequest(
            request.Username,
            request.Role,
            request.Password,
            request.OrganizationId,
            request.TeamId,
            allowEmptyPassword: true);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var roleValidation = await ValidateRoleAsync(request.Role);
        if (roleValidation is not null)
        {
            return BadRequest(new { message = roleValidation });
        }

        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == id);
        if (user is null)
        {
            return NotFound();
        }

        var normalized = request.Username.Trim().ToLower();
        var duplicate = await _dbContext.Users.AnyAsync(
            item => item.Id != id && item.Username.ToLower() == normalized);
        if (duplicate)
        {
            return Conflict(new { message = "Username is already in use." });
        }

        var teamValidation = await ValidateOrganizationTeamAsync(request.OrganizationId, request.TeamId);
        if (teamValidation is not null)
        {
            return BadRequest(new { message = teamValidation });
        }

        user.Username = request.Username.Trim();
        user.Role = request.Role;
        user.OrganizationId = request.OrganizationId;
        user.TeamId = request.TeamId;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = _passwordHasher.HashPassword(user, request.Password);
        }

        await _dbContext.SaveChangesAsync();

        var orgName = await _dbContext.Organizations
            .Where(item => item.Id == user.OrganizationId)
            .Select(item => item.Name)
            .SingleAsync();
        var teamName = await _dbContext.Teams
            .Where(item => item.Id == user.TeamId)
            .Select(item => item.Name)
            .SingleAsync();

        return Ok(new UserListItem(user.Id, user.Username, user.Role, user.OrganizationId, orgName, user.TeamId, teamName));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteUser(Guid id)
    {
        var user = await _dbContext.Users.SingleOrDefaultAsync(item => item.Id == id);
        if (user is null)
        {
            return NotFound();
        }

        _dbContext.Users.Remove(user);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static string? ValidateRequest(
        string username,
        string role,
        string? password,
        Guid organizationId,
        Guid teamId,
        bool allowEmptyPassword = false)
    {
        if (string.IsNullOrWhiteSpace(username))
        {
            return "Username is required.";
        }

        if (username.Length < 3 || username.Length > 32)
        {
            return "Username must be between 3 and 32 characters.";
        }

        if (role is not ("Admin" or "User"))
        {
            return "Role must be Admin or User.";
        }

        if (organizationId == Guid.Empty)
        {
            return "Organization is required.";
        }

        if (teamId == Guid.Empty)
        {
            return "Team is required.";
        }

        if (allowEmptyPassword && string.IsNullOrWhiteSpace(password))
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            return "Password is required.";
        }

        if (password.Length < 6 || password.Length > 64)
        {
            return "Password must be between 6 and 64 characters.";
        }

        return null;
    }

    private async Task<string?> ValidateOrganizationTeamAsync(Guid organizationId, Guid teamId)
    {
        var orgExists = await _dbContext.Organizations.AnyAsync(item => item.Id == organizationId);
        if (!orgExists)
        {
            return "Organization not found.";
        }

        var teamExists = await _dbContext.Teams.AnyAsync(
            item => item.Id == teamId && item.OrganizationId == organizationId);
        if (!teamExists)
        {
            return "Team not found for organization.";
        }

        return null;
    }

    private async Task<string?> ValidateRoleAsync(string role)
    {
        var exists = await _dbContext.Roles.AnyAsync(item => item.Name == role);
        if (!exists)
        {
            return "Role not found.";
        }

        return null;
    }
}

public record UserListItem(
    Guid Id,
    string Username,
    string Role,
    Guid OrganizationId,
    string OrganizationName,
    Guid TeamId,
    string TeamName);
public record PagedResponse<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);
public record UserCreateRequest(string Username, string Role, string Password, Guid OrganizationId, Guid TeamId);
public record UserUpdateRequest(string Username, string Role, string? Password, Guid OrganizationId, Guid TeamId);
