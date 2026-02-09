using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/organizations")]
[Authorize(Roles = "Admin")]
public class OrganizationsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public OrganizationsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<OrganizationListItem>>> GetOrganizations(
        [FromQuery] bool includeTeams = false)
    {
        var organizations = await _dbContext.Organizations.AsNoTracking()
            .OrderBy(org => org.Name)
            .Select(org => new OrganizationListItem(
                org.Id,
                org.Name,
                org.Teams.Count,
                _dbContext.Users.Count(user => user.OrganizationId == org.Id),
                includeTeams
                    ? org.Teams
                        .OrderBy(team => team.Name)
                        .Select(team => new TeamListItem(team.Id, team.Name,
                            _dbContext.Users.Count(user => user.TeamId == team.Id)))
                        .ToList()
                    : null))
            .ToListAsync();

        return Ok(organizations);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<OrganizationDetail>> GetOrganization(Guid id)
    {
        var organization = await _dbContext.Organizations.AsNoTracking()
            .Where(org => org.Id == id)
            .Select(org => new OrganizationDetail(
                org.Id,
                org.Name,
                org.Teams
                    .OrderBy(team => team.Name)
                    .Select(team => new TeamListItem(team.Id, team.Name,
                        _dbContext.Users.Count(user => user.TeamId == team.Id)))
                    .ToList()))
            .SingleOrDefaultAsync();

        if (organization is null)
        {
            return NotFound();
        }

        return Ok(organization);
    }

    [HttpPost]
    public async Task<ActionResult<OrganizationSummary>> CreateOrganization(OrganizationRequest request)
    {
        var validationError = ValidateName(request.Name);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Organizations.AnyAsync(org => org.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Organization name is already in use." });
        }

        var organization = new Organization { Name = request.Name.Trim() };
        _dbContext.Organizations.Add(organization);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrganization), new { id = organization.Id },
            new OrganizationSummary(organization.Id, organization.Name));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<OrganizationSummary>> UpdateOrganization(Guid id, OrganizationRequest request)
    {
        var validationError = ValidateName(request.Name);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var organization = await _dbContext.Organizations.SingleOrDefaultAsync(org => org.Id == id);
        if (organization is null)
        {
            return NotFound();
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Organizations.AnyAsync(
            org => org.Id != id && org.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Organization name is already in use." });
        }

        organization.Name = request.Name.Trim();
        await _dbContext.SaveChangesAsync();

        return Ok(new OrganizationSummary(organization.Id, organization.Name));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteOrganization(Guid id)
    {
        var organization = await _dbContext.Organizations.SingleOrDefaultAsync(org => org.Id == id);
        if (organization is null)
        {
            return NotFound();
        }

        var hasTeams = await _dbContext.Teams.AnyAsync(team => team.OrganizationId == id);
        if (hasTeams)
        {
            return Conflict(new { message = "Delete teams before removing the organization." });
        }

        var hasUsers = await _dbContext.Users.AnyAsync(user => user.OrganizationId == id);
        if (hasUsers)
        {
            return Conflict(new { message = "Reassign users before removing the organization." });
        }

        _dbContext.Organizations.Remove(organization);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{organizationId:guid}/teams")]
    public async Task<ActionResult<TeamSummary>> CreateTeam(Guid organizationId, TeamRequest request)
    {
        var validationError = ValidateName(request.Name);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var organization = await _dbContext.Organizations.SingleOrDefaultAsync(org => org.Id == organizationId);
        if (organization is null)
        {
            return NotFound();
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Teams.AnyAsync(
            team => team.OrganizationId == organizationId && team.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Team name is already in use for this organization." });
        }

        var team = new Team { Name = request.Name.Trim(), OrganizationId = organizationId };
        _dbContext.Teams.Add(team);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetOrganization), new { id = organizationId }, new TeamSummary(team.Id, team.Name));
    }

    [HttpPut("teams/{id:guid}")]
    public async Task<ActionResult<TeamSummary>> UpdateTeam(Guid id, TeamRequest request)
    {
        var validationError = ValidateName(request.Name);
        if (validationError is not null)
        {
            return BadRequest(new { message = validationError });
        }

        var team = await _dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id);
        if (team is null)
        {
            return NotFound();
        }

        var normalized = request.Name.Trim().ToLower();
        var exists = await _dbContext.Teams.AnyAsync(
            item => item.Id != id && item.OrganizationId == team.OrganizationId && item.Name.ToLower() == normalized);
        if (exists)
        {
            return Conflict(new { message = "Team name is already in use for this organization." });
        }

        team.Name = request.Name.Trim();
        await _dbContext.SaveChangesAsync();

        return Ok(new TeamSummary(team.Id, team.Name));
    }

    [HttpDelete("teams/{id:guid}")]
    public async Task<IActionResult> DeleteTeam(Guid id)
    {
        var team = await _dbContext.Teams.SingleOrDefaultAsync(item => item.Id == id);
        if (team is null)
        {
            return NotFound();
        }

        var hasUsers = await _dbContext.Users.AnyAsync(user => user.TeamId == id);
        if (hasUsers)
        {
            return Conflict(new { message = "Reassign users before removing the team." });
        }

        _dbContext.Teams.Remove(team);
        await _dbContext.SaveChangesAsync();
        return NoContent();
    }

    private static string? ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return "Name is required.";
        }

        if (name.Length < 2 || name.Length > 64)
        {
            return "Name must be between 2 and 64 characters.";
        }

        return null;
    }
}

public record OrganizationListItem(
    Guid Id,
    string Name,
    int TeamCount,
    int UserCount,
    IReadOnlyList<TeamListItem>? Teams);

public record OrganizationDetail(Guid Id, string Name, IReadOnlyList<TeamListItem> Teams);
public record OrganizationSummary(Guid Id, string Name);
public record TeamListItem(Guid Id, string Name, int UserCount);
public record TeamSummary(Guid Id, string Name);
public record OrganizationRequest(string Name);
public record TeamRequest(string Name);
