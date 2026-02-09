namespace SaaSDashboard.Server.Data;

public class Plan
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public decimal PriceMonthly { get; set; }
    public decimal PriceYearly { get; set; }
    public bool IsPopular { get; set; }
    public List<Subscription> Subscriptions { get; set; } = [];
}
