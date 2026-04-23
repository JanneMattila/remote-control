namespace RemoteControl;

partial class MainForm
{
    private System.ComponentModel.IContainer components = null;

    // Tray
    private NotifyIcon notifyIcon;
    private ContextMenuStrip trayMenu;
    private ToolStripMenuItem trayMenuOpen;
    private ToolStripMenuItem trayMenuConnect;
    private ToolStripSeparator trayMenuSeparator;
    private ToolStripMenuItem trayMenuExit;

    // Connection group
    private GroupBox grpConnection;
    private Label lblConnStr;
    private TextBox txtConnStr;
    private Label lblHub;
    private TextBox txtHub;
    private Button btnConnect;
    private Label lblStatus;

    // Command log group
    private GroupBox grpLog;
    private ListView lvLog;
    private ContextMenuStrip logContextMenu;
    private ToolStripMenuItem logMenuCopyAll;
    private ToolStripMenuItem logMenuCopySelected;
    private ColumnHeader colTime;
    private ColumnHeader colMode;
    private ColumnHeader colAction;
    private ColumnHeader colKey;

    // Key mappings group
    private GroupBox grpMappings;
    private DataGridView dgvMappings;
    private DataGridViewTextBoxColumn colMappingAction;
    private DataGridViewTextBoxColumn colMappingDisplay;
    private DataGridViewTextBoxColumn colMappingKey;
    private Button btnResetDefaults;
    private Button btnSaveMappings;
    private Button btnReloadKeyboard;

    // Status strip
    private StatusStrip statusStrip;
    private ToolStripStatusLabel statusLabel;
    private ToolStripStatusLabel lastReceivedLabel;
    private ToolStripStatusLabel remoteStatusLabel;
    private ToolStripStatusLabel messageCountLabel;

    protected override void Dispose(bool disposing)
    {
        if (disposing && (components != null))
        {
            components.Dispose();
        }
        base.Dispose(disposing);
    }

