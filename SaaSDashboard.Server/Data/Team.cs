namespace SaaSDashboard.Server.Data;

public class Team
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public List<Auth.AuthUser> Users { get; set; } = [];
}
