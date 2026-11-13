using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace WatchTogether.Infrastructure.Data;

public class UtcDateTimeConverter : ValueConverter<DateTime, DateTime>
{
    public UtcDateTimeConverter()
        : base(
            valueToSave => valueToSave.Kind == DateTimeKind.Local ? valueToSave.ToUniversalTime() : valueToSave,
            valueFromDatabase => DateTime.SpecifyKind(valueFromDatabase, DateTimeKind.Utc))
    {
    }
}