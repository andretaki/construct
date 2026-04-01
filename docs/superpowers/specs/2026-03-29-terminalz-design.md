# Terminalz — 6-Terminal Grid IDE

## Overview

Electron desktop app that displays 6 terminal emulators in a fixed 3x2 grid. Each terminal runs a real shell process via node-pty, rendered with xterm.js. No resizing, no tabs, no settings — just 6 terminals filling the window.

## Architecture

Two-process Electron architecture:

- **Main process** (`main.js`) — creates BrowserWindow, spawns 6 node-pty shell processes, bridges IPC between renderer and PTYs
- **Renderer process** (`renderer.js`) — creates 6 xterm.js Terminal instances in a CSS Grid, communicates with main via ipcRenderer through a preload bridge

## Data Flow

```
Renderer (xterm.js × 6)  ←— IPC channels —→  Main (node-pty × 6)
     ↑ user types                                    ↓ spawns shell
     ← terminal output ←——————————————————← shell stdout/stderr
```

Each terminal gets a unique ID (0-5). IPC channels are namespaced:
- `pty-input-{id}` — keystrokes from renderer to main
- `pty-output-{id}` — shell output from main to renderer
- `pty-resize-{id}` — terminal dimensions from renderer to main

## File Structure

```
terminalz/
├── package.json
├── main.js          # Electron main process + PTY management
├── preload.js       # contextBridge IPC API for renderer
├── renderer.js      # Creates 6 xterm instances, wires to IPC
├── index.html       # CSS Grid layout (3 cols × 2 rows)
└── styles.css       # Grid layout + terminal styling
```

## Technical Decisions

### Security
- `contextIsolation: true` with preload script
- `nodeIntegration: false` — no Node.js in renderer
- Preload exposes only the specific IPC methods needed

### Layout
- CSS Grid: `grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(2, 1fr)`
- Each cell contains one xterm.js instance
- `xterm-addon-fit` auto-sizes terminals to fill their grid cells
- Window resize triggers fit on all 6 terminals

### Shell
- Default: `process.env.SHELL` on macOS/Linux, `powershell.exe` on Windows
- Each PTY gets the terminal's current dimensions via resize IPC

### Styling
- Dark background, no chrome
- 1px border between terminal cells for visual separation
- No scrollbar customization beyond xterm defaults

## Explicit Non-Goals

- No resizable/draggable panes
- No tab management
- No settings UI or config files
- No theme support
- No custom keybindings
- No search within terminals
- No copy/paste beyond OS defaults
