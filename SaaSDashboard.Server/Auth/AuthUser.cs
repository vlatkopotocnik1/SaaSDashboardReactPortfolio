using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Auth;

public class AuthUser
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = "User";
    public string PasswordHash { get; set; } = string.Empty;
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public Guid TeamId { get; set; }
    public Team? Team { get; set; }
}
