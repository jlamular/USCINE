using System.Buffers.Binary;
using System.Text;

namespace WatchTogether.Core.Services;

// Reads just enough of an MP4 file to confirm it really is one, and to find its duration.
// An MP4 is a list of "boxes". Each box starts with 4 bytes of size and 4 bytes of type, such as "ftyp" or "moov".
public static class Mp4Inspector
{
    private class BoxHeader
    {
        public string Type { get; set; } = string.Empty;

        public long PayloadStart { get; set; }

        public long End { get; set; }
    }

    // Returns the duration in seconds, or null if the stream is not a valid MP4.
    // Fragmented MP4s (no overall duration) also return null.
    public static double? ReadDurationSeconds(Stream stream)
    {
        if (!stream.CanSeek)
        {
            return null;
        }

        long fileLength = stream.Length;
        long position = 0;
        bool foundFileTypeBox = false;
        double? durationSeconds = null;

        while (position + 8 <= fileLength)
        {
            BoxHeader? box = ReadBoxHeader(stream, position, fileLength);
            if (box == null)
            {
                return null;
            }

            // A real MP4 always starts with an "ftyp" box
            if (position == 0 && box.Type != "ftyp")
            {
                return null;
            }

            if (box.Type == "ftyp")
            {
                foundFileTypeBox = true;
            }

            if (box.Type == "moov")
            {
                durationSeconds = ReadMovieDuration(stream, box);
            }

            position = box.End;
        }

        if (!foundFileTypeBox)
        {
            return null;
        }

        return durationSeconds;
    }

    private static BoxHeader? ReadBoxHeader(Stream stream, long position, long limit)
    {
        if (position + 8 > limit)
        {
            return null;
        }

        stream.Position = position;
        byte[] header = new byte[8];
        stream.ReadExactly(header, 0, 8);

        long boxSize = BinaryPrimitives.ReadUInt32BigEndian(header.AsSpan(0, 4));
        string type = Encoding.ASCII.GetString(header, 4, 4);
        long headerSize = 8;

        if (boxSize == 1)
        {
            // Size 1 means "the real size is in the next 8 bytes" (used for boxes over 4 GB)
            if (position + 16 > limit)
            {
                return null;
            }

            byte[] largeSize = new byte[8];
            stream.ReadExactly(largeSize, 0, 8);
            boxSize = (long)BinaryPrimitives.ReadUInt64BigEndian(largeSize);
            headerSize = 16;
        }
        else if (boxSize == 0)
        {
            // Size 0 means "this box runs to the end of the file"
            boxSize = limit - position;
        }

        if (boxSize < headerSize || position + boxSize > limit)
        {
            return null;
        }

        return new BoxHeader
        {
            Type = type,
            PayloadStart = position + headerSize,
            End = position + boxSize
        };
    }

    private static double? ReadMovieDuration(Stream stream, BoxHeader movieBox)
    {
        long position = movieBox.PayloadStart;

        // The duration lives in the "mvhd" box, which is a child of "moov"
        while (position + 8 <= movieBox.End)
        {
            BoxHeader? child = ReadBoxHeader(stream, position, movieBox.End);
            if (child == null)
            {
                return null;
            }

            if (child.Type == "mvhd")
            {
                return ReadMovieHeaderDuration(stream, child);
            }

            position = child.End;
        }

        return null;
    }

    private static double? ReadMovieHeaderDuration(Stream stream, BoxHeader box)
    {
        long payloadLength = box.End - box.PayloadStart;

        stream.Position = box.PayloadStart;
        int version = stream.ReadByte();

        if (version == 0 && payloadLength >= 20)
        {
            // version(1) + flags(3) + created(4) + modified(4), then timescale(4) and duration(4)
            stream.Position = box.PayloadStart + 12;
            byte[] data = new byte[8];
            stream.ReadExactly(data, 0, 8);

            uint timescale = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(0, 4));
            uint duration = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(4, 4));

            if (timescale == 0)
            {
                return null;
            }

            return duration / (double)timescale;
        }

        if (version == 1 && payloadLength >= 32)
        {
            // version(1) + flags(3) + created(8) + modified(8), then timescale(4) and duration(8)
            stream.Position = box.PayloadStart + 20;
            byte[] data = new byte[12];
            stream.ReadExactly(data, 0, 12);

            uint timescale = BinaryPrimitives.ReadUInt32BigEndian(data.AsSpan(0, 4));
            ulong duration = BinaryPrimitives.ReadUInt64BigEndian(data.AsSpan(4, 8));

            if (timescale == 0)
            {
                return null;
            }

            return duration / (double)timescale;
        }

        return null;
    }
}