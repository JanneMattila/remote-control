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
}
