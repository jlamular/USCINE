using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WatchTogether.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddVideos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CurrentVideoId",
                table: "WatchRooms",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Videos",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RoomId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    UploadedByUserId = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    OriginalFileName = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    StoredFileName = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileSizeBytes = table.Column<long>(type: "bigint", nullable: false),
                    DurationSeconds = table.Column<double>(type: "float", nullable: false),
                    UploadedAtUtc = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Videos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Videos_AspNetUsers_UploadedByUserId",
                        column: x => x.UploadedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Videos_WatchRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "WatchRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_WatchRooms_CurrentVideoId",
                table: "WatchRooms",
                column: "CurrentVideoId");

            migrationBuilder.CreateIndex(
                name: "IX_Videos_RoomId_UploadedAtUtc",
                table: "Videos",
                columns: new[] { "RoomId", "UploadedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Videos_StoredFileName",
                table: "Videos",
                column: "StoredFileName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Videos_UploadedByUserId",
                table: "Videos",
                column: "UploadedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_WatchRooms_Videos_CurrentVideoId",
                table: "WatchRooms",
                column: "CurrentVideoId",
                principalTable: "Videos",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_WatchRooms_Videos_CurrentVideoId",
                table: "WatchRooms");

            migrationBuilder.DropTable(
                name: "Videos");

            migrationBuilder.DropIndex(
                name: "IX_WatchRooms_CurrentVideoId",
                table: "WatchRooms");

            migrationBuilder.DropColumn(
                name: "CurrentVideoId",
                table: "WatchRooms");
        }
    }
}
