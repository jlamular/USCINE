using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using WatchTogether.API.DTOs;
using WatchTogether.API.Middleware;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Services;
using WatchTogether.Infrastructure;
using WatchTogether.Infrastructure.Settings;

var builder = WebApplication.CreateBuilder(args);

// 1. Read configuration
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

JwtSettings jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>()
    ?? throw new InvalidOperationException("The 'Jwt' section is missing from configuration.");

if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
{
    throw new InvalidOperationException(
        "Jwt:SecretKey is missing or too short. Set it with 'dotnet user-secrets' (at least 32 characters).");
}

// 2. Register services
builder.Services.AddInfrastructure(connectionString, jwtSettings);
builder.Services.AddScoped<IAuthService, AuthService>();

builder.Services
    .AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // Make automatic validation errors use the same { "errors": [...] } shape as the rest of the API
        options.InvalidModelStateResponseFactory = context =>
        {
            List<string> errors = context.ModelState.Values
                .SelectMany(entry => entry.Errors)
                .Select(error => error.ErrorMessage)
                .Where(message => !string.IsNullOrWhiteSpace(message))
                .ToList();

            if (errors.Count == 0)
            {
                errors.Add("The request is invalid.");
            }

            return new BadRequestObjectResult(new ErrorResponseDto { Errors = errors });
        };
    });

// 3. Authentication: how incoming JWTs are validated
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30)
        };
    });

builder.Services.AddAuthorization();

// 4. CORS: allow the React dev server
const string FrontendCorsPolicy = "FrontendCorsPolicy";
builder.Services.AddCors(options =>
{
    options.AddPolicy(FrontendCorsPolicy, policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 5. Middleware pipeline: the order matters
app.UseMiddleware<ExceptionHandlingMiddleware>();
app.UseCors(FrontendCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();