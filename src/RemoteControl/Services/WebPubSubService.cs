using System.Text.Json;
using Azure.Messaging.WebPubSub;
using Azure.Messaging.WebPubSub.Clients;
using RemoteControl.Models;

namespace RemoteControl.Services;

/// <summary>
/// Manages the Azure Web PubSub client connection. Connects to the service,
/// joins the "remote" group, and raises events when commands are received.
/// </summary>
public class WebPubSubService : IDisposable
{
    private WebPubSubClient? _client;
    private CancellationTokenSource? _cts;
    private bool _disposed;

    /// <summary>
    /// Raised when the connection status changes (e.g., "Connecting", "Connected", "Disconnected").
    /// </summary>
    public event Action<string>? StatusChanged;

    /// <summary>
    /// Raised when a valid command message is received from the "remote" group.
    /// </summary>
    public event Action<CommandMessage>? CommandReceived;

    /// <summary>
    /// Raised when any group message is received (command or heartbeat).
    /// </summary>
    public event Action<string, DateTime>? MessageReceived;

    /// <summary>
    /// Gets a value indicating whether the client is currently connected.
    /// </summary>
    public bool IsConnected { get; private set; }

    /// <summary>
    /// Connects to Azure Web PubSub using the provided connection string and hub name.
    /// Generates a Client Access URL with the required permissions and joins the "remote" group.
    /// </summary>
    /// <param name="connectionString">The Azure Web PubSub connection string.</param>
    /// <param name="hubName">The hub name (default: "Hub").</param>
    public async Task ConnectAsync(string connectionString, string hubName = "Hub")
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(WebPubSubService));

        await DisconnectAsync();

        StatusChanged?.Invoke("Connecting");

        _cts = new CancellationTokenSource();

        // Generate the client access URI using the service client
        var serviceClient = new WebPubSubServiceClient(connectionString, hubName);
        var clientAccessUri = await serviceClient.GetClientAccessUriAsync(
            userId: "receiver",
            roles: ["webpubsub.joinLeaveGroup", "webpubsub.sendToGroup"]);

        _client = new WebPubSubClient(clientAccessUri);

        _client.Connected += (args) =>
        {
            IsConnected = true;
            StatusChanged?.Invoke("Connected");
            return Task.CompletedTask;
        };

        _client.Disconnected += (args) =>
        {
            IsConnected = false;
            StatusChanged?.Invoke("Disconnected");
            return Task.CompletedTask;
        };

        _client.Stopped += (args) =>
        {
            IsConnected = false;
            StatusChanged?.Invoke("Disconnected");
            return Task.CompletedTask;
        };

        _client.GroupMessageReceived += (args) =>
        {
            try
            {
                var json = args.Message.Data.ToString();
                var message = JsonSerializer.Deserialize<CommandMessage>(json);
                if (message is null) return Task.CompletedTask;

                // Ignore our own messages (echo from group)
                if (string.Equals(message.Source, "receiver", StringComparison.OrdinalIgnoreCase))
                    return Task.CompletedTask;

                // Notify about any received message
                MessageReceived?.Invoke(message.Type, DateTime.Now);

                if (string.Equals(message.Type, "command", StringComparison.OrdinalIgnoreCase))
                {
                    CommandReceived?.Invoke(message);
                }
            }
            catch
            {
                // Ignore malformed messages
            }
            return Task.CompletedTask;
        };

        await _client.StartAsync(_cts.Token);
        await _client.JoinGroupAsync("remote");
    }

    /// <summary>
    /// Disconnects from the Azure Web PubSub service.
    /// </summary>
    public async Task DisconnectAsync()
    {
        if (_client is not null)
        {
            try
            {
                _cts?.Cancel();
                await _client.StopAsync();
            }
            catch
            {
                // Best-effort disconnect
            }
            finally
            {
                _client = null;
                _cts?.Dispose();
                _cts = null;
                IsConnected = false;
                StatusChanged?.Invoke("Disconnected");
            }
        }
    }

    /// <summary>
    /// Sends a message to the "remote" group via Web PubSub.
    /// </summary>
    public async Task SendMessageAsync(object message)
    {
        if (_client is null || !IsConnected)
            return;

        try
        {
            var json = JsonSerializer.Serialize(message);
            await _client.SendToGroupAsync("remote", BinaryData.FromString(json), WebPubSubDataType.Json);
        }
        catch
        {
            // Silently fail - if connection is lost, that's handled elsewhere
        }
    }

    /// <summary>
    /// Disposes of the service and releases all resources.
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try
        {
            _cts?.Cancel();
        }
        catch
        {
            // Best-effort cleanup
        }
        finally
        {
            _cts?.Dispose();
            _client = null;
        }

        GC.SuppressFinalize(this);
    }
}
