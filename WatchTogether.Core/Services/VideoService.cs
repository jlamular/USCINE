using WatchTogether.Core.Entities;
using WatchTogether.Core.Interfaces;
using WatchTogether.Core.Models;

namespace WatchTogether.Core.Services;

public class VideoService : IVideoService
{
    private const int MaxFileNameLength = 255;
    private const double MaxDurationSeconds = 24 * 60 * 60;
    private const string AllowedExtension = ".mp4";
    private const string Mp4ContentType = "video/mp4";

    private readonly IVideoRepository _videoRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IVideoStorage _videoStorage;
    private readonly VideoUploadOptions _uploadOptions;

    public VideoService(
        IVideoRepository videoRepository,
        IRoomRepository roomRepository,
        IVideoStorage videoStorage,
        VideoUploadOptions uploadOptions)
    {
        _videoRepository = videoRepository;
        _roomRepository = roomRepository;
        _videoStorage = videoStorage;
        _uploadOptions = uploadOptions;
    }

    public async Task<ServiceResult<Video>> UploadVideoAsync(
        string userId,
        Guid roomId,
        string originalFileName,
        long fileSizeBytes,
        Stream content,
        CancellationToken cancellationToken)
    {
        // 1. Who is allowed? Members can see the room, only the host can upload.
        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(roomId);
        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        if (room.HostUserId != userId)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.Forbidden, "Only the host can upload videos.");
        }

        // 2. Cheap checks first, before anything is written to disk
        string displayName = Path.GetFileName(originalFileName).Trim();
        if (displayName.Length == 0 || displayName.Length > MaxFileNameLength)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.Validation, "The file name is missing or too long.");
        }

        if (!string.Equals(Path.GetExtension(displayName), AllowedExtension, StringComparison.OrdinalIgnoreCase))
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.Validation, "Only .mp4 videos are supported.");
        }

        if (fileSizeBytes <= 0)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.Validation, "The file is empty.");
        }

        if (fileSizeBytes > _uploadOptions.MaxFileSizeBytes)
        {
            long maxMegabytes = _uploadOptions.MaxFileSizeBytes / (1024 * 1024);
            return ServiceResult<Video>.Failure(
                ServiceErrorType.Validation,
                $"The file is too large. The maximum size is {maxMegabytes} MB.");
        }

        // 3. Save under a name WE generate, then check what the file really is
        string storedFileName = await _videoStorage.SaveAsync(content, cancellationToken);

        double? durationSeconds = ReadDuration(storedFileName);
        if (durationSeconds == null || durationSeconds <= 0 || durationSeconds > MaxDurationSeconds)
        {
            _videoStorage.Delete(storedFileName);
            return ServiceResult<Video>.Failure(
                ServiceErrorType.Validation,
                "This file is not a valid MP4 video.");
        }

        // 4. Record it in the database. If that fails, do not leave an orphan file behind.
        var video = new Video
        {
            RoomId = roomId,
            UploadedByUserId = userId,
            OriginalFileName = displayName,
            StoredFileName = storedFileName,
            ContentType = Mp4ContentType,
            FileSizeBytes = fileSizeBytes,
            DurationSeconds = durationSeconds.Value,
            UploadedAtUtc = DateTime.UtcNow
        };

        try
        {
            await _videoRepository.AddAsync(video);
        }
        catch
        {
            _videoStorage.Delete(storedFileName);
            throw;
        }

        Video? savedVideo = await _videoRepository.GetByIdAsync(video.Id);
        return ServiceResult<Video>.Success(savedVideo!);
    }

    public async Task<ServiceResult<List<Video>>> GetRoomVideosAsync(string userId, Guid roomId)
    {
        bool isMember = await _roomRepository.IsMemberAsync(roomId, userId);
        if (!isMember)
        {
            return ServiceResult<List<Video>>.Failure(ServiceErrorType.NotFound, "Room not found.");
        }

        List<Video> videos = await _videoRepository.GetByRoomAsync(roomId);
        return ServiceResult<List<Video>>.Success(videos);
    }

    public async Task<ServiceResult<Video>> GetVideoAsync(string userId, Guid videoId)
    {
        Video? video = await _videoRepository.GetByIdAsync(videoId);
        if (video == null)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.NotFound, "Video not found.");
        }

        // Access to a video is decided by membership of the room it belongs to
        bool isMember = await _roomRepository.IsMemberAsync(video.RoomId, userId);
        if (!isMember)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.NotFound, "Video not found.");
        }

        return ServiceResult<Video>.Success(video);
    }

    public async Task<ServiceResult<VideoStreamInfo>> OpenVideoStreamAsync(string userId, Guid videoId)
    {
        ServiceResult<Video> videoResult = await GetVideoAsync(userId, videoId);
        if (!videoResult.Succeeded)
        {
            return ServiceResult<VideoStreamInfo>.Failure(videoResult.ErrorType, videoResult.Errors[0]);
        }

        Video video = videoResult.Value!;

        Stream? stream = _videoStorage.OpenRead(video.StoredFileName);
        if (stream == null)
        {
            return ServiceResult<VideoStreamInfo>.Failure(ServiceErrorType.NotFound, "The video file is missing.");
        }

        return ServiceResult<VideoStreamInfo>.Success(new VideoStreamInfo
        {
            Stream = stream,
            ContentType = video.ContentType
        });
    }

    public async Task<ServiceResult<Video>> DeleteVideoAsync(string userId, Guid videoId)
    {
        Video? video = await _videoRepository.GetByIdAsync(videoId);
        if (video == null)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.NotFound, "Video not found.");
        }

        WatchRoom? room = await _roomRepository.GetByIdWithParticipantsAsync(video.RoomId);
        if (room == null || !IsMember(room, userId))
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.NotFound, "Video not found.");
        }

        if (room.HostUserId != userId)
        {
            return ServiceResult<Video>.Failure(ServiceErrorType.Forbidden, "Only the host can delete videos.");
        }

        // If this is the video the room is showing, clear that first
        if (room.CurrentVideoId == video.Id)
        {
            room.CurrentVideoId = null;
            room.CurrentVideo = null;
            await _roomRepository.SaveChangesAsync();
        }

        await _videoRepository.DeleteAsync(video);
        _videoStorage.Delete(video.StoredFileName);

        return ServiceResult<Video>.Success(video);
    }

    private double? ReadDuration(string storedFileName)
    {
        using Stream? stream = _videoStorage.OpenRead(storedFileName);
        if (stream == null)
        {
            return null;
        }

        return Mp4Inspector.ReadDurationSeconds(stream);
    }

    private static bool IsMember(WatchRoom room, string userId)
    {
        return room.Participants.Any(member => member.UserId == userId);
    }
}