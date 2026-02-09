namespace SaaSDashboard.Server.Data;

public class PaymentMethod
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public Guid OrganizationId { get; set; }
    public Organization? Organization { get; set; }
    public string Brand { get; set; } = "Visa";
    public string Last4 { get; set; } = "4242";
    public int ExpMonth { get; set; }
    public int ExpYear { get; set; }
    public bool IsDefault { get; set; }
}
