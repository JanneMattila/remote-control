namespace RemoteControl;

/// <summary>
/// Entry point for the Remote Control Receiver application.
/// Ensures single-instance execution using a named Mutex.
/// </summary>
static class Program
{
    private const string MutexName = "Global\\RemoteControlReceiver_SingleInstance";

    [STAThread]
    static void Main()
    {
        using var mutex = new Mutex(true, MutexName, out bool createdNew);
        if (!createdNew)
        {
            MessageBox.Show(
                "Remote Control Receiver is already running.\nCheck the system tray.",
                "Remote Control Receiver",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm());
    }
}
