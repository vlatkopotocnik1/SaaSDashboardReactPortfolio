using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/roles")]
[Authorize(Roles = "Admin")]
public class RolesController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public RolesController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<RoleSummary>>> GetRoles()
    {
        var roles = await _dbContext.Roles.AsNoTracking()
            .OrderBy(role => role.Name)
            .Select(role => new RoleSummary(
                role.Id,
                role.Name,
                role.Description,
                role.RolePermissions.Select(item => item.Permission!.Key).ToList()))
            .ToListAsync();

        return Ok(roles);
    }

    [HttpGet("permissions")]
    public async Task<ActionResult<IReadOnlyList<PermissionSummary>>> GetPermissions()
    {
        var permissions = await _dbContext.Permissions.AsNoTracking()
            .OrderBy(permission => permission.Label)
            .Select(permission => new PermissionSummary(
                permission.Id,
                permission.Key,
                permission.Label,
                permission.Description))
            .ToListAsync();

        return Ok(permissions);
    }

    [HttpPost]
    public async Task<ActionResult<RoleSummary>> CreateRole(RoleRequest request)
    {
        var validationError = ValidateRoleRequest(request);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Roles.AnyAsync(role => role.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Role name is already in use." });
        }

        var permissionIds = await ResolvePermissionIdsAsync(request.PermissionKeys);
        if (permissionIds is null)
        {
            return BadRequest(new { message = "One or more permissions are invalid." });
        }

        var role = new Role { Name = request.Name.Trim(), Description = request.Description?.Trim() ?? string.Empty };
        role.RolePermissions = permissionIds
            .Select(permissionId => new RolePermission { RoleId = role.Id, PermissionId = permissionId })
            .ToList();

        _dbContext.Roles.Add(role);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRoles), new RoleSummary(role.Id, role.Name, role.Description, request.PermissionKeys));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RoleSummary>> UpdateRole(Guid id, RoleRequest request)
    {
        var validationError = ValidateRoleRequest(request);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var role = await _dbContext.Roles
            .Include(item => item.RolePermissions)
            .SingleOrDefaultAsync(item => item.Id == id);
        if (role is null)
        {
            return NotFound();
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Roles.AnyAsync(
            item => item.Id != id && item.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Role name is already in use." });
        }

        var permissionIds = await ResolvePermissionIdsAsync(request.PermissionKeys);
        if (permissionIds is null)
        {
            return BadRequest(new { message = "One or more permissions are invalid." });
        }

        role.Name = request.Name.Trim();
        role.Description = request.Description?.Trim() ?? string.Empty;

        role.RolePermissions.RemoveAll(item => !permissionIds.Contains(item.PermissionId));
        foreach (var permissionId in permissionIds)
        {
            if (!role.RolePermissions.Any(item => item.PermissionId == permissionId))
            {
                role.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permissionId });
            }
        }

        await _dbContext.SaveChangesAsync();

        return Ok(new RoleSummary(role.Id, role.Name, role.Description, request.PermissionKeys));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRole(Guid id)
    {
        var role = await _dbContext.Roles.SingleOrDefaultAsync(item => item.Id == id);
        if (role is null)
        {
            return NotFound();
        }

        var hasUsers = await _dbContext.Users.AnyAsync(user => user.Role == role.Name);
        if (hasUsers)
        {
            return Conflict(new { message = "Reassign users before deleting this role." });
        }

        _dbContext.Roles.Remove(role);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private async Task<HashSet<Guid>?> ResolvePermissionIdsAsync(IReadOnlyList<string> permissionKeys)
    {
        var keys = permissionKeys.Select(item => item.Trim()).Where(item => item.Length > 0).ToList();
        var permissions = await _dbContext.Permissions
            .Where(item => keys.Contains(item.Key))
            .Select(item => item.Id)
            .ToListAsync();

        if (permissions.Count != keys.Count)
        {
            return null;
        }

        return permissions.ToHashSet();
    }

    private static string? ValidateRoleRequest(RoleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return "Role name is required.";
        }

        if (request.Name.Length < 2 || request.Name.Length > 48)
        {
            return "Role name must be between 2 and 48 characters.";
        }

        if (request.PermissionKeys.Count == 0)
        {
            return "Select at least one permission.";
        }

        return null;
    }
}

public record RoleSummary(Guid Id, string Name, string Description, IReadOnlyList<string> PermissionKeys);
public record PermissionSummary(Guid Id, string Key, string Label, string Description);
public record RoleRequest(string Name, string? Description, IReadOnlyList<string> PermissionKeys);
