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
    private Label lblUrl;
    private TextBox txtUrl;
    private Button btnConnect;
    private Label lblStatus;

    // Command log group
    private GroupBox grpLog;
    private ListView lvLog;
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

    // Status strip
    private StatusStrip statusStrip;
    private ToolStripStatusLabel statusLabel;
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
        lblUrl = new Label();
        txtUrl = new TextBox();
        btnConnect = new Button();
        lblStatus = new Label();

        grpConnection.SuspendLayout();

        grpConnection.Text = "Connection";
        grpConnection.Location = new Point(12, 12);
        grpConnection.Size = new Size(460, 90);

        lblUrl.Text = "Client Access URL:";
        lblUrl.Location = new Point(10, 25);
        lblUrl.AutoSize = true;

        txtUrl.Location = new Point(130, 22);
        txtUrl.Size = new Size(220, 23);
        txtUrl.PlaceholderText = "wss://...webpubsub.azure.com/...";

        btnConnect.Text = "Connect";
        btnConnect.Location = new Point(360, 21);
        btnConnect.Size = new Size(90, 25);

        lblStatus.Text = "Disconnected";
        lblStatus.ForeColor = Color.Red;
        lblStatus.Location = new Point(130, 55);
        lblStatus.AutoSize = true;
        lblStatus.Font = new Font(lblStatus.Font, FontStyle.Bold);

        grpConnection.Controls.Add(lblUrl);
        grpConnection.Controls.Add(txtUrl);
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
        grpLog.Location = new Point(12, 110);
        grpLog.Size = new Size(460, 150);

        colTime.Text = "Time";
        colTime.Width = 80;
        colMode.Text = "Mode";
        colMode.Width = 90;
        colAction.Text = "Action";
        colAction.Width = 120;
        colKey.Text = "Key Sent";
        colKey.Width = 140;

        lvLog.View = View.Details;
        lvLog.FullRowSelect = true;
        lvLog.GridLines = true;
        lvLog.Location = new Point(10, 22);
        lvLog.Size = new Size(440, 118);
        lvLog.Columns.AddRange(new ColumnHeader[] { colTime, colMode, colAction, colKey });

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

        grpMappings.SuspendLayout();
        ((System.ComponentModel.ISupportInitialize)dgvMappings).BeginInit();

        grpMappings.Text = "Key Mappings";
        grpMappings.Location = new Point(12, 268);
        grpMappings.Size = new Size(460, 200);

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
        dgvMappings.Size = new Size(440, 135);
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
        btnResetDefaults.Location = new Point(240, 164);
        btnResetDefaults.Size = new Size(100, 28);

        btnSaveMappings.Text = "Save Mappings";
        btnSaveMappings.Location = new Point(350, 164);
        btnSaveMappings.Size = new Size(100, 28);

        grpMappings.Controls.Add(dgvMappings);
        grpMappings.Controls.Add(btnResetDefaults);
        grpMappings.Controls.Add(btnSaveMappings);

        ((System.ComponentModel.ISupportInitialize)dgvMappings).EndInit();
        grpMappings.ResumeLayout(false);

        // === StatusStrip ===
        statusStrip = new StatusStrip();
        statusLabel = new ToolStripStatusLabel();
        messageCountLabel = new ToolStripStatusLabel();

        statusStrip.SuspendLayout();

        statusLabel.Text = "Disconnected";
        statusLabel.Spring = true;
        statusLabel.TextAlign = ContentAlignment.MiddleLeft;

        messageCountLabel.Text = "Messages: 0";
        messageCountLabel.TextAlign = ContentAlignment.MiddleRight;

        statusStrip.Items.AddRange(new ToolStripItem[] { statusLabel, messageCountLabel });

        statusStrip.ResumeLayout(false);
        statusStrip.PerformLayout();

        // === MainForm ===
        SuspendLayout();

        AutoScaleDimensions = new SizeF(7F, 15F);
        AutoScaleMode = AutoScaleMode.Font;
        ClientSize = new Size(484, 501);
        FormBorderStyle = FormBorderStyle.FixedSingle;
        MaximizeBox = false;
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
