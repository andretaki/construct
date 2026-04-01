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

Construct is a 6-terminal grid workspace built with Electron, xterm.js, and node-pty. It boots with a Matrix digital rain sequence, has subliminal quotes from the film woven into the rain, and goes into a screensaver after 3 minutes idle.

It's a terminal multiplexer with a soul.

## Features

| | |
|---|---|
| **6-terminal grid** | 3x2 layout, each pane independently resizable |
| **Matrix rain boot sequence** | Full-screen digital rain on launch with katakana + alphanumerics |
| **AFK screensaver** | Matrix rain returns after 3 min idle, fades out on keypress |
| **Subliminal messages** | Quotes trail through the rain — *"wake up"*, *"there is no spoon"*, *"free your mind"* |
| **Broadcast mode** | `Ctrl+Shift+B` — type in all 6 terminals simultaneously |
| **Snippet palette** | `Ctrl+Shift+P` — searchable command palette |
| **Search** | `Ctrl+Shift+F` — search across the active terminal |
| **WebGL rendering** | GPU-accelerated terminal rendering via xterm-addon-webgl |
| **Frameless window** | Custom titlebar, native drag, minimize/maximize/close |
| **Terminal labels** | Double-click to rename any pane |
| **Multiline paste warning** | Confirms before pasting multi-line content |
| **Read-only lock** | `Ctrl+Shift+L` — lock a terminal to prevent input |
| **Process notifications** | Desktop notification when a long-running command finishes |
| **Global hotkey** | `F12` to summon from anywhere |

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+1` through `Ctrl+6` | Focus terminal 1-6 |
| `Ctrl+Shift+B` | Toggle broadcast mode |
| `Ctrl+Shift+F` | Search |
| `Ctrl+Shift+P` | Snippet palette |
| `Ctrl+Shift+L` | Toggle read-only lock |
| `Ctrl+Shift+M` | Toggle Matrix rain manually |
| `F12` | Global show/hide |

## Theme

**Midnight Drift** — a Catppuccin Mocha-inspired dark palette.

```
bg: #1e1e2e  fg: #cdd6f4  cursor: #f5e0dc
```

```
red: #f38ba8  green: #a6e3a1  yellow: #f9e2af
blue: #89b4fa  magenta: #cba6f7  cyan: #94e2d5
```

## Getting started

```bash
git clone https://github.com/andretaki/construct.git
cd construct
npm install
npm start
```

> Requires Node.js 18+ and a system that can compile native modules (node-pty).

## Architecture

```
construct/
├── main.js          # Electron main process — window, PTY spawning, IPC
├── preload.js       # Context bridge — exposes safe IPC to renderer
├── renderer.js      # Terminal grid, Matrix rain engine, UI logic
├── styles.css       # Midnight Drift theme, layout, animations
└── index.html       # Shell — titlebar, grid, overlays
```

Single-process simplicity. No frameworks, no bundler, no build step. Just Electron + xterm.js + node-pty.

---

<div align="center">

*"I know you're out there. I can feel you now."*

</div>
