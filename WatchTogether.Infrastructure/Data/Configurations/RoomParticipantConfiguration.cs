using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WatchTogether.Core.Entities;

namespace WatchTogether.Infrastructure.Data.Configurations;

public class RoomParticipantConfiguration : IEntityTypeConfiguration<RoomParticipant>
{
    public void Configure(EntityTypeBuilder<RoomParticipant> builder)
    {
        builder.HasKey(participant => participant.Id);

        // Stored as readable text ("Host", "Participant") instead of numbers
        builder.Property(participant => participant.Role)
               .HasConversion<string>()
               .HasMaxLength(20)
               .IsRequired();

        // One membership per user per room
        builder.HasIndex(participant => new { participant.RoomId, participant.UserId })
               .IsUnique();

        // Speeds up "which rooms am I in?"
        builder.HasIndex(participant => participant.UserId);

        // Restrict here too: SQL Server rejects schemas with several cascade paths to the same table
        builder.HasOne(participant => participant.User)
               .WithMany()
               .HasForeignKey(participant => participant.UserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}