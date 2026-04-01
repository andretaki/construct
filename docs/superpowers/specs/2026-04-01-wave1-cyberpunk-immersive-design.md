# Wave 1: Cyberpunk Immersive — Design Spec

**Date:** 2026-04-01
**Goal:** Transform Construct from a functional terminal grid into a cyberpunk-immersive workspace. Six features that make the focused pane glow, the inactive panes recede, the window float over the desktop, and the whole experience feel like being jacked into the Matrix.

**Context:** Inspired by Ghostty's feature set, filtered for power-user productivity + cyberpunk aesthetics. This is Wave 1 of 3 — focused on instant-impact, low-effort features that ship in one session.

---

## 1. Unfocused Split Dimming

### What
Inactive terminal panes get a dark overlay so the focused pane visually dominates.

### Implementation
- Add a `::after` pseudo-element on `.terminal-cell` with `background: rgba(0, 0, 0, 0.35)` covering the full cell
- Remove the overlay on `.terminal-cell:focus-within` via `opacity: 0` on the pseudo-element
- Transition: `opacity 0.2s ease`
- The overlay sits above the terminal content but below the label (`z-index` between xterm and label)

### Defaults
- Dim opacity: `0.35` (35% black overlay)
- Transition duration: `0.2s`

### Files Changed
- `styles.css` — add `::after` pseudo-element rules

---

## 2. Focus-Follows-Mouse

### What
Hovering over a terminal pane automatically focuses it. No click required.

### Implementation
- In `setupTerminal(id)`, attach a `mouseenter` listener on the container element
- On mouseenter, set a 50ms debounce timer. If the mouse is still over the pane after 50ms, call `entries[id].terminal.focus()`
- Clear the timer on `mouseleave`
- Disable when any overlay is active (`layoutPickerVisible`, `snippetVisible`, `searchVisible`, `screensaverActive`)

### Defaults
- Debounce: `50ms`
- Enabled: `true`

### Files Changed
- `renderer.js` — add mouseenter/mouseleave handlers in `setupTerminal()`

---

## 3. Pane Zoom

### What
Toggle the focused terminal to fill the entire grid. Press again to restore.

### Implementation
- Track `zoomedTerminalId` (default: `-1`, meaning no zoom)
- On `Ctrl+Shift+Z`:
  - If not zoomed: set `zoomedTerminalId` to the focused terminal ID
  - If zoomed: set `zoomedTerminalId` to `-1`
- When zoomed:
  - The zoomed cell gets inline styles: `grid-column: 1 / -1; grid-row: 1 / -1`
  - All other cells get `display: none`
  - Add a `[Z]` indicator to the terminal label
  - Intensify the glow effect (see section 6)
- When unzooming:
  - Remove inline styles from all cells
  - Remove the `[Z]` indicator
- Call `refitAll()` after zoom/unzoom (50ms delay for layout to settle)
- Transition: the zoomed cell gets `transition: all 0.15s ease` for a quick scale effect

### Edge Cases
- If the zoomed terminal is removed by a layout change, unzoom first
- Layout picker (`Ctrl+Shift+G`) unzooms before changing layout
- `Ctrl+1-9` while zoomed: unzoom and focus the requested terminal

### Defaults
- Shortcut: `Ctrl+Shift+Z`
- Animation: `0.15s`

### Files Changed
- `renderer.js` — add zoom state, `toggleZoom()`, update keyboard handler, update `setLayout()`

---

## 4. Window Transparency

### What
The terminal window is semi-transparent so the desktop shows through behind the terminal text.

### Implementation

#### Main process (`main.js`)
- Set `transparent: true` on `BrowserWindow` options
- Set `backgroundColor: '#00000000'` (fully transparent default, the renderer controls actual opacity)

#### Renderer/CSS
- `#grid` background: `rgba(17, 17, 27, 0.85)` instead of solid `#11111b`
- `.terminal-cell` background: `rgba(30, 30, 46, 0.85)` instead of solid `#1e1e2e`
- `body` background: `transparent`
- Terminal theme background: `rgba(30, 30, 46, 0.85)` — passed to xterm's `TERMINAL_OPTIONS.theme.background`

#### What stays opaque
- `#titlebar`: solid `#11111b` — window controls must be fully visible
- `#matrix-rain`: solid black background — rain looks wrong with transparency
- `#broadcast-bar`, `#search-bar`, overlays: solid — UI elements stay readable
- xterm text, cursor: fully opaque (xterm renders text on top of the background)

