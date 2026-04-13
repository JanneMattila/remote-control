using System.Text.Json;

namespace RemoteControl.Models;

/// <summary>
/// Represents a single action-to-key mapping entry for display and editing.
/// </summary>
public class KeyMapping
{
    /// <summary>
    /// The action identifier (e.g., "nextSlide", "playPause").
    /// </summary>
    public string Action { get; set; } = "";

    /// <summary>
    /// Human-readable display name for the action.
    /// </summary>
    public string DisplayName { get; set; } = "";

    /// <summary>
    /// Friendly key name (e.g., "Right", "Left", "F5", "Space", "B").
    /// </summary>
    public string KeyName { get; set; } = "";

    /// <summary>
    /// The Windows virtual key code for the mapped key.
    /// </summary>
    public byte VirtualKeyCode { get; set; }
}

/// <summary>
/// Configuration container for all key mappings. Supports loading from
/// and saving to JSON files.
/// </summary>
public class KeyMappingConfig
{
    private static readonly string SettingsFileName = "usersettings.json";

    /// <summary>
    /// Dictionary mapping action names to friendly key names.
    /// </summary>
    public Dictionary<string, string> Mappings { get; set; } = new();

    /// <summary>
    /// The saved Azure Web PubSub connection string.
    /// </summary>
    public string ConnectionString { get; set; } = "";

    /// <summary>
    /// The hub name for the Web PubSub connection.
    /// </summary>
    public string HubName { get; set; } = "Hub";

    /// <summary>
    /// Returns the default key mapping configuration.
    /// </summary>
    public static KeyMappingConfig LoadDefaults()
    {
        return new KeyMappingConfig
        {
            Mappings = new Dictionary<string, string>
            {
                ["nextSlide"] = "Right",
                ["prevSlide"] = "Left",
                ["startSlideshow"] = "F5",
                ["startSlideshowFromCurrent"] = "Shift+F5",
                ["endSlideshow"] = "Escape",
                ["blackScreen"] = "B",
                ["playPause"] = "Space",
                ["volumeUp"] = "Up",
                ["volumeDown"] = "Down",
                ["mute"] = "M",
                ["fullscreen"] = "F",
                ["skipForward"] = "Right",
                ["skipBack"] = "Left",
                ["switchDesktop1"] = "Win+Ctrl+Left",
                ["switchDesktop2"] = "Win+Ctrl+Right"
            },
            ConnectionString = "",
            HubName = "Hub"
        };
    }

    /// <summary>
    /// Loads configuration from a JSON file. Returns defaults if the file
    /// does not exist or cannot be parsed.
    /// </summary>
    public static KeyMappingConfig Load(string path)
    {
        try
        {
            if (!File.Exists(path))
                return LoadDefaults();

            var json = File.ReadAllText(path);
            var config = JsonSerializer.Deserialize<KeyMappingConfig>(json);
            return config ?? LoadDefaults();
        }
        catch
        {
            return LoadDefaults();
        }
    }

    /// <summary>
    /// Saves the current configuration to a JSON file.
    /// </summary>
    public void Save(string path)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(this, options);
        File.WriteAllText(path, json);
    }

    /// <summary>
    /// Gets the full path to the user settings file in the application directory.
    /// </summary>
    public static string GetSettingsPath()
    {
        var appDir = AppContext.BaseDirectory;
        return Path.Combine(appDir, SettingsFileName);
    }

    /// <summary>
    /// Returns a dictionary of action names to human-readable display names.
    /// </summary>
    public static Dictionary<string, string> GetDisplayNames()
    {
        return new Dictionary<string, string>
        {
            ["nextSlide"] = "Next Slide",
            ["prevSlide"] = "Previous Slide",
            ["startSlideshow"] = "Start Slideshow",
            ["startSlideshowFromCurrent"] = "Start Slideshow (Current)",
            ["endSlideshow"] = "End Slideshow",
            ["blackScreen"] = "Black Screen",
            ["playPause"] = "Play / Pause",
            ["volumeUp"] = "Volume Up",
            ["volumeDown"] = "Volume Down",
            ["mute"] = "Mute",
            ["fullscreen"] = "Fullscreen",
            ["skipForward"] = "Skip Forward",
            ["skipBack"] = "Skip Back",
            ["switchDesktop1"] = "Switch Desktop 1",
            ["switchDesktop2"] = "Switch Desktop 2"
        };
    }
}
