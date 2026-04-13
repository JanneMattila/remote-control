using System.Runtime.InteropServices;

namespace RemoteControl.Services;

/// <summary>
/// Provides keyboard simulation using Win32 P/Invoke.
/// Uses keybd_event for reliable key press simulation across applications.
/// </summary>
public static partial class KeyboardService
{
    private const uint KEYEVENTF_KEYDOWN = 0x0000;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    [LibraryImport("user32.dll", SetLastError = true)]
    private static partial void keybd_event(byte bVk, byte bScan, uint dwFlags, nuint dwExtraInfo);

    /// <summary>
    /// Simulates a key press (down + up) for the specified virtual key code.
    /// </summary>
    /// <param name="virtualKeyCode">The Windows virtual key code to simulate.</param>
    public static void SendKey(byte virtualKeyCode)
    {
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(50);
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYUP, 0);
    }

    /// <summary>
    /// Simulates a key press using a <see cref="Keys"/> enum value.
    /// </summary>
    /// <param name="key">The key to simulate.</param>
    public static void SendKey(Keys key)
    {
        SendKey((byte)key);
    }

    /// <summary>
    /// Simulates a key combination (modifier + key), e.g. Shift+F5.
    /// </summary>
    public static void SendKeyCombination(byte modifier, byte virtualKeyCode)
    {
        keybd_event(modifier, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(30);
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(50);
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYUP, 0);
        Thread.Sleep(30);
        keybd_event(modifier, 0, KEYEVENTF_KEYUP, 0);
    }

    /// <summary>
    /// Simulates a key combination with two modifiers (mod1 + mod2 + key), e.g. Win+Ctrl+Left.
    /// </summary>
    public static void SendKeyCombination(byte modifier1, byte modifier2, byte virtualKeyCode)
    {
        keybd_event(modifier1, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(20);
        keybd_event(modifier2, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(20);
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYDOWN, 0);
        Thread.Sleep(50);
        keybd_event(virtualKeyCode, 0, KEYEVENTF_KEYUP, 0);
        Thread.Sleep(20);
        keybd_event(modifier2, 0, KEYEVENTF_KEYUP, 0);
        Thread.Sleep(20);
        keybd_event(modifier1, 0, KEYEVENTF_KEYUP, 0);
    }

    /// <summary>
    /// Resolves a friendly key name to a Windows virtual key code.
    /// </summary>
    /// <param name="keyName">
    /// Friendly name such as "Right", "Left", "Space", "F5", "Escape", or a single letter.
    /// </param>
    /// <returns>The virtual key code, or 0 if the name is not recognized.</returns>
    public static byte GetVirtualKeyCode(string keyName)
    {
        if (string.IsNullOrWhiteSpace(keyName))
            return 0;

        return keyName.ToUpperInvariant() switch
        {
            "RIGHT" => (byte)Keys.Right,
            "LEFT" => (byte)Keys.Left,
            "UP" => (byte)Keys.Up,
            "DOWN" => (byte)Keys.Down,
            "SPACE" => (byte)Keys.Space,
            "ENTER" or "RETURN" => (byte)Keys.Return,
            "ESCAPE" or "ESC" => (byte)Keys.Escape,
            "TAB" => (byte)Keys.Tab,
            "BACKSPACE" => (byte)Keys.Back,
            "DELETE" => (byte)Keys.Delete,
            "HOME" => (byte)Keys.Home,
            "END" => (byte)Keys.End,
            "PAGEUP" => (byte)Keys.PageUp,
            "PAGEDOWN" => (byte)Keys.PageDown,
            "F1" => (byte)Keys.F1,
            "F2" => (byte)Keys.F2,
            "F3" => (byte)Keys.F3,
            "F4" => (byte)Keys.F4,
            "F5" => (byte)Keys.F5,
            "F6" => (byte)Keys.F6,
            "F7" => (byte)Keys.F7,
            "F8" => (byte)Keys.F8,
            "F9" => (byte)Keys.F9,
            "F10" => (byte)Keys.F10,
            "F11" => (byte)Keys.F11,
            "F12" => (byte)Keys.F12,
            _ when keyName.Length == 1 && char.IsLetterOrDigit(keyName[0]) =>
                (byte)char.ToUpperInvariant(keyName[0]),
            _ => 0
        };
    }

    /// <summary>
    /// Returns a list of all supported friendly key names.
    /// </summary>
    public static string[] GetSupportedKeyNames()
    {
        return
        [
            "Right", "Left", "Up", "Down",
            "Space", "Enter", "Escape", "Tab",
            "Backspace", "Delete", "Home", "End",
            "PageUp", "PageDown",
            "F1", "F2", "F3", "F4", "F5", "F6",
            "F7", "F8", "F9", "F10", "F11", "F12",
            "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
            "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
            "U", "V", "W", "X", "Y", "Z",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"
        ];
    }
}
