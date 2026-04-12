# Remote Control

A two-app system for remotely controlling presentations, media players, and custom applications using **Azure Web PubSub**.

## Overview

```
┌─────────────────────┐       Azure Web PubSub        ┌──────────────────────┐
│  SPA Remote Control │ ──── (WebSocket / JSON) ────> │  WinForms Receiver   │
│  (Mobile Browser)   │       Group: "remote"         │  (Desktop, sys tray) │
│  Sends commands     │                               │  Simulates key press │
└─────────────────────┘                               └──────────────────────┘
```

| Component | Technology | Location |
|-----------|-----------|----------|
| **Remote Control** (sender) | Vanilla HTML/CSS/JS PWA | `/docs/` — hosted on GitHub Pages |
| **Receiver** (desktop) | .NET 10 Windows Forms | `/src/RemoteControl/` |

## Features

### SPA Remote Control (mobile)

- **Three modes**: PowerPoint, Watch (YouTube/media), and Custom (user-defined buttons)
- **Presentation timer**: Stopwatch and countdown with vibration alerts
- **PWA**: Installable, works offline (UI only), keeps screen awake
- **Settings**: Export/import configuration as JSON, configurable connection
- **Dark theme**: Mobile-first, touch-friendly large buttons with haptic feedback

### Windows Forms Receiver (desktop)

- **System tray app**: Runs hidden in the notification area
- **Keyboard simulation**: Translates commands into key presses via Win32 `keybd_event`
- **Configurable key mappings**: Remap any command to any key
- **Command log**: See received commands and which keys were sent
- **Auto-reconnect**: Reconnects automatically if the connection drops

## Prerequisites

1. **Azure Web PubSub** service instance ([create one](https://learn.microsoft.com/azure/azure-web-pubsub/howto-develop-create-instance))
2. **.NET 10 SDK** (for building the receiver)
3. A modern mobile browser (Chrome, Edge, or Safari)

## Setup

### 1. Configure Azure Web PubSub

1. Create an Azure Web PubSub resource in the [Azure Portal](https://portal.azure.com).
2. Go to **Keys** and note the connection string.
3. Generate a **Client Access URL** for the SPA:
   - Use the Azure Portal **Client URL Generator** (under **Keys**), or
   - Use the Azure CLI / SDK to generate a URL with the following roles:
     - `webpubsub.joinLeaveGroup`
     - `webpubsub.sendToGroup.remote`
   - The URL looks like: `wss://your-service.webpubsub.azure.com/client/hubs/Hub?access_token=...`
4. Generate a separate Client Access URL for the Receiver with at least `webpubsub.joinLeaveGroup` permission.

### 2. Test the SPA Locally

Serve the `/docs` folder with any static file server:

```bash
npx serve docs
```

Then open the URL shown in the terminal (typically [http://localhost:3000](http://localhost:3000)).

> **Note:** The PWA service worker requires either `localhost` or HTTPS. `localhost` works for local development without certificates.

### 3. Deploy the SPA (GitHub Pages)

1. In your GitHub repo settings, enable **GitHub Pages** with source set to the `main` branch and folder `/docs`.
2. The SPA will be available at `https://<username>.github.io/remote-control/`.
3. Open it on your phone and paste the Client Access URL when prompted.

### 4. Build and Run the Receiver

```bash
cd src/RemoteControl
dotnet run
```

The app starts minimized to the system tray. Double-click the tray icon to open settings and paste the Client Access URL.

## Modes & Commands

### PowerPoint Mode

| Button | Action | Default Key |
|--------|--------|-------------|
| ▶ Next Slide | `nextSlide` | Right Arrow |
| ◀ Previous Slide | `prevSlide` | Left Arrow |
| 🎬 Start Slideshow | `startSlideshow` | F5 |
| ⏹ End Slideshow | `endSlideshow` | Escape |
| ⬛ Black Screen | `blackScreen` | B |

### Watch Mode (YouTube / Media)

| Button | Action | Default Key |
|--------|--------|-------------|
| ⏯ Play/Pause | `playPause` | Space |
| 🔊 Volume Up | `volumeUp` | Up Arrow |
| 🔉 Volume Down | `volumeDown` | Down Arrow |
| 🔇 Mute | `mute` | M |
| ⛶ Fullscreen | `fullscreen` | F |
| ⏩ Skip Forward | `skipForward` | Right Arrow |
| ⏪ Skip Back | `skipBack` | Left Arrow |

### Custom Mode

Define your own buttons with custom labels, icons, and action names. The receiver maps action names to keys via the configurable key mappings.

## Configuration

### SPA Config (Export/Import)

All SPA settings (connection URL, selected mode, custom commands, timer preferences) are stored in the browser's `localStorage`. Use the **gear icon** → **Export Config** / **Import Config** to back up or transfer settings as a JSON file.

### Receiver Key Mappings

The receiver stores key mappings in `usersettings.json` next to the executable. Edit mappings in the app UI or directly in the JSON file:

```json
{
  "Mappings": {
    "nextSlide": "Right",
    "prevSlide": "Left",
    "playPause": "Space"
  },
  "ConnectionUrl": "wss://..."
}
```

## Protocol

Both apps communicate via the `json.webpubsub.azure.v1` WebSocket subprotocol. Command messages have this format:

```json
{
  "type": "command",
  "mode": "powerpoint",
  "action": "nextSlide",
  "timestamp": "2026-04-12T16:30:00Z"
}
```

## License

See [LICENSE](LICENSE) for details.
