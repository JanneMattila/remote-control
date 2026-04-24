using System.Runtime.InteropServices;

namespace RemoteControl.Services;

/// <summary>
/// Provides keyboard simulation using Win32 P/Invoke.
/// Uses SendInput for reliable key press simulation across applications.
/// </summary>
public static class KeyboardService
{
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public nuint dwExtraInfo;
    }

    // MOUSEINPUT is needed to define the union size (it's the largest member).
    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public nuint dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public InputUnion u;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    private static bool Send(params INPUT[] inputs)
    {
        if (inputs.Length == 0)
            return true;

        int inputSize = Marshal.SizeOf<INPUT>();
        uint sent = SendInput((uint)inputs.Length, inputs, inputSize);

        if (sent == inputs.Length)
            return true;

        if (sent > 0 && sent < inputs.Length)
        {
            int remainingCount = inputs.Length - (int)sent;
            var remaining = new INPUT[remainingCount];
            Array.Copy(inputs, (int)sent, remaining, 0, remainingCount);
            sent += SendInput((uint)remainingCount, remaining, inputSize);
        }

        return sent == inputs.Length;
    }

    private static INPUT KeyDown(byte vk) => new()
    {
        type = INPUT_KEYBOARD,
        u = new InputUnion { ki = new KEYBDINPUT { wVk = vk } }
    };

    private static INPUT KeyUp(byte vk) => new()
    {
        type = INPUT_KEYBOARD,
        u = new InputUnion { ki = new KEYBDINPUT { wVk = vk, dwFlags = KEYEVENTF_KEYUP } }
    };

    /// <summary>
    /// Simulates a key press (down + up) for the specified virtual key code.
    /// </summary>
    public static void SendKey(byte virtualKeyCode)
    {
        Send(KeyDown(virtualKeyCode), KeyUp(virtualKeyCode));
    }

    /// <summary>
    /// Simulates a key press using a <see cref="Keys"/> enum value.
    /// </summary>
    public static void SendKey(Keys key)
    {
        SendKey((byte)key);
    }

    /// <summary>
    /// Simulates a key combination (modifier + key), e.g. Shift+F5.
    /// </summary>
    public static void SendKeyCombination(byte modifier, byte virtualKeyCode)
    {
        Send(
            KeyDown(modifier),
            KeyDown(virtualKeyCode),
            KeyUp(virtualKeyCode),
            KeyUp(modifier)
        );
    }

    /// <summary>
    /// Simulates a key combination with two modifiers (mod1 + mod2 + key), e.g. Win+Ctrl+Left.
    /// </summary>
    public static void SendKeyCombination(byte modifier1, byte modifier2, byte virtualKeyCode)
    {
        Send(
            KeyDown(modifier1),
            KeyDown(modifier2),
            KeyDown(virtualKeyCode),
            KeyUp(virtualKeyCode),
            KeyUp(modifier2),
            KeyUp(modifier1)
        );
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

    /// <summary>
    /// Sends a text string with support for special keys like {Enter}, {Tab}, {Backspace}, etc.
    /// Example: "Hello{Enter}World{Tab}" sends "Hello", then Enter, then "World", then Tab.
    /// </summary>
    public static void SendText(string text)
    {
        if (string.IsNullOrEmpty(text))
            return;

        // For long text payloads, SendKeys is significantly more reliable than building
        // a large KEYEVENTF_UNICODE stream manually with SendInput.
        try
        {
            SendKeys.SendWait(text);
        }
        catch
        {
            // Best-effort fallback for environments where SendKeys cannot execute.
            SendTextWithSendInput(text);
        }
    }

    /// <summary>
    /// Sends a text string using SendInput and supports special keys like {Enter}.
    /// Kept as a fallback implementation in case SendKeys.SendWait is unavailable.
    /// </summary>
    public static void SendTextWithSendInput(string text)
    {
        if (string.IsNullOrEmpty(text))
            return;

        int i = 0;

        while (i < text.Length)
        {
            // Check if we have a special key sequence like {Enter}
            if (text[i] == '{' && text.IndexOf('}', i) > i)
            {
                int closeIndex = text.IndexOf('}', i);
                string keyName = text.Substring(i + 1, closeIndex - i - 1);
                byte vk = GetVirtualKeyCode(keyName);

                if (vk != 0)
                {
                    // Send special keys as a virtual-key down/up pair.
                    Send(KeyDown(vk), KeyUp(vk));
                    i = closeIndex + 1;
                    continue;
                }
            }

            // Regular character - send it using KEYEVENTF_UNICODE
            char ch = text[i];
            ushort scanCode = (ushort)ch;

            var input = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = scanCode,
                        dwFlags = KEYEVENTF_UNICODE,
                        time = 0,
                        dwExtraInfo = 0
                    }
                }
            };

            var inputUp = new INPUT
            {
                type = INPUT_KEYBOARD,
                u = new InputUnion
                {
                    ki = new KEYBDINPUT
                    {
                        wVk = 0,
                        wScan = scanCode,
                        dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP,
                        time = 0,
                        dwExtraInfo = 0
                    }
                }
            };

            // Send each character as its own down/up pair to minimize the risk of
            // partial injection leaving a key logically pressed.
            Send(input, inputUp);

            i++;
        }
    }
}

