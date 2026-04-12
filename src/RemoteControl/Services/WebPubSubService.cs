using System.Text.Json;
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
    /// Gets a value indicating whether the client is currently connected.
    /// </summary>
    public bool IsConnected { get; private set; }

    /// <summary>
    /// Connects to Azure Web PubSub using the provided Client Access URL
    /// and joins the "remote" group to receive command messages.
    /// </summary>
    /// <param name="clientAccessUrl">The full Client Access URL including the access token.</param>
    public async Task ConnectAsync(string clientAccessUrl)
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(WebPubSubService));

        await DisconnectAsync();

        StatusChanged?.Invoke("Connecting");

        _cts = new CancellationTokenSource();
        _client = new WebPubSubClient(new Uri(clientAccessUrl));

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
                if (message is not null &&
                    string.Equals(message.Type, "command", StringComparison.OrdinalIgnoreCase))
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
    /// Disposes of the service and releases all resources.
    /// </summary>
    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;

        try
        {
            _cts?.Cancel();
            _client?.StopAsync().GetAwaiter().GetResult();
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