    private void InitializeComponent()
    {
        components = new System.ComponentModel.Container();

        // === NotifyIcon and Tray Menu ===
        trayMenu = new ContextMenuStrip(components);
        trayMenuOpen = new ToolStripMenuItem("Open");
        trayMenuConnect = new ToolStripMenuItem("Connect");
        trayMenuSeparator = new ToolStripSeparator();
        trayMenuExit = new ToolStripMenuItem("Exit");

        trayMenu.Items.AddRange(new ToolStripItem[]
        {
            trayMenuOpen,
            trayMenuConnect,
            trayMenuSeparator,
            trayMenuExit
        });

        notifyIcon = new NotifyIcon(components)
        {
            ContextMenuStrip = trayMenu,
            Text = "Remote Control Receiver",
            Icon = SystemIcons.Application,
            Visible = true
        };

        // === Connection GroupBox ===
        grpConnection = new GroupBox();
        lblConnStr = new Label();
        txtConnStr = new TextBox();
        lblHub = new Label();
        txtHub = new TextBox();
        btnConnect = new Button();
        lblStatus = new Label();

        grpConnection.SuspendLayout();

        grpConnection.Text = "Connection";
        grpConnection.Location = new Point(12, 12);
        grpConnection.Size = new Size(460, 115);
        grpConnection.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;

        lblConnStr.Text = "Connection String:";
        lblConnStr.Location = new Point(10, 25);
        lblConnStr.AutoSize = true;

        txtConnStr.Location = new Point(130, 22);
        txtConnStr.Size = new Size(318, 23);
        txtConnStr.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        txtConnStr.PlaceholderText = "Endpoint=https://...;AccessKey=...;Version=1.0;";
        txtConnStr.UseSystemPasswordChar = true;

        lblHub.Text = "Hub Name:";
        lblHub.Location = new Point(10, 55);
        lblHub.AutoSize = true;

        txtHub.Location = new Point(130, 52);
        txtHub.Size = new Size(130, 23);
        txtHub.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
        txtHub.Text = "Hub";

        btnConnect.Text = "Connect";
        btnConnect.Location = new Point(360, 51);
        btnConnect.Size = new Size(90, 25);
        btnConnect.Anchor = AnchorStyles.Top | AnchorStyles.Right;

        lblStatus.Text = "Disconnected";
        lblStatus.ForeColor = Color.Red;
        lblStatus.Location = new Point(130, 85);
        lblStatus.AutoSize = true;
        lblStatus.Font = new Font(lblStatus.Font, FontStyle.Bold);

        grpConnection.Controls.Add(lblConnStr);
        grpConnection.Controls.Add(txtConnStr);
        grpConnection.Controls.Add(lblHub);
        grpConnection.Controls.Add(txtHub);
        grpConnection.Controls.Add(btnConnect);
        grpConnection.Controls.Add(lblStatus);
        grpConnection.ResumeLayout(false);
        grpConnection.PerformLayout();

        // === Command Log GroupBox ===
        grpLog = new GroupBox();
        lvLog = new ListView();
        colTime = new ColumnHeader();
        colMode = new ColumnHeader();
        colAction = new ColumnHeader();
        colKey = new ColumnHeader();

        grpLog.SuspendLayout();

        grpLog.Text = "Command Log";
        grpLog.Location = new Point(12, 135);
        grpLog.Size = new Size(460, 150);
        grpLog.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;

        logContextMenu = new ContextMenuStrip();
        logMenuCopySelected = new ToolStripMenuItem("Copy Selected");
        logMenuCopyAll = new ToolStripMenuItem("Copy All");
        logContextMenu.Items.AddRange(new ToolStripItem[] { logMenuCopySelected, logMenuCopyAll });

        colTime.Text = "Time";
        colTime.Width = 80;
        colMode.Text = "Mode";
        colMode.Width = 90;
        colAction.Text = "Action";
        colAction.Width = 120;
        colKey.Text = "Status";
        colKey.Width = 140;

        lvLog.View = View.Details;
        lvLog.FullRowSelect = true;
        lvLog.GridLines = true;
        lvLog.Location = new Point(10, 22);
        lvLog.Size = new Size(440, 118);
        lvLog.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        lvLog.Columns.AddRange(new ColumnHeader[] { colTime, colMode, colAction, colKey });
        lvLog.ContextMenuStrip = logContextMenu;

        grpLog.Controls.Add(lvLog);
        grpLog.ResumeLayout(false);

        // === Key Mappings GroupBox ===
        grpMappings = new GroupBox();
        dgvMappings = new DataGridView();
        colMappingAction = new DataGridViewTextBoxColumn();
        colMappingDisplay = new DataGridViewTextBoxColumn();
        colMappingKey = new DataGridViewTextBoxColumn();
        btnResetDefaults = new Button();
        btnSaveMappings = new Button();
        btnReloadKeyboard = new Button();

        grpMappings.SuspendLayout();
        ((System.ComponentModel.ISupportInitialize)dgvMappings).BeginInit();

        grpMappings.Text = "Key Mappings";
        grpMappings.Location = new Point(12, 293);
        grpMappings.Size = new Size(460, 200);
        grpMappings.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;

        colMappingAction.HeaderText = "Action";
        colMappingAction.Name = "colMappingAction";
        colMappingAction.ReadOnly = true;
        colMappingAction.Width = 110;

        colMappingDisplay.HeaderText = "Display Name";
        colMappingDisplay.Name = "colMappingDisplay";
        colMappingDisplay.ReadOnly = true;
        colMappingDisplay.Width = 130;

        colMappingKey.HeaderText = "Key";
        colMappingKey.Name = "colMappingKey";
        colMappingKey.Width = 130;

        dgvMappings.Location = new Point(10, 22);
        dgvMappings.Size = new Size(440, 120);
        dgvMappings.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
        dgvMappings.AllowUserToAddRows = false;
        dgvMappings.AllowUserToDeleteRows = false;
        dgvMappings.AllowUserToResizeRows = false;
        dgvMappings.RowHeadersVisible = false;
        dgvMappings.SelectionMode = DataGridViewSelectionMode.FullRowSelect;
        dgvMappings.AutoSizeColumnsMode = DataGridViewAutoSizeColumnsMode.Fill;
        dgvMappings.Columns.AddRange(new DataGridViewColumn[]
        {
            colMappingAction,
            colMappingDisplay,
            colMappingKey
        });

        btnResetDefaults.Text = "Reset Defaults";
        btnResetDefaults.Location = new Point(10, 164);
        btnResetDefaults.Size = new Size(115, 28);
        btnResetDefaults.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;

        btnReloadKeyboard.Text = "Reload Keyboard";
        btnReloadKeyboard.Location = new Point(131, 164);
        btnReloadKeyboard.Size = new Size(115, 28);
        btnReloadKeyboard.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;

        btnSaveMappings.Text = "Save Mappings";
        btnSaveMappings.Location = new Point(335, 164);
        btnSaveMappings.Size = new Size(115, 28);
        btnSaveMappings.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;

        grpMappings.Controls.Add(dgvMappings);
        grpMappings.Controls.Add(btnResetDefaults);
        grpMappings.Controls.Add(btnReloadKeyboard);
        grpMappings.Controls.Add(btnSaveMappings);

        ((System.ComponentModel.ISupportInitialize)dgvMappings).EndInit();
        grpMappings.ResumeLayout(false);

        // === StatusStrip ===
        statusStrip = new StatusStrip();
        statusLabel = new ToolStripStatusLabel();
        lastReceivedLabel = new ToolStripStatusLabel();
        remoteStatusLabel = new ToolStripStatusLabel();
        messageCountLabel = new ToolStripStatusLabel();

        statusStrip.SuspendLayout();

        statusLabel.Text = "Disconnected";
        statusLabel.TextAlign = ContentAlignment.MiddleLeft;

        lastReceivedLabel.Text = "Last: —";
        lastReceivedLabel.TextAlign = ContentAlignment.MiddleLeft;

        remoteStatusLabel.Text = "Remote: —";
        remoteStatusLabel.Spring = true;
        remoteStatusLabel.TextAlign = ContentAlignment.MiddleLeft;

        messageCountLabel.Text = "Messages: 0";
        messageCountLabel.TextAlign = ContentAlignment.MiddleRight;

        statusStrip.Items.AddRange(new ToolStripItem[] { statusLabel, lastReceivedLabel, remoteStatusLabel, messageCountLabel });
        statusStrip.Dock = DockStyle.Bottom;

        statusStrip.ResumeLayout(false);
        statusStrip.PerformLayout();

        // === MainForm ===
        SuspendLayout();

        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(484, 526);
        FormBorderStyle = FormBorderStyle.Sizable;
        MaximizeBox = true;
        MinimizeBox = true;
        Text = "Remote Control Receiver";
        ShowInTaskbar = false;
        WindowState = FormWindowState.Minimized;

        Controls.Add(grpConnection);
        Controls.Add(grpLog);
        Controls.Add(grpMappings);
        Controls.Add(statusStrip);

        ResumeLayout(false);
        PerformLayout();
    }
}
