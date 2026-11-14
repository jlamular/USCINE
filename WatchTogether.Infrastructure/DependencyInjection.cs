using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Infrastructure.Data;
using WatchTogether.Infrastructure.Repositories;
using WatchTogether.Infrastructure.Services;
using WatchTogether.Infrastructure.Settings;

namespace WatchTogether.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services,
        string connectionString,
        JwtSettings jwtSettings,
        StorageSettings storageSettings)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseSqlServer(connectionString));

        services.AddSingleton(jwtSettings);
        services.AddSingleton(storageSettings);

        services.AddScoped<ITokenService, JwtTokenService>();
        services.AddScoped<IRoomRepository, RoomRepository>();
        services.AddScoped<IVideoRepository, VideoRepository>();
        services.AddSingleton<IVideoStorage, LocalVideoStorage>();

        services.AddIdentityCore<ApplicationUser>(options =>
            {
                options.User.RequireUniqueEmail = true;

                options.Password.RequiredLength = 8;
                options.Password.RequireDigit = true;
                options.Password.RequireLowercase = true;
                options.Password.RequireUppercase = false;
                options.Password.RequireNonAlphanumeric = false;

                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddEntityFrameworkStores<AppDbContext>();

        return services;
    }
}