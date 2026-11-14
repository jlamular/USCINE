using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchTogether.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddPlaybackState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPlaying",
                table: "WatchRooms",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<double>(
                name: "PlaybackPositionSeconds",
                table: "WatchRooms",
                type: "float",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<DateTime>(
                name: "PlaybackUpdatedAtUtc",
                table: "WatchRooms",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<long>(
                name: "PlaybackVersion",
                table: "WatchRooms",
                type: "bigint",
                nullable: false,
                defaultValue: 0L);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsPlaying",
                table: "WatchRooms");

            migrationBuilder.DropColumn(
                name: "PlaybackPositionSeconds",
                table: "WatchRooms");

            migrationBuilder.DropColumn(
                name: "PlaybackUpdatedAtUtc",
                table: "WatchRooms");

            migrationBuilder.DropColumn(
                name: "PlaybackVersion",
                table: "WatchRooms");
        }
    }
}
