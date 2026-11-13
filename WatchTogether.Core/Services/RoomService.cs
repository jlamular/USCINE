using WatchTogether.Core.Entities;
using WatchTogether.Core.Enums;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Services;

public class RoomService : IRoomService
{
    private const int MaxRoomNameLength = 50;
    private const int MaxCodeGenerationAttempts = 5;

    private readonly IRoomRepository _roomRepository;

    public RoomService(IRoomRepository roomRepository)
    {
        _roomRepository = roomRepository;
    }

    public async Task<ServiceResult<WatchRoom>> CreateRoomAsync(string userId, string roomName)
    {
        string cleanName = roomName.Trim();

        if (cleanName.Length == 0 || cleanName.Length > MaxRoomNameLength)
        {
            return ServiceResult<WatchRoom>.Failure(
                ServiceErrorType.Validation,
                $"Room name must be between 1 and {MaxRoomNameLength} characters.");
        }

        string roomCode = await GenerateUniqueRoomCodeAsync();
        DateTime now = DateTime.UtcNow;

        var room = new WatchRoom
        {
            RoomCode = roomCode,
            RoomName = cleanName,
            HostUserId = userId,
            CreatedAtUtc = now
        };

        // The creator is automatically the host and the first participant
        room.Participants.Add(new RoomParticipant
        {
            UserId = userId,
            Role = RoomRole.Host,
            JoinedAtUtc = now
        });

        await _roomRepository.AddRoomAsync(room);

        WatchRoom? savedRoom = await _roomRepository.GetByIdWithParticipantsAsync(room.Id);
        return ServiceResult<WatchRoom>.Success(savedRoom!);
    }

    public async Task<ServiceResult<WatchRoom>> JoinRoomAsync(string userId, string roomCode)
    {
        string normalizedCode = RoomCodeGenerator.Normalize(roomCode);

        WatchRoom? room = await _roomRepository.GetByCodeAsync(normalizedCode);
        if (room == null)
        {
            return ServiceResult<WatchRoom>.Failure(ServiceErrorType.NotFound, "No room found with that code.");
        }

        // Joining twice is harmless: we only add a membership if there isn't one yet
        bool alreadyMember = await _roomRepository.IsMemberAsync(room.Id, userId);
        if (!alreadyMember)
        {
            await _roomRepository.AddParticipantAsync(new RoomParticipant
            {
                RoomId = room.Id,
                UserId = userId,
                Role = RoomRole.Participant,
                JoinedAtUtc = DateTime.UtcNow
            });
        }

        WatchRoom? roomWithParticipants = await _roomRepository.GetByIdWithParticipantsAsync(room.Id);
        return ServiceResult<WatchRoom>.Success(roomWithParticipants!);
    }

    public async Task<List<WatchRoom>> GetMyRoomsAsync(string userId)
    {
        return await _roomRepository.GetRoomsForUserAsync(userId);
    }

    public async Task<ServiceResult<WatchRoom>> GetRoomAsync(string userId, Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult<WatchRoom>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        return ServiceResult<WatchRoom>.Success(room);
    }

    public async Task<ServiceResult> LeaveRoomAsync(string userId, Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        if (room.HostUserId == userId)
        {
            return ServiceResult.Failure(
                ServiceErrorType.Validation,
                "The host cannot leave the room. Delete the room instead.");
        }

        RoomParticipant participant = room.Participants.First(member => member.UserId == userId);
        await _roomRepository.RemoveParticipantAsync(participant);

        return ServiceResult.Success();
    }

    public async Task<ServiceResult> DeleteRoomAsync(string userId, Guid roomId)
    {
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);

        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        if (room.HostUserId != userId)
        {
            return ServiceResult.Failure(ServiceErrorType.Forbidden, "Only the host can delete the room.");
        }

        await _roomRepository.DeleteRoomAsync(room);

        return ServiceResult.Success();
    }

    private static bool IsMember(WatchRoom room, string userId)
    {
        return room.Participants.Any(member => member.UserId == userId);
    }

    private async Task<string> GenerateUniqueRoomCodeAsync()
    {
        for (int attempt = 0; attempt < MaxCodeGenerationAttempts; attempt++)
        {
            string candidate = RoomCodeGenerator.Generate();

            if (!await _roomRepository.RoomCodeExistsAsync(candidate))
            {
                return candidate;
            }
        }

        throw new InvalidOperationException("Could not generate a unique room code.");
    }
}