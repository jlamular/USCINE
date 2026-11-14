using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WatchTogether.Core.Entities;

namespace WatchTogether.Infrastructure.Data.Configurations;

public class VideoConfiguration : IEntityTypeConfiguration<Video>
{
    public void Configure(EntityTypeBuilder<Video> builder)
    {
        builder.HasKey(video => video.Id);

        builder.Property(video => video.OriginalFileName)
               .IsRequired()
               .HasMaxLength(255);

        builder.Property(video => video.StoredFileName)
               .IsRequired()
               .HasMaxLength(64);

        builder.HasIndex(video => video.StoredFileName)
               .IsUnique();

        builder.Property(video => video.ContentType)
               .IsRequired()
               .HasMaxLength(100);

        // "All videos of this room, newest first"
        builder.HasIndex(video => new { video.RoomId, video.UploadedAtUtc });

        builder.HasOne(video => video.UploadedByUser)
               .WithMany()
               .HasForeignKey(video => video.UploadedByUserId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}