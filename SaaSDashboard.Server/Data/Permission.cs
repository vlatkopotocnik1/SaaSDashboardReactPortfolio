namespace SaaSDashboard.Server.Data;

public class Permission
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<RolePermission> RolePermissions { get; set; } = [];
}
