using System.Text.Json;
using System.Text.Json.Serialization;

namespace RemoteControl.Models;

/// <summary>
/// Represents a predefined keyboard sequence that can be sent to the target application.
/// </summary>
public class KeyboardSequence
{
    /// <summary>
    /// Unique identifier for the sequence (e.g., "seq_1", "aks_workloads").
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; set; } = "";

    /// <summary>
    /// Display label shown in the remote UI (e.g., "List AKS Workloads").
    /// </summary>
    [JsonPropertyName("label")]
    public string Label { get; set; } = "";

    /// <summary>
    /// The keyboard text/sequence to send. Supports {Enter}, {Tab}, {Backspace}, etc.
    /// Example: "kubectl get pods{Enter}"
    /// </summary>
    [JsonPropertyName("text")]
    public string Text { get; set; } = "";

    /// <summary>
    /// Optional emoji icon for the button (default: ⌨).
    /// </summary>
    [JsonPropertyName("icon")]
    public string Icon { get; set; } = "⌨";
}

/// <summary>
/// Container for keyboard sequence configuration. Supports loading from
/// and saving to JSON files.
/// </summary>
public class KeyboardSequencesConfig
{
    private static readonly string SettingsFileName = "keyboardsequences.json";

    /// <summary>
    /// List of defined keyboard sequences.
    /// </summary>
    [JsonPropertyName("sequences")]
    public List<KeyboardSequence> Sequences { get; set; } = new();

    /// <summary>
    /// Returns the default keyboard sequences configuration.
    /// </summary>
    public static KeyboardSequencesConfig LoadDefaults()
    {
        return new KeyboardSequencesConfig
        {
            Sequences = new List<KeyboardSequence>
            {
                new KeyboardSequence
                {
                    Id = "aks_workloads",
                    Label = "List workloads running in my AKS",
                    Text = "List workloads running in my AKS{Enter}",
                    Icon = "📋"
                },
                new KeyboardSequence
                {
                    Id = "kubectl_pods",
                    Label = "kubectl get pods",
                    Text = "kubectl get pods{Enter}",
                    Icon = "📦"
                },
                new KeyboardSequence
                {
                    Id = "kubectl_services",
                    Label = "kubectl get services",
                    Text = "kubectl get services{Enter}",
                    Icon = "🔌"
                }
            }
        };
    }

    /// <summary>
    /// Gets the configuration file path in the application directory.
    /// </summary>
    public static string GetSettingsPath()
    {
        var appDir = AppContext.BaseDirectory;
        return Path.Combine(appDir, SettingsFileName);
    }

    /// <summary>
    /// Loads configuration from a JSON file. Returns defaults if the file
    /// does not exist or cannot be parsed.
    /// </summary>
    public static KeyboardSequencesConfig Load(string path)
    {
        try
        {
            if (!File.Exists(path))
                return LoadDefaults();

            var json = File.ReadAllText(path);
            var config = JsonSerializer.Deserialize<KeyboardSequencesConfig>(json);
            return config ?? LoadDefaults();
        }
        catch
        {
            return LoadDefaults();
        }
    }

    /// <summary>
    /// Saves configuration to a JSON file.
    /// </summary>
    public void Save(string path)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(this, options);
        File.WriteAllText(path, json);
    }

    /// <summary>
    /// Retrieves a sequence by ID.
    /// </summary>
    public KeyboardSequence? GetSequenceById(string id)
    {
        return Sequences.FirstOrDefault(s => s.Id == id);
    }
}