### Defaults
- Background opacity: `0.85` (85%)
- Titlebar: opaque

### Files Changed
- `main.js` — `transparent: true`, `backgroundColor: '#00000000'`
- `styles.css` — rgba backgrounds on body, grid, terminal cells
- `renderer.js` — update `TERMINAL_OPTIONS.theme.background` to rgba

### Platform Note
- On WSL2/Linux, transparency requires a compositor. Without one, the window will appear with a black background (no visual regression, just no transparency effect).

---

## 5. Resize Overlay

### What
A HUD-style overlay in the center of the window showing terminal dimensions (`cols × rows`) during window resize.

### Implementation
- Add a `#resize-overlay` div to `index.html`, hidden by default
- On window resize (in the existing debounced resize handler):
  - Show the overlay with the focused terminal's `cols × rows`
  - Reset a 800ms hide timer
  - After 800ms of no resize events, fade out the overlay
- Also show briefly when `setLayout()` is called

#### Styling
- Position: `fixed`, centered (`top: 50%; left: 50%; transform: translate(-50%, -50%)`)
- Background: `rgba(30, 30, 46, 0.8)`
- Border: `1px solid rgba(137, 180, 250, 0.3)`
- Border radius: `8px`
- Text: `#89b4fa` (blue), monospace, `font-size: 18px`, `font-weight: 600`
- Padding: `8px 20px`
- Fade transition: `opacity 0.3s ease`
- z-index: `25` (above terminals, below overlays)

### Defaults
- Display duration: `800ms` after last resize event
- Format: `{cols} × {rows}`

### Files Changed
- `index.html` — add `#resize-overlay` element
- `styles.css` — style the overlay
- `renderer.js` — show/hide logic in resize handler and `setLayout()`

---

## 6. Focused Pane Glow

### What
The focused terminal gets a multi-layered blue glow — the signature cyberpunk effect. Combined with split dimming, the focused pane appears to float forward out of darkness.

### Implementation
- Replace the existing `:focus-within` border styling with a stronger glow:

```css
.terminal-cell:focus-within {
  border-color: rgba(137, 180, 250, 0.5);
  box-shadow:
    0 0 1px rgba(137, 180, 250, 0.4),
    0 0 8px rgba(137, 180, 250, 0.15),
    inset 0 0 20px rgba(137, 180, 250, 0.05);
}
```

- Transition: `box-shadow 0.3s ease, border-color 0.3s ease`
- Locked terminals get red glow instead:

```css
.terminal-cell.locked:focus-within {
  border-color: rgba(243, 139, 168, 0.5);
  box-shadow:
    0 0 1px rgba(243, 139, 168, 0.4),
    0 0 8px rgba(243, 139, 168, 0.15),
    inset 0 0 20px rgba(243, 139, 168, 0.05);
}
```

- When zoomed, the glow intensifies (wider spread, higher alpha):

```css
.terminal-cell.zoomed:focus-within {
  box-shadow:
    0 0 2px rgba(137, 180, 250, 0.5),
    0 0 15px rgba(137, 180, 250, 0.2),
    inset 0 0 30px rgba(137, 180, 250, 0.08);
}
```

### Defaults
- Glow color: `#89b4fa` (Catppuccin blue)
- Locked glow: `#f38ba8` (Catppuccin red)
- Transition: `0.3s`

### Files Changed
- `styles.css` — update `:focus-within` rules, add `.locked:focus-within` and `.zoomed:focus-within`

---

## File Change Summary

| File | Changes |
|---|---|
| `main.js` | `transparent: true`, `backgroundColor: '#00000000'` |
| `renderer.js` | Focus-follows-mouse, pane zoom logic, resize overlay logic, update theme background to rgba |
| `styles.css` | Split dimming (::after), glow effects, transparency backgrounds, resize overlay styles, zoom styles |
| `index.html` | Add `#resize-overlay` element |
| `README.md` | Document new shortcuts and features |

## New Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+Z` | Toggle pane zoom |

## Future (Wave 2+)

All hardcoded defaults in this wave become configurable in Wave 2 when the config system is built:
- `dim-opacity: 0.35`
- `focus-follows-mouse: true`
- `background-opacity: 0.85`
- `resize-overlay-duration: 800`
- `glow-color: #89b4fa`
- `glow-intensity: normal | intense | off`
