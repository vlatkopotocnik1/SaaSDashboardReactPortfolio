using SaaSDashboard.Server.Auth;

namespace SaaSDashboard.Server.Data;

public class AuditLog
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public Guid? UserId { get; set; }
    public AuthUser? User { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
