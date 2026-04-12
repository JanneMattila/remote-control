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

    public MainForm()
    {
        InitializeComponent();
        LoadConfiguration();
        WireEvents();
    }

    // ───────── Configuration ─────────

    private void LoadConfiguration()
    {
        _config = KeyMappingConfig.Load(KeyMappingConfig.GetSettingsPath());
        txtUrl.Text = _config.ConnectionUrl;
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

        _config.ConnectionUrl = txtUrl.Text.Trim();
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

        // Service events
        _pubSubService.StatusChanged += OnStatusChanged;
        _pubSubService.CommandReceived += OnCommandReceived;
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
        if (!string.IsNullOrWhiteSpace(txtUrl.Text))
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

    private void TrayMenuExit_Click(object? sender, EventArgs e)
    {
        ExitApplication();
    }

    private void ShowMainWindow()
    {
        Show();
        WindowState = FormWindowState.Normal;
        ShowInTaskbar = true;
        BringToFront();
        Activate();
    }

    private void ExitApplication()
    {
        _isExiting = true;
        notifyIcon.Visible = false;
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
        var url = txtUrl.Text.Trim();
        if (string.IsNullOrEmpty(url))
        {
            MessageBox.Show(
                "Please enter a Client Access URL.",
                "Connection",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        try
        {
            btnConnect.Enabled = false;
            _config.ConnectionUrl = url;
            SaveConfiguration();
            await _pubSubService.ConnectAsync(url);
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
                break;
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
        var vk = KeyboardService.GetVirtualKeyCode(keyName);

        if (vk != 0)
        {
            KeyboardService.SendKey(vk);
        }

        AddLogEntry(message, keyName, vk);
        _messageCount++;
        messageCountLabel.Text = $"Messages: {_messageCount}";
    }

    private string ResolveKeyName(string action)
    {
        if (_config.Mappings.TryGetValue(action, out var keyName))
            return keyName;

        return "";
    }

    private void AddLogEntry(CommandMessage message, string keyName, byte vk)
    {
        var time = DateTime.Now.ToString("HH:mm:ss");
        var keySent = vk != 0 ? keyName : "(unknown)";
        var item = new ListViewItem(new[] { time, message.Mode, message.Action, keySent });

        lvLog.Items.Insert(0, item);

        // Keep at most 100 entries
        while (lvLog.Items.Count > 100)
        {
            lvLog.Items.RemoveAt(lvLog.Items.Count - 1);
        }
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
