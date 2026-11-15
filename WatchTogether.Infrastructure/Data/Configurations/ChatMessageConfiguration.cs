using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WatchTogether.Core.Entities;

namespace WatchTogether.Infrastructure.Data.Configurations;

public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.HasKey(message => message.Id);

        builder.Property(message => message.Text)
               .IsRequired()
               .HasMaxLength(1000);

        // "The latest messages of this room" and "messages newer than X": both use this index
        builder.HasIndex(message => new { message.RoomId, message.Id });

        // Cascade: deleting a room deletes its chat
        builder.HasOne(message => message.Room)
               .WithMany()
               .HasForeignKey(message => message.RoomId)
               .OnDelete(DeleteBehavior.Cascade);

        // Restrict: deleting a user must never silently delete messages
        builder.HasOne(message => message.User)
               .WithMany()
               .HasForeignKey(message => message.UserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}