using RemoteControl.Models;
using RemoteControl.Services;

namespace RemoteControl;

/// <summary>
/// Main application form. Manages connection settings, command logging,
/// key mapping configuration, and system tray behaviour.
/// </summary>
public partial class MainForm : Form
{
    private readonly WebPubSubService _pubSubService = new();
    private KeyMappingConfig _config = null!;
    private int _messageCount;
    private bool _firstRun = true;
    private bool _isExiting;
    private DateTime? _lastReceivedTime;
    private DateTime? _lastRemoteHeartbeat;
    private System.Windows.Forms.Timer _presenceTimer = null!;

    public MainForm()
    {
        InitializeComponent();
        LoadConfiguration();
        WireEvents();

        // Timer to refresh presence/last-received display every second
        _presenceTimer = new System.Windows.Forms.Timer { Interval = 1000 };
        _presenceTimer.Tick += (_, _) => UpdatePresenceDisplay();
        _presenceTimer.Start();
    }

    // ───────── Configuration ─────────

    private void LoadConfiguration()
    {
        _config = KeyMappingConfig.Load(KeyMappingConfig.GetSettingsPath());
        txtConnStr.Text = _config.ConnectionString;
        txtHub.Text = string.IsNullOrEmpty(_config.HubName) ? "Hub" : _config.HubName;
        PopulateMappingsGrid();
    }

    private void PopulateMappingsGrid()
    {
        dgvMappings.Rows.Clear();
        var displayNames = KeyMappingConfig.GetDisplayNames();

        foreach (var kvp in _config.Mappings)
        {
            var display = displayNames.TryGetValue(kvp.Key, out var dn) ? dn : kvp.Key;
            dgvMappings.Rows.Add(kvp.Key, display, kvp.Value);
        }
    }

    private void SaveConfiguration()
    {
        // Collect mappings from grid
        foreach (DataGridViewRow row in dgvMappings.Rows)
        {
            var action = row.Cells[0].Value?.ToString() ?? "";
            var keyName = row.Cells[2].Value?.ToString() ?? "";
            if (!string.IsNullOrEmpty(action))
            {
                _config.Mappings[action] = keyName;
            }
        }

        _config.ConnectionString = txtConnStr.Text.Trim();
        _config.HubName = txtHub.Text.Trim();
        _config.Save(KeyMappingConfig.GetSettingsPath());
    }

    // ───────── Event Wiring ─────────

    private void WireEvents()
    {
        // Form events
        Load += MainForm_Load;
        FormClosing += MainForm_FormClosing;

        // Tray
        notifyIcon.DoubleClick += NotifyIcon_DoubleClick;
        trayMenuOpen.Click += TrayMenuOpen_Click;
        trayMenuConnect.Click += TrayMenuConnect_Click;
        trayMenuExit.Click += TrayMenuExit_Click;

        // Buttons
        btnConnect.Click += BtnConnect_Click;
        btnResetDefaults.Click += BtnResetDefaults_Click;
        btnSaveMappings.Click += BtnSaveMappings_Click;

        // Log context menu
        logMenuCopySelected.Click += LogMenuCopySelected_Click;
        logMenuCopyAll.Click += LogMenuCopyAll_Click;

        // Service events
        _pubSubService.StatusChanged += OnStatusChanged;
        _pubSubService.CommandReceived += OnCommandReceived;
        _pubSubService.MessageReceived += OnMessageReceived;
    }

    // ───────── Form Lifecycle ─────────

    private async void MainForm_Load(object? sender, EventArgs e)
    {
        if (_firstRun)
        {
            notifyIcon.ShowBalloonTip(
                3000,
                "Remote Control Receiver",
                "Running in the system tray. Double-click to open.",
                ToolTipIcon.Info);
            _firstRun = false;
        }

        // Auto-connect if URL is saved
        if (!string.IsNullOrWhiteSpace(txtConnStr.Text))
        {
            await ConnectAsync();
        }
    }

    private void MainForm_FormClosing(object? sender, FormClosingEventArgs e)
    {
        if (!_isExiting && e.CloseReason == CloseReason.UserClosing)
        {
            e.Cancel = true;
            Hide();
            return;
        }

        _pubSubService.Dispose();
    }

    // ───────── Tray Menu Handlers ─────────

    private void NotifyIcon_DoubleClick(object? sender, EventArgs e)
    {
        ShowMainWindow();
    }

    private void TrayMenuOpen_Click(object? sender, EventArgs e)
    {
        ShowMainWindow();
    }

    private async void TrayMenuConnect_Click(object? sender, EventArgs e)
    {
        if (_pubSubService.IsConnected)
            await DisconnectAsync();
        else
            await ConnectAsync();
    }

    private async void TrayMenuExit_Click(object? sender, EventArgs e)
    {
        await ExitApplicationAsync();
    }

