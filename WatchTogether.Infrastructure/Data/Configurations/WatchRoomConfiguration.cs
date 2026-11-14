using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WatchTogether.Core.Entities;
using WatchTogether.Core.Services;

namespace WatchTogether.Infrastructure.Data.Configurations;

public class WatchRoomConfiguration : IEntityTypeConfiguration<WatchRoom>
{
    public void Configure(EntityTypeBuilder<WatchRoom> builder)
    {
        builder.HasKey(room => room.Id);

        builder.Property(room => room.RoomCode)
               .IsRequired()
               .HasMaxLength(RoomCodeGenerator.CodeLength);

        builder.HasIndex(room => room.RoomCode)
               .IsUnique();

        builder.Property(room => room.RoomName)
               .IsRequired()
               .HasMaxLength(50);

        // Restrict: deleting a user must never silently delete their rooms
        builder.HasOne(room => room.HostUser)
               .WithMany()
               .HasForeignKey(room => room.HostUserId)
               .OnDelete(DeleteBehavior.Restrict);

        // Cascade: deleting a room removes its memberships
        builder.HasMany(room => room.Participants)
               .WithOne(participant => participant.Room)
               .HasForeignKey(participant => participant.RoomId)
               .OnDelete(DeleteBehavior.Cascade);

        // Cascade: deleting a room removes its video records (the files are removed by RoomService)
        builder.HasMany(room => room.Videos)
               .WithOne(video => video.Room)
               .HasForeignKey(video => video.RoomId)
               .OnDelete(DeleteBehavior.Cascade);

        // The video being shown. This must NOT cascade: SQL Server rejects a cascade loop between
        // rooms and videos. RoomService clears it before a video is deleted.
        builder.HasOne(room => room.CurrentVideo)
               .WithMany()
               .HasForeignKey(room => room.CurrentVideoId)
               .OnDelete(DeleteBehavior.Restrict);

               // Makes EF refuse to overwrite a playback change it has not seen (see PlaybackService)
        builder.Property(room => room.PlaybackVersion).IsConcurrencyToken();
    }
}