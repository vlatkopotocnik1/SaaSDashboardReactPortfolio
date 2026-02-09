namespace SaaSDashboard.Server.Data;

public class Role
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<RolePermission> RolePermissions { get; set; } = [];
}
