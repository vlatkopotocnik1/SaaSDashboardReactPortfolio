using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SaaSDashboard.Server.Data;

namespace SaaSDashboard.Server.Controllers;

[ApiController]
[Route("api/billing")]
[Authorize]
public class BillingController : ControllerBase
{
    private static readonly HashSet<string> AllowedBrands = new(StringComparer.OrdinalIgnoreCase)
    {
        "Visa",
        "Mastercard",
        "Amex",
        "Discover"
    };

    private readonly AppDbContext _dbContext;

    public BillingController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("plans")]
    public async Task<ActionResult<IReadOnlyList<PlanSummary>>> GetPlans()
    {
        var plans = await _dbContext.Plans.AsNoTracking()
            .OrderBy(plan => plan.PriceMonthly)
            .Select(plan => new PlanSummary(
                plan.Id,
                plan.Name,
                plan.Description,
                plan.PriceMonthly,
                plan.PriceYearly,
                plan.IsPopular))
            .ToListAsync();

        return Ok(plans);
    }

    [HttpGet("summary")]
    public async Task<ActionResult<BillingSummary>> GetSummary([FromQuery] Guid? organizationId = null)
    {
        var resolvedOrgId = ResolveOrganizationId(organizationId);
        if (resolvedOrgId is null)
        {
            return Unauthorized();
        }

        var organization = await _dbContext.Organizations.AsNoTracking()
            .FirstOrDefaultAsync(org => org.Id == resolvedOrgId.Value);

        if (organization is null)
        {
            return NotFound();
        }

        var subscription = await _dbContext.Subscriptions.AsNoTracking()
            .Include(item => item.Plan)
            .FirstOrDefaultAsync(item => item.OrganizationId == organization.Id);

        if (subscription is null || subscription.Plan is null)
        {
            return NotFound();
        }

        var summary = new BillingSummary(
            organization.Id,
            organization.Name,
            new PlanSummary(
                subscription.Plan.Id,
                subscription.Plan.Name,
                subscription.Plan.Description,
                subscription.Plan.PriceMonthly,
                subscription.Plan.PriceYearly,
                subscription.Plan.IsPopular),
            subscription.Status,
            subscription.BillingCycle,
            subscription.CurrentPeriodStart,
            subscription.CurrentPeriodEnd,
            subscription.CancelAtPeriodEnd,
            new UsageSummary(
                subscription.SeatsUsed,
                subscription.SeatsLimit,
                subscription.StorageUsedGb,
                subscription.StorageLimitGb,
                subscription.ApiCallsUsed,
                subscription.ApiCallsLimit));

        return Ok(summary);
    }

    [HttpPost("subscribe")]
    public async Task<ActionResult<BillingSummary>> UpdateSubscription(SubscriptionRequest request)
    {
        var resolvedOrgId = ResolveOrganizationId(request.OrganizationId);
        if (resolvedOrgId is null || request.OrganizationId != resolvedOrgId.Value)
        {
            return Unauthorized();
        }

        var organization = await _dbContext.Organizations.FirstOrDefaultAsync(org => org.Id == request.OrganizationId);
        if (organization is null)
        {
            return BadRequest(new { message = "Organization not found." });
        }

        var plan = await _dbContext.Plans.FirstOrDefaultAsync(item => item.Id == request.PlanId);
        if (plan is null)
        {
            return BadRequest(new { message = "Plan not found." });
        }

        var subscription = await _dbContext.Subscriptions
            .FirstOrDefaultAsync(item => item.OrganizationId == request.OrganizationId);
        if (subscription is null)
        {
            subscription = new Subscription
            {
                OrganizationId = request.OrganizationId,
                PlanId = request.PlanId
            };
            _dbContext.Subscriptions.Add(subscription);
        }

        subscription.PlanId = request.PlanId;
        subscription.BillingCycle = request.BillingCycle;
        subscription.Status = "Active";
        subscription.CancelAtPeriodEnd = false;
        subscription.CurrentPeriodStart = DateTimeOffset.UtcNow;
        subscription.CurrentPeriodEnd = request.BillingCycle == "Yearly"
            ? DateTimeOffset.UtcNow.AddYears(1)
            : DateTimeOffset.UtcNow.AddMonths(1);

        await _dbContext.SaveChangesAsync();

        return await GetSummary(request.OrganizationId);
    }

    [HttpGet("invoices")]
    public async Task<ActionResult<IReadOnlyList<InvoiceSummary>>> GetInvoices([FromQuery] Guid? organizationId = null)
    {
        var resolvedOrgId = ResolveOrganizationId(organizationId);
        if (resolvedOrgId is null)
        {
            return Unauthorized();
        }

        var invoices = await _dbContext.Invoices.AsNoTracking()
            .Where(invoice => invoice.OrganizationId == resolvedOrgId.Value)
            .OrderByDescending(invoice => invoice.IssuedAt)
            .Select(invoice => new InvoiceSummary(
                invoice.Id,
                invoice.Number,
                invoice.IssuedAt,
                invoice.DueAt,
                invoice.PaidAt,
                invoice.Amount,
                invoice.Currency,
                invoice.Status,
                invoice.PeriodStart,
                invoice.PeriodEnd))
            .ToListAsync();

        return Ok(invoices);
    }

    [HttpGet("payment-methods")]
    public async Task<ActionResult<IReadOnlyList<PaymentMethodSummary>>> GetPaymentMethods([FromQuery] Guid? organizationId = null)
    {
        var resolvedOrgId = ResolveOrganizationId(organizationId);
        if (resolvedOrgId is null)
        {
            return Unauthorized();
        }

        var methods = await _dbContext.PaymentMethods.AsNoTracking()
            .Where(method => method.OrganizationId == resolvedOrgId.Value)
            .OrderByDescending(method => method.IsDefault)
            .Select(method => new PaymentMethodSummary(
                method.Id,
                method.Brand,
                method.Last4,
                method.ExpMonth,
                method.ExpYear,
                method.IsDefault))
            .ToListAsync();

        return Ok(methods);
    }

    [HttpPost("payment-methods")]
    public async Task<ActionResult<IReadOnlyList<PaymentMethodSummary>>> AddPaymentMethod(PaymentMethodRequest request)
    {
        var resolvedOrgId = ResolveOrganizationId(request.OrganizationId);
        if (resolvedOrgId is null || request.OrganizationId != resolvedOrgId.Value)
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Brand) || !AllowedBrands.Contains(request.Brand))
        {
            return BadRequest(new { message = "Card brand is not supported." });
        }

        if (request.Last4.Length != 4 || request.Last4.Any(ch => !char.IsDigit(ch)))
        {
            return BadRequest(new { message = "Payment method is invalid." });
        }

        if (request.ExpMonth < 1 || request.ExpMonth > 12)
        {
            return BadRequest(new { message = "Expiration month is invalid." });
        }

        if (request.ExpYear < DateTimeOffset.UtcNow.Year)
        {
            return BadRequest(new { message = "Expiration year is invalid." });
        }

        var method = new PaymentMethod
        {
            OrganizationId = request.OrganizationId,
            Brand = request.Brand.Trim(),
            Last4 = request.Last4.Trim(),
            ExpMonth = request.ExpMonth,
            ExpYear = request.ExpYear,
            IsDefault = request.IsDefault
        };

        _dbContext.PaymentMethods.Add(method);

        if (request.IsDefault)
        {
            var others = await _dbContext.PaymentMethods
                .Where(item => item.OrganizationId == request.OrganizationId && item.Id != method.Id)
                .ToListAsync();
            foreach (var item in others)
            {
                item.IsDefault = false;
            }
        }

        await _dbContext.SaveChangesAsync();

        return await GetPaymentMethods();
    }

    [HttpGet("invoices/{id:guid}/download")]
    public async Task<IActionResult> DownloadInvoice(Guid id, [FromQuery] Guid? organizationId = null)
    {
        var resolvedOrgId = ResolveOrganizationId(organizationId);
        if (resolvedOrgId is null)
        {
            return Unauthorized();
        }

        var invoice = await _dbContext.Invoices.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == id && item.OrganizationId == resolvedOrgId.Value);
        if (invoice is null)
        {
            return NotFound();
        }

        var content = $"Invoice {invoice.Number}\n" +
                      $"Status: {invoice.Status}\n" +
                      $"Amount: {invoice.Currency} {invoice.Amount:F2}\n" +
                      $"Issued: {invoice.IssuedAt:yyyy-MM-dd}\n" +
                      $"Period: {invoice.PeriodStart:yyyy-MM-dd} - {invoice.PeriodEnd:yyyy-MM-dd}\n";

        var bytes = System.Text.Encoding.UTF8.GetBytes(content);
        return File(bytes, "text/plain", $"{invoice.Number}.txt");
    }

    private Guid? GetOrganizationId()
    {
        var value = User.FindFirst("orgId")?.Value;
        if (Guid.TryParse(value, out var orgId))
        {
            return orgId;
        }

        return null;
    }

    private Guid? ResolveOrganizationId(Guid? requestedOrgId)
    {
        var tokenOrgId = GetOrganizationId();
        if (requestedOrgId is null)
        {
            return tokenOrgId;
        }

        if (User.IsInRole("Admin"))
        {
            return requestedOrgId;
        }

        return tokenOrgId == requestedOrgId ? requestedOrgId : null;
    }
}

