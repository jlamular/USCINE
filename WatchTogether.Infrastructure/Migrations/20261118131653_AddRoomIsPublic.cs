using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchTogether.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRoomIsPublic : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsPublic",
                table: "WatchRooms",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "IX_WatchRooms_IsPublic",
                table: "WatchRooms",
                column: "IsPublic");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_WatchRooms_IsPublic",
                table: "WatchRooms");

            migrationBuilder.DropColumn(
                name: "IsPublic",
                table: "WatchRooms");
        }
    }
}
