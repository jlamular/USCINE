using System.Security.Cryptography;

namespace WatchTogether.Core.Services;

public static class RoomCodeGenerator
{
    public const int CodeLength = 8;

    // No I, L, O, 0 or 1, because they are easy to confuse when typing a code from a message
    private const string Alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

    public static string Generate()
    {
        char[] characters = new char[CodeLength];

        for (int i = 0; i < CodeLength; i++)
        {
            int index = RandomNumberGenerator.GetInt32(Alphabet.Length);
            characters[i] = Alphabet[index];
        }

        return new string(characters);
    }

    // Lets people type "abcd-2345" or " ABCD 2345 " and still match
    public static string Normalize(string input)
    {
        return input
            .Replace("-", string.Empty)
            .Replace(" ", string.Empty)
            .ToUpperInvariant();
    }
}