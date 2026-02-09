using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace SaaSDashboard.Server.Tests;

public class AuthFlowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public AuthFlowTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task WeatherForecast_requires_authentication()
    {
        var response = await _client.GetAsync("/WeatherForecast");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task WeatherForecast_requires_admin_role()
    {
        var loginResponse = await Login("user", "user");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/WeatherForecast");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginResponse.AccessToken);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_can_access_weather_forecast()
    {
        var loginResponse = await Login("admin", "admin");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/WeatherForecast");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginResponse.AccessToken);
        var response = await _client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    private async Task<AuthResponse> Login(string username, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, password));
        response.EnsureSuccessStatusCode();
        var data = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return data ?? throw new InvalidOperationException("Missing auth response.");
    }
}

public record LoginRequest(string Username, string Password);
public record AuthResponse(string AccessToken, string RefreshToken, UserResponse User);
public record UserResponse(string Username, string Role);
