using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "Admin")]
public class AuditLogsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public AuditLogsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<AuditLogPage>> GetAuditLogs(
        [FromQuery] Guid? organizationId = null,
        [FromQuery] string? user = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = BuildQuery(organizationId, user, action, from, to);

        var safePage = Math.Max(1, page);
        var safePageSize = Math.Clamp(pageSize, 5, 100);
        var totalCount = await query.CountAsync();

        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .Skip((safePage - 1) * safePageSize)
            .Take(safePageSize)
            .Select(item => new AuditLogSummary(
                item.Id,
                item.CreatedAt,
                item.Username,
                item.Action))
            .ToListAsync();

        return Ok(new AuditLogPage(items, totalCount));
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAuditLogs(
        [FromQuery] Guid? organizationId = null,
        [FromQuery] string? user = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? from = null,
        [FromQuery] DateTime? to = null)
    {
        var query = BuildQuery(organizationId, user, action, from, to);
        var items = await query
            .OrderByDescending(item => item.CreatedAt)
            .Select(item => new AuditLogSummary(
                item.Id,
                item.CreatedAt,
                item.Username,
                item.Action))
            .ToListAsync();

        var lines = new List<string> { "time,user,action" };
        foreach (var item in items)
        {
            lines.Add($"{Escape(item.Time.UtcDateTime.ToString("O"))},{Escape(item.User)},{Escape(item.Action)}");
        }

        var content = string.Join("\n", lines);
        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        return File(bytes, "text/csv", $"audit-logs-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private IQueryable<AuditLog> BuildQuery(Guid? organizationId, string? user, string? action, DateTime? from, DateTime? to)
    {
        var query = _dbContext.AuditLogs.AsNoTracking();
        if (organizationId is not null)
        {
            query = query.Where(item => item.OrganizationId == organizationId.Value);
        }

        if (!string.IsNullOrWhiteSpace(user))
        {
            var needle = user.Trim().ToLower();
            query = query.Where(item => item.Username.ToLower().Contains(needle));
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            var needle = action.Trim().ToLower();
            query = query.Where(item => item.Action.ToLower().Contains(needle));
        }

        if (from is not null)
        {
            var fromDate = new DateTimeOffset(DateTime.SpecifyKind(from.Value.Date, DateTimeKind.Utc));
            query = query.Where(item => item.CreatedAt >= fromDate);
        }

        if (to is not null)
        {
            var toDate = new DateTimeOffset(DateTime.SpecifyKind(to.Value.Date.AddDays(1), DateTimeKind.Utc));
            query = query.Where(item => item.CreatedAt < toDate);
        }

        return query;
    }

    private static string Escape(string value)
    {
        var escaped = value.Replace("\"", "\"\"");
        return $"\"{escaped}\"";
    }
}

public record AuditLogSummary(Guid Id, DateTimeOffset Time, string User, string Action);
public record AuditLogPage(IReadOnlyList<AuditLogSummary> Items, int TotalCount);