public record PlanSummary(Guid Id, string Name, string Description, decimal PriceMonthly, decimal PriceYearly, bool IsPopular);
public record UsageSummary(int SeatsUsed, int SeatsLimit, int StorageUsedGb, int StorageLimitGb, int ApiCallsUsed, int ApiCallsLimit);
public record BillingSummary(
    Guid OrganizationId,
    string OrganizationName,
    PlanSummary CurrentPlan,
    string Status,
    string BillingCycle,
    DateTimeOffset CurrentPeriodStart,
    DateTimeOffset CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    UsageSummary Usage);
public record SubscriptionRequest(Guid OrganizationId, Guid PlanId, string BillingCycle);
public record InvoiceSummary(
    Guid Id,
    string Number,
    DateTimeOffset IssuedAt,
    DateTimeOffset DueAt,
    DateTimeOffset? PaidAt,
    decimal Amount,
    string Currency,
    string Status,
    DateTimeOffset PeriodStart,
    DateTimeOffset PeriodEnd);
public record PaymentMethodSummary(Guid Id, string Brand, string Last4, int ExpMonth, int ExpYear, bool IsDefault);
public record PaymentMethodRequest(Guid OrganizationId, string Brand, string Last4, int ExpMonth, int ExpYear, bool IsDefault);
