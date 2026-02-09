namespace SaaSDashboard.Server.Data;

public class Subscription
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public Guid PlanId { get; set; }
    public Plan? Plan { get; set; }
    public string Status { get; set; } = "Active";
    public DateTimeOffset CurrentPeriodStart { get; set; }
    public DateTimeOffset CurrentPeriodEnd { get; set; }
    public bool CancelAtPeriodEnd { get; set; }
    public int SeatsUsed { get; set; }
    public int SeatsLimit { get; set; }
    public int StorageUsedGb { get; set; }
    public int StorageLimitGb { get; set; }
    public int ApiCallsUsed { get; set; }
    public int ApiCallsLimit { get; set; }
    public string BillingCycle { get; set; } = "Monthly";
}
