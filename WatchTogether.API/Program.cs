using WatchTogether.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// 1. Read the connection string from appsettings.json
string connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? throw new InvalidOperationException("Connection string 'DefaultConnection' was not found.");

// 2. Register services
builder.Services.AddInfrastructure(connectionString);
builder.Services.AddControllers();

// 3. Allow the React dev server to call this API (explained below)
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

// 4. Middleware pipeline: the order matters
app.UseCors(FrontendCorsPolicy);
app.MapControllers();

app.Run();