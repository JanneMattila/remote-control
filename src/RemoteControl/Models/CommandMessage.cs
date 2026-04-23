using System.Text.Json.Serialization;

namespace RemoteControl.Models;

/// <summary>
/// Represents a command message received from the remote control SPA
/// via Azure Web PubSub.
/// </summary>
public class CommandMessage
{
    /// <summary>
    /// The message type. Expected value: "command".
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    /// <summary>
    /// The operating mode (e.g., "powerpoint", "watch").
    /// </summary>
    [JsonPropertyName("mode")]
    public string Mode { get; set; } = "";

    /// <summary>
    /// The action to perform (e.g., "nextSlide", "playPause").
    /// </summary>
    [JsonPropertyName("action")]
    public string Action { get; set; } = "";

    /// <summary>
    /// ISO 8601 timestamp of when the command was sent.
    /// </summary>
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = "";

    /// <summary>
    /// The source of the message (e.g., "remote", "receiver"). Used to filter self-sent messages.
    /// </summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = "";
}

/// <summary>
/// Represents a response message sent from the receiver to the remote control.
/// Used for sending data like keyboard sequences configuration.
/// </summary>
public class ResponseMessage
{
    /// <summary>
    /// The message type (e.g., "keyboardSequences", "status").
    /// </summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = "";

    /// <summary>
    /// The payload data (typically a serialized object).
    /// </summary>
    [JsonPropertyName("data")]
    public object? Data { get; set; }

    /// <summary>
    /// The source of the message. Always "receiver".
    /// </summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = "receiver";
}

