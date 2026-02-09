namespace SaaSDashboard.Server.Data;

public class Organization
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public List<Team> Teams { get; set; } = [];
}