    private void ShowMainWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        ShowInTaskbar = true;
        BringToFront();
        Activate();
    }

    private async Task ExitApplicationAsync()
    {
        _isExiting = true;
        notifyIcon.Visible = false;
        await _pubSubService.DisconnectAsync();
        Application.Exit();
    }

    // ───────── Connection ─────────

    private async void BtnConnect_Click(object? sender, EventArgs e)
    {
        if (_pubSubService.IsConnected)
            await DisconnectAsync();
        else
            await ConnectAsync();
    }

    private async Task ConnectAsync()
    {
        var connStr = txtConnStr.Text.Trim();
        var hub = txtHub.Text.Trim();
        if (string.IsNullOrEmpty(connStr))
        {
            MessageBox.Show(
                "Please enter a Connection String.",
                "Connection",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }
        if (string.IsNullOrEmpty(hub)) hub = "Hub";

        try
        {
            btnConnect.Enabled = false;
            _config.ConnectionString = connStr;
            _config.HubName = hub;
            SaveConfiguration();
            await _pubSubService.ConnectAsync(connStr, hub);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Failed to connect:\n{ex.Message}",
                "Connection Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            btnConnect.Enabled = true;
        }
    }

    private async Task DisconnectAsync()
    {
        try
        {
            btnConnect.Enabled = false;
            await _pubSubService.DisconnectAsync();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Error disconnecting:\n{ex.Message}",
                "Disconnect Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            btnConnect.Enabled = true;
        }
    }

    // ───────── Status Changes ─────────

    private void OnStatusChanged(string status)
    {
        if (InvokeRequired)
        {
            Invoke(() => OnStatusChanged(status));
            return;
        }

        lblStatus.Text = status;
        statusLabel.Text = status;

        switch (status)
        {
            case "Connected":
                lblStatus.ForeColor = Color.Green;
                btnConnect.Text = "Disconnect";
                trayMenuConnect.Text = "Disconnect";
                notifyIcon.Text = "Remote Control Receiver - Connected";
                break;
            case "Connecting":
                lblStatus.ForeColor = Color.Orange;
                btnConnect.Text = "Connecting...";
                trayMenuConnect.Text = "Connecting...";
                break;
            default: // Disconnected
                lblStatus.ForeColor = Color.Red;
                btnConnect.Text = "Connect";
                trayMenuConnect.Text = "Connect";
                notifyIcon.Text = "Remote Control Receiver - Disconnected";
                _lastRemoteHeartbeat = null;
                break;
        }
    }

    private void OnMessageReceived(string messageType, DateTime receivedAt)
    {
        if (InvokeRequired)
        {
            Invoke(() => OnMessageReceived(messageType, receivedAt));
            return;
        }

        _lastReceivedTime = receivedAt;

        if (string.Equals(messageType, "heartbeat", StringComparison.OrdinalIgnoreCase))
        {
            _lastRemoteHeartbeat = receivedAt;
        }
    }

    private void UpdatePresenceDisplay()
    {
        // Last received
        if (_lastReceivedTime.HasValue)
        {
            var ago = DateTime.Now - _lastReceivedTime.Value;
            lastReceivedLabel.Text = ago.TotalSeconds < 5
                ? $"Last: just now"
                : $"Last: {_lastReceivedTime.Value:HH:mm:ss}";
        }
        else
        {
            lastReceivedLabel.Text = "Last: —";
        }

        // Remote (SPA) presence — active if heartbeat within last 30s
        if (_lastRemoteHeartbeat.HasValue)
        {
            var ago = DateTime.Now - _lastRemoteHeartbeat.Value;
            if (ago.TotalSeconds <= 30)
            {
                remoteStatusLabel.Text = "Remote: ✔ active";
                remoteStatusLabel.ForeColor = Color.Green;
            }
            else
            {
                remoteStatusLabel.Text = $"Remote: last seen {_lastRemoteHeartbeat.Value:HH:mm:ss}";
                remoteStatusLabel.ForeColor = Color.Orange;
            }
        }
        else
        {
            remoteStatusLabel.Text = "Remote: —";
            remoteStatusLabel.ForeColor = SystemColors.ControlText;
        }
    }

    // ───────── Command Processing ─────────

    private void OnCommandReceived(CommandMessage message)
    {
        if (InvokeRequired)
        {
            Invoke(() => OnCommandReceived(message));
            return;
        }

        var keyName = ResolveKeyName(message.Action);

        // Only send key presses when the form is hidden (minimized to tray).
        // When visible, act as debug mode — show commands but don't interfere.
        bool formIsVisible = Visible && WindowState != FormWindowState.Minimized;
        bool keySent = false;

        if (!formIsVisible && !string.IsNullOrEmpty(keyName))
        {
            var parts = keyName.Split('+');
            if (parts.Length == 3)
            {
                var mod1 = ResolveModifier(parts[0].Trim());
                var mod2 = ResolveModifier(parts[1].Trim());
                var vk = KeyboardService.GetVirtualKeyCode(parts[2].Trim());
                if (mod1 != 0 && mod2 != 0 && vk != 0)
                {
                    KeyboardService.SendKeyCombination(mod1, mod2, vk);
                    keySent = true;
                }
            }
            else if (parts.Length == 2)
            {
                var mod = ResolveModifier(parts[0].Trim());
                var vk = KeyboardService.GetVirtualKeyCode(parts[1].Trim());
                if (mod != 0 && vk != 0)
                {
                    KeyboardService.SendKeyCombination(mod, vk);
                    keySent = true;
                }
            }
            else
            {
                var vk = KeyboardService.GetVirtualKeyCode(keyName);
                if (vk != 0)
                {
                    KeyboardService.SendKey(vk);
                    keySent = true;
                }
            }
        }

        var displayVk = keyName.Contains('+')
            ? KeyboardService.GetVirtualKeyCode(keyName.Substring(keyName.LastIndexOf('+') + 1))
            : KeyboardService.GetVirtualKeyCode(keyName);
        AddLogEntry(message, keyName, displayVk, keySent, formIsVisible);

        _messageCount++;
        messageCountLabel.Text = $"Messages: {_messageCount}";
    }

    private string ResolveKeyName(string action)
    {
        if (_config.Mappings.TryGetValue(action, out var keyName))
            return keyName;

        return "";
    }

    private static byte ResolveModifier(string name)
    {
        return name.ToUpperInvariant() switch
        {
            "SHIFT" => (byte)Keys.ShiftKey,
            "CTRL" or "CONTROL" => (byte)Keys.ControlKey,
            "ALT" => (byte)Keys.Menu,
            "WIN" or "LWIN" => (byte)Keys.LWin,
            _ => 0
        };
    }

    private void AddLogEntry(CommandMessage message, string keyName, byte vk, bool keySent, bool debugMode, string? overrideStatus = null)
    {
        var time = DateTime.Now.ToString("HH:mm:ss");
        string status;

        if (overrideStatus is not null)
            status = overrideStatus;
        else if (vk == 0)
            status = "(unknown key)";
        else if (debugMode)
            status = $"{keyName} — DEBUG (not sent)";
        else if (keySent)
            status = keyName;
        else
            status = $"{keyName} — FAILED";

        var item = new ListViewItem(new[] { time, message.Mode, message.Action, status });

        if (debugMode && overrideStatus is null)
        {
            item.BackColor = Color.DarkSlateBlue;
            item.ForeColor = Color.White;
        }
        else if (vk == 0 && overrideStatus is null)
        {
            item.ForeColor = Color.Gray;
        }

        lvLog.Items.Insert(0, item);
        lvLog.EnsureVisible(0);

        // Keep at most 100 entries
        while (lvLog.Items.Count > 100)
        {
            lvLog.Items.RemoveAt(lvLog.Items.Count - 1);
        }
    }

    // ───────── Log Copy ─────────

    private static string FormatLogItems(ListView.ListViewItemCollection items)
    {
        var lines = new System.Text.StringBuilder();
        foreach (ListViewItem item in items)
        {
            var cols = new string[item.SubItems.Count];
            for (int i = 0; i < item.SubItems.Count; i++)
                cols[i] = item.SubItems[i].Text;
            lines.AppendLine(string.Join('\t', cols));
        }
        return lines.ToString();
    }

    private static string FormatLogItems(ListView.SelectedListViewItemCollection items)
    {
        var lines = new System.Text.StringBuilder();
        foreach (ListViewItem item in items)
        {
            var cols = new string[item.SubItems.Count];
            for (int i = 0; i < item.SubItems.Count; i++)
                cols[i] = item.SubItems[i].Text;
            lines.AppendLine(string.Join('\t', cols));
        }
        return lines.ToString();
    }

    private void LogMenuCopySelected_Click(object? sender, EventArgs e)
    {
        if (lvLog.SelectedItems.Count == 0) return;
        Clipboard.SetText(FormatLogItems(lvLog.SelectedItems));
    }

    private void LogMenuCopyAll_Click(object? sender, EventArgs e)
    {
        if (lvLog.Items.Count == 0) return;
        Clipboard.SetText(FormatLogItems(lvLog.Items));
    }

    // ───────── Mappings ─────────

    private void BtnResetDefaults_Click(object? sender, EventArgs e)
    {
        var result = MessageBox.Show(
            "Reset all key mappings to defaults?",
            "Reset Mappings",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question);

        if (result == DialogResult.Yes)
        {
            _config.Mappings = KeyMappingConfig.LoadDefaults().Mappings;
            PopulateMappingsGrid();
            SaveConfiguration();
        }
    }

    private void BtnSaveMappings_Click(object? sender, EventArgs e)
    {
        // Validate all key names before saving
        foreach (DataGridViewRow row in dgvMappings.Rows)
        {
            var keyName = row.Cells[2].Value?.ToString() ?? "";
            if (!string.IsNullOrEmpty(keyName) && KeyboardService.GetVirtualKeyCode(keyName) == 0)
            {
                MessageBox.Show(
                    $"Unknown key name: \"{keyName}\" for action \"{row.Cells[0].Value}\".\n" +
                    "Use names like: Right, Left, Space, F5, Escape, or a single letter.",
                    "Invalid Key",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning);
                return;
            }
        }

        SaveConfiguration();
        MessageBox.Show("Mappings saved.", "Saved", MessageBoxButtons.OK, MessageBoxIcon.Information);
    }
}
