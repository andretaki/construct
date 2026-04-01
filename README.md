<div align="center">

```
 ██████╗ ██████╗ ███╗   ██╗███████╗████████╗██████╗ ██╗   ██╗ ██████╗████████╗
██╔════╝██╔═══██╗████╗  ██║██╔════╝╚══██╔══╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝
██║     ██║   ██║██╔██╗ ██║███████╗   ██║   ██████╔╝██║   ██║██║        ██║
██║     ██║   ██║██║╚██╗██║╚════██║   ██║   ██╔══██╗██║   ██║██║        ██║
╚██████╗╚██████╔╝██║ ╚████║███████║   ██║   ██║  ██║╚██████╔╝╚██████╗   ██║
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝  ╚═════╝   ╚═╝
```

**A multi-terminal grid IDE that knows kung fu.**

*"This is the Construct. It's our loading program."*

---

[![Electron](https://img.shields.io/badge/Electron-41-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![xterm.js](https://img.shields.io/badge/xterm.js-5.3-green?style=flat-square)](https://xtermjs.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue?style=flat-square)](https://opensource.org/licenses/ISC)

</div>

---

## What is this

Construct is a configurable multi-terminal grid workspace built with Electron, xterm.js, and node-pty. It gives you 1 to 12 terminals in a single window with preset grid layouts you can switch on the fly.

It boots with a Matrix digital rain sequence, weaves subliminal quotes from the film into the rain, and goes into a screensaver after 3 minutes idle.

It's a terminal multiplexer with a soul.

## Getting started

```bash
git clone https://github.com/andretaki/construct.git
cd construct
npm install
npm start
```

> Requires **Node.js 18+** and a system that can compile native modules ([node-pty](https://github.com/nicktomlin/node-pty)).

## Features

### Configurable terminal grid

Press **`Ctrl+Shift+G`** to open the layout picker and choose how many terminals you want. Your choice is remembered across sessions.

| Layout | Grid |
|---|---|
| 1 terminal | 1x1 |
| 2 terminals | 2x1 (side by side) |
| 3 terminals | 3x1 (triple) |
| 4 terminals | 2x2 |
| **6 terminals** | **3x2 (default)** |
| 8 terminals | 4x2 |
| 9 terminals | 3x3 |
| 12 terminals | 4x3 |

Each pane independently resizes to fill its grid cell. Add or remove terminals without losing existing sessions — shrinking kills the rightmost/bottom terminals, growing adds new ones.

### Split dimming + focused pane glow

Inactive terminals fade to 35% darkness so the focused pane dominates your attention. The active terminal gets a multi-layered blue glow — locked terminals glow red instead. Combined, it feels like the focused pane is floating forward out of the void.

### Window transparency

The terminal background is semi-transparent (85% opacity) so your desktop shows through. Text stays fully opaque — readability is never sacrificed. Requires a compositor on Linux/WSL2.

### Focus-follows-mouse

Hover over a terminal pane and it automatically gets focus — no clicking. 50ms debounce prevents flicker. Disabled while overlays (palette, search) are open.

### Pane zoom

Press **`Ctrl+Shift+Z`** to zoom the focused terminal to fill the entire grid. All other panes hide. A `[Z]` badge appears in the label and the glow intensifies. Press again to unzoom. Switching terminals with `Ctrl+1-9` unzooms automatically.

### Resize overlay

A HUD-style overlay shows the terminal dimensions (`cols x rows`) centered on screen whenever the window is resized. Fades out after 800ms. Also appears briefly when changing layouts.

### Matrix rain boot sequence

Full-screen digital rain on launch using katakana characters and alphanumerics. Runs for 2.5 seconds then fades into your terminal grid.

### Subliminal messages

Quotes from The Matrix trail vertically through the rain like falling columns of text — *"wake up"*, *"there is no spoon"*, *"follow the white rabbit"*, *"free your mind"*, *"I know kung fu"*, and more. They appear every ~8 seconds during rain, blending in with the same font and a subtle green glow.

### AFK screensaver

After 3 minutes of no keyboard or mouse activity, the Matrix rain returns as a screensaver. Any keypress or mouse movement fades it out and returns focus to your terminal. You can also toggle rain manually with `Ctrl+Shift+M`.

### Broadcast mode

Press **`Ctrl+Shift+B`** to type in all terminals simultaneously. A red status bar appears at the top. Locked terminals are excluded from broadcast input. Press the shortcut again to exit.

### Snippet palette

Press **`Ctrl+Shift+P`** to open a searchable command palette with common commands:

- `ls -la`, `git status`, `git log --oneline -20`, `df -h`
- `ps aux | head -20`, `docker ps`, `ss -tlnp`, `uname -a`

Type to filter, arrow keys to navigate, Enter to execute in the focused terminal. You can also type a custom command and press Enter.

### Search

**`Ctrl+Shift+F`** opens a search bar for the active terminal. Type to search, Enter for next match, Shift+Enter for previous. Press Escape to close.

### Terminal labels

Each terminal has a number badge and a name label (defaults to "shell"). **Double-click** the label name to rename it — useful for tracking what each pane is for.

### Read-only lock

Press **`Ctrl+Shift+L`** to lock the focused terminal. Locked terminals:
- Ignore all keyboard input (including broadcast mode)
- Show a lock icon in the label
- Get a red border highlight

Press the shortcut again to unlock.

### Multiline paste warning

When you paste text containing multiple lines, Construct shows a confirmation dialog with the line count before sending it to the terminal. Prevents accidental execution of multi-line clipboard content.

### Process notifications

When a command finishes in a terminal while the window is not focused, you get a desktop notification telling you which terminal completed. Triggers after 3 seconds of no output following activity.

### WebGL rendering

Terminals use GPU-accelerated WebGL rendering via `xterm-addon-webgl` for smooth scrolling and fast output. Falls back to Canvas 2D automatically if WebGL is not available.

### Global hotkey

Press **`F12`** from anywhere to toggle the Construct window — Quake-style drop-down. If the window is visible and focused, it hides. Otherwise, it shows and focuses.

### Frameless window

Custom titlebar with minimize, maximize, and close buttons. The titlebar is draggable for window positioning. No native window chrome — clean, minimal look.

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` through `Ctrl+9` | Focus terminal 1-9 |
| `` Ctrl+` `` | Cycle focus to next terminal |
| `Ctrl+Shift+G` | Layout picker (choose terminal count) |
| `Ctrl+Shift+Z` | Toggle pane zoom (fullscreen focused terminal) |
| `Ctrl+Shift+B` | Toggle broadcast mode |
| `Ctrl+Shift+F` | Search in active terminal |
| `Ctrl+Shift+P` | Snippet palette |
| `Ctrl+Shift+L` | Toggle read-only lock on focused terminal |
| `Ctrl+Shift+M` | Toggle Matrix rain manually |
| `Ctrl+Shift+C` | Copy selection |
| `Ctrl+Shift+V` | Paste from clipboard |
| `F12` | Global show/hide |

## Theme

**Midnight Drift** — a [Catppuccin Mocha](https://github.com/catppuccin/catppuccin)-inspired dark palette.

| | Color | Hex |
|---|---|---|
| Background | ![#1e1e2e](https://via.placeholder.com/12/1e1e2e/1e1e2e.png) | `#1e1e2e` |
| Foreground | ![#cdd6f4](https://via.placeholder.com/12/cdd6f4/cdd6f4.png) | `#cdd6f4` |
| Cursor | ![#f5e0dc](https://via.placeholder.com/12/f5e0dc/f5e0dc.png) | `#f5e0dc` |
| Red | ![#f38ba8](https://via.placeholder.com/12/f38ba8/f38ba8.png) | `#f38ba8` |
| Green | ![#a6e3a1](https://via.placeholder.com/12/a6e3a1/a6e3a1.png) | `#a6e3a1` |
| Yellow | ![#f9e2af](https://via.placeholder.com/12/f9e2af/f9e2af.png) | `#f9e2af` |
| Blue | ![#89b4fa](https://via.placeholder.com/12/89b4fa/89b4fa.png) | `#89b4fa` |
| Magenta | ![#cba6f7](https://via.placeholder.com/12/cba6f7/cba6f7.png) | `#cba6f7` |
| Cyan | ![#94e2d5](https://via.placeholder.com/12/94e2d5/94e2d5.png) | `#94e2d5` |

## Architecture

```
construct/
├── main.js          # Electron main process — window, PTY spawning, IPC
├── preload.js       # Context bridge — exposes safe IPC to renderer
├── renderer.js      # Terminal grid, Matrix rain engine, UI logic
├── styles.css       # Midnight Drift theme, layout, animations
└── index.html       # Shell — titlebar, grid, overlays
```

**Single-process simplicity.** No frameworks, no bundler, no build step. Just Electron + xterm.js + node-pty.

- **main.js** — Creates the Electron window, spawns PTY processes (up to 16), manages IPC between the renderer and the shell processes, handles the F12 global hotkey and desktop notifications.
- **preload.js** — Context bridge that exposes a safe `terminalAPI` (send, receive, resize, kill) and `windowAPI` (minimize, maximize, close) to the renderer without giving it full Node.js access.
- **renderer.js** — The entire frontend in one file. Manages the dynamic terminal grid, Matrix rain canvas animation, layout picker, snippet palette, search, broadcast mode, AFK screensaver, and all keyboard shortcuts.
- **styles.css** — Midnight Drift color scheme, CSS grid layout, overlay and palette styling, scrollbar customization, and all transitions/animations.
- **index.html** — Minimal shell with the titlebar, overlay containers, and script tags. Terminal cells are generated dynamically by the renderer.

## How it works

1. **Boot** — Electron opens a frameless window. The Matrix rain canvas runs for 2.5s then fades out.
2. **Terminal creation** — `setLayout()` reads your saved layout from `localStorage` (default: 6 terminals in a 3x2 grid). It generates DOM elements and creates xterm.js `Terminal` instances for each cell.
3. **PTY spawning** — Each terminal connects to a PTY process via IPC. PTYs are spawned lazily on first input. The main process buffers output and flushes at 60fps to prevent IPC flooding.
4. **Layout changes** — `Ctrl+Shift+G` opens the layout picker. Switching layouts preserves existing terminal sessions. Growing the grid adds new terminals; shrinking kills the excess PTYs and removes their DOM nodes.
5. **AFK detection** — A timer resets on any keyboard/mouse activity. After 3 minutes idle, the Matrix rain canvas is activated as a screensaver overlay.

## License

[ISC](https://opensource.org/licenses/ISC)

---

<div align="center">

*"I know you're out there. I can feel you now."*

</div>
