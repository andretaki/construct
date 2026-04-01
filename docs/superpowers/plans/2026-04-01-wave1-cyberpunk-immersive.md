# Wave 1: Cyberpunk Immersive — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add split dimming, focused pane glow, window transparency, focus-follows-mouse, pane zoom, and a resize overlay to make Construct feel cyberpunk-immersive.

**Architecture:** All six features are independent — each can be implemented and committed separately. No new files are created. Changes touch `styles.css` (CSS-only features), `renderer.js` (JS behavior), `main.js` (Electron window config), and `index.html` (one new DOM element). No test framework exists — verification is manual via `npm start`.

**Tech Stack:** Electron, xterm.js, CSS, vanilla JS

---

### Task 1: Split Dimming + Focused Pane Glow

Pure CSS changes. The dimming overlay and the glow effect create the core cyberpunk contrast — inactive panes recede into darkness, the focused pane glows and floats forward.

**Files:**
- Modify: `styles.css:198-211` (`.terminal-cell` and `:focus-within` rules)

- [ ] **Step 1: Add the dimming `::after` overlay to `.terminal-cell`**

In `styles.css`, after the existing `.terminal-cell` rule (line 198), add the `::after` pseudo-element. Also add `transition` for `box-shadow` to the base `.terminal-cell` rule:

```css
.terminal-cell {
  position: relative;
  background: #1e1e2e;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(127, 132, 156, 0.08);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.terminal-cell::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 2;
  pointer-events: none;
  transition: opacity 0.2s ease;
}
```

- [ ] **Step 2: Replace the existing `:focus-within` rule with the glow + dim removal**

Replace the existing `.terminal-cell:focus-within` rule (line 207) with:

```css
.terminal-cell:focus-within {
  border-color: rgba(137, 180, 250, 0.5);
  box-shadow:
    0 0 1px rgba(137, 180, 250, 0.4),
    0 0 8px rgba(137, 180, 250, 0.15),
    inset 0 0 20px rgba(137, 180, 250, 0.05);
}

.terminal-cell:focus-within::after {
  opacity: 0;
}
```

- [ ] **Step 3: Add locked terminal red glow**

After the existing `.terminal-cell.locked .label-num` rule (around line 264), add:

```css
.terminal-cell.locked:focus-within {
  border-color: rgba(243, 139, 168, 0.5);
  box-shadow:
    0 0 1px rgba(243, 139, 168, 0.4),
    0 0 8px rgba(243, 139, 168, 0.15),
    inset 0 0 20px rgba(243, 139, 168, 0.05);
}
```

- [ ] **Step 4: Add zoomed terminal intensified glow (prep for Task 4)**

```css
.terminal-cell.zoomed:focus-within {
  box-shadow:
    0 0 2px rgba(137, 180, 250, 0.5),
    0 0 15px rgba(137, 180, 250, 0.2),
    inset 0 0 30px rgba(137, 180, 250, 0.08);
}
```

- [ ] **Step 5: Verify visually**

Run: `npm start`
Expected: Unfocused terminals are visibly darker. Clicking/focusing a terminal makes it bright with a blue glow border. Locked terminals glow red when focused. The glow transitions smoothly as you move between panes.

- [ ] **Step 6: Commit**

```bash
git add styles.css
git commit -m "feat: split dimming + focused pane glow effects"
```

---

### Task 2: Window Transparency

Make the Electron window transparent so the desktop shows through. Terminal text stays fully opaque.

**Files:**
- Modify: `main.js:17-30` (BrowserWindow options)
- Modify: `styles.css:9-10` (body background)
- Modify: `styles.css:92-99` (#grid background)
- Modify: `styles.css:198` (.terminal-cell background)
- Modify: `renderer.js:37-53` (TERMINAL_OPTIONS theme background + add allowTransparency)

- [ ] **Step 1: Enable transparent window in Electron**

In `main.js`, update the `BrowserWindow` options in `createWindow()` (line 18):

```js
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
```

- [ ] **Step 2: Make body background transparent**

In `styles.css`, change the `html, body` rule (line 9):

```css
html, body {
  height: 100%;
  overflow: hidden;
  background: transparent;
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SF Mono', monospace;
}
```

- [ ] **Step 3: Make grid background semi-transparent**

In `styles.css`, change the `#grid` background (line 99):

```css
#grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(2, 1fr);
  height: calc(100vh - 32px);
  gap: 2px;
  padding: 0 2px 2px 2px;
  background: rgba(17, 17, 27, 0.85);
}
```

- [ ] **Step 4: Make terminal cell background semi-transparent**

In `styles.css`, change `.terminal-cell` background (line 200):

```css
.terminal-cell {
  position: relative;
  background: rgba(30, 30, 46, 0.85);
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(127, 132, 156, 0.08);
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}
```

- [ ] **Step 5: Update xterm theme background to rgba and enable allowTransparency**

In `renderer.js`, update `TERMINAL_OPTIONS` (line 37). Add `allowTransparency: true` and change `theme.background`:

```js
  var TERMINAL_OPTIONS = {
    allowTransparency: true,
    cursorBlink: true,
    cursorStyle: 'bar',
    cursorWidth: 2,
    cursorInactiveStyle: 'outline',
    fontSize: 13,
    fontFamily: "'JetBrains Mono', 'Cascadia Code', 'Fira Code', 'SF Mono', 'Menlo', 'Consolas', monospace",
    fontWeight: '400',
    fontWeightBold: '600',
    lineHeight: 1.2,
    letterSpacing: 0,
    scrollback: 5000,
    smoothScrollDuration: 100,
    drawBoldTextInBrightColors: true,
    minimumContrastRatio: 1,
    theme: {
      background: 'rgba(30, 30, 46, 0.85)',
      foreground: '#cdd6f4',
```

Only the `background` line changes in theme. All other theme colors stay the same.

- [ ] **Step 6: Verify visually**

Run: `npm start`
Expected: The desktop/wallpaper is faintly visible through the terminal backgrounds. Terminal text is fully readable. The titlebar stays opaque. Matrix rain stays opaque. On WSL2 without a compositor, the background will be black (no regression).

- [ ] **Step 7: Commit**

```bash
git add main.js styles.css renderer.js
git commit -m "feat: window transparency — see through to desktop"
```

---

### Task 3: Focus-Follows-Mouse

Hovering over a terminal pane focuses it automatically with a 50ms debounce.

**Files:**
- Modify: `renderer.js:334-409` (inside `setupTerminal()` function)

- [ ] **Step 1: Add a focus-follows-mouse debounce timer variable**

In `renderer.js`, after the `var entries = [];` line (line 287), add:

```js
  var focusFollowsTimer = null;
```

- [ ] **Step 2: Add mouseenter/mouseleave handlers in `setupTerminal()`**

In `renderer.js`, at the end of `setupTerminal()` just before the `entries[id] = { ... }` line (line 409), add:

```js
    // Focus-follows-mouse — hover to focus with debounce
    container.addEventListener('mouseenter', function () {
      clearTimeout(focusFollowsTimer);
      focusFollowsTimer = setTimeout(function () {
        if (layoutPickerVisible || snippetVisible || searchVisible || screensaverActive) return;
        if (entries[id] && entries[id].terminal) {
          entries[id].terminal.focus();
        }
      }, 50);
    });

    container.addEventListener('mouseleave', function () {
      clearTimeout(focusFollowsTimer);
    });
```

- [ ] **Step 3: Verify visually**

Run: `npm start`
Expected: Moving the mouse into a terminal pane focuses it after a brief pause (~50ms). Moving quickly across panes does not cause flickering. Opening the snippet palette (`Ctrl+Shift+P`) and hovering over terminals behind it does NOT steal focus. Same for layout picker, search bar, and screensaver.

- [ ] **Step 4: Commit**

```bash
git add renderer.js
git commit -m "feat: focus-follows-mouse with 50ms debounce"
```

---

### Task 4: Pane Zoom

Toggle the focused terminal to fill the entire grid with `Ctrl+Shift+Z`.

**Files:**
- Modify: `renderer.js` — add zoom state + `toggleZoom()` + update keyboard handler + update `setLayout()`

- [ ] **Step 1: Add zoom state variable**

In `renderer.js`, after `var layoutPickerSelectedIdx = 0;` (line 35), add:

```js
  var zoomedTerminalId = -1;
```

- [ ] **Step 2: Add the `toggleZoom()` function**

In `renderer.js`, after the `refitAll()` function (after line 453), add:

```js
  function toggleZoom() {
    var grid = document.getElementById('grid');

    if (zoomedTerminalId >= 0) {
      // Unzoom — restore all cells
      for (var i = 0; i < entries.length; i++) {
        var cell = document.getElementById('terminal-' + i);
        if (!cell) continue;
        cell.style.display = '';
        cell.style.gridColumn = '';
        cell.style.gridRow = '';
        cell.classList.remove('zoomed');
      }
      // Remove [Z] indicator
      var zLabel = document.querySelector('#terminal-' + zoomedTerminalId + ' .label-zoom');
      if (zLabel) zLabel.remove();
      zoomedTerminalId = -1;
      setTimeout(refitAll, 50);
      return;
    }

    var id = getFocusedTerminalId();
    if (id < 0) return;

    zoomedTerminalId = id;

    // Hide all other cells, expand the zoomed one
    for (var i = 0; i < entries.length; i++) {
      var cell = document.getElementById('terminal-' + i);
      if (!cell) continue;
      if (i === id) {
        cell.style.gridColumn = '1 / -1';
        cell.style.gridRow = '1 / -1';
        cell.classList.add('zoomed');
      } else {
        cell.style.display = 'none';
      }
    }

    // Add [Z] indicator to label
    var label = document.querySelector('#terminal-' + id + ' .terminal-label');
    if (label && !label.querySelector('.label-zoom')) {
      var zBadge = document.createElement('span');
      zBadge.className = 'label-zoom';
      zBadge.textContent = '[Z]';
      label.appendChild(zBadge);
    }

    setTimeout(refitAll, 50);
  }

  function unzoomIfNeeded() {
    if (zoomedTerminalId >= 0) {
      toggleZoom(); // unzooms
    }
  }
```

- [ ] **Step 3: Add `Ctrl+Shift+Z` to the keyboard handler**

In `renderer.js`, in the `if (e.shiftKey)` block inside the keydown handler (around line 783), add after the `'G'` line:

```js
      if (e.key === 'Z') { e.preventDefault(); toggleZoom(); return; }
```

- [ ] **Step 4: Unzoom when using `Ctrl+1-9` to switch terminals**

In `renderer.js`, update the `Ctrl+1-9` handler (around line 761) to unzoom first:

```js
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= currentTerminalCount) {
      e.preventDefault();
      unzoomIfNeeded();
      focusTerminal(num - 1);
      return;
    }
```

- [ ] **Step 5: Unzoom before layout changes**

In `renderer.js`, at the start of `setLayout()` (line 412), add `unzoomIfNeeded()` after the layout lookup:

```js
  function setLayout(count) {
    var layout = getLayout(count);
    if (!layout) return;
    unzoomIfNeeded();
    var grid = document.getElementById('grid');
```

- [ ] **Step 6: Add CSS for zoom indicator label**

In `styles.css`, after the `.label-lock` rule (around line 255), add:

```css
.label-zoom {
  font-size: 9px;
  color: #89b4fa;
  font-weight: 600;
}
```

- [ ] **Step 7: Verify visually**

Run: `npm start`
Expected:
- `Ctrl+Shift+Z` zooms the focused terminal to fill the grid. Other terminals disappear.
- The zoomed terminal shows `[Z]` in its label and has an intensified blue glow (from Task 1's `.zoomed:focus-within` CSS).
- `Ctrl+Shift+Z` again restores the grid.
- `Ctrl+3` while zoomed unzooms and focuses terminal 3.
- `Ctrl+Shift+G` while zoomed opens the layout picker (unzooms first).

- [ ] **Step 8: Commit**

```bash
git add renderer.js styles.css
git commit -m "feat: pane zoom — Ctrl+Shift+Z to toggle fullscreen"
```

---

### Task 5: Resize Overlay

Show a HUD-style `cols x rows` overlay centered on screen during window resize.

**Files:**
- Modify: `index.html` — add `#resize-overlay` element
- Modify: `styles.css` — style the overlay
- Modify: `renderer.js` — show/hide logic

- [ ] **Step 1: Add the resize overlay DOM element**

In `index.html`, after the `<div id="layout-overlay"></div>` line (line 32), add:

```html
  <div id="resize-overlay"></div>
```

- [ ] **Step 2: Add CSS for the resize overlay**

In `styles.css`, after the `#matrix-rain[style*="display: none"]` rule (around line 88), add:

```css
/* ── Resize Overlay ───────────────────────────── */

#resize-overlay {
  display: none;
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  background: rgba(30, 30, 46, 0.8);
  border: 1px solid rgba(137, 180, 250, 0.3);
  border-radius: 8px;
  padding: 8px 20px;
  font-family: inherit;
  font-size: 18px;
  font-weight: 600;
  color: #89b4fa;
  pointer-events: none;
  transition: opacity 0.3s ease;
  opacity: 0;
}

#resize-overlay.visible {
  display: block;
  opacity: 1;
}

#resize-overlay.fade-out {
  opacity: 0;
}
```

- [ ] **Step 3: Add resize overlay show/hide logic**

In `renderer.js`, replace the entire resize handler section (lines 802-807) with:

```js
  // ── Debounced Resize + Overlay ──────────────────────────────────

  var resizeTimer = null;
  var resizeOverlayTimer = null;

  function showResizeOverlay() {
    var id = getFocusedTerminalId();
    if (id < 0) id = 0;
    if (!entries[id]) return;
    var overlay = document.getElementById('resize-overlay');
    overlay.textContent = entries[id].terminal.cols + ' \u00D7 ' + entries[id].terminal.rows;
    overlay.classList.remove('fade-out');
    overlay.classList.add('visible');

    clearTimeout(resizeOverlayTimer);
    resizeOverlayTimer = setTimeout(function () {
      overlay.classList.add('fade-out');
      setTimeout(function () {
        overlay.classList.remove('visible', 'fade-out');
      }, 300);
    }, 800);
  }

  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      refitAll();
      showResizeOverlay();
    }, 50);
  });
```

- [ ] **Step 4: Also show overlay after layout changes**

In `renderer.js`, at the end of `setLayout()`, after the `setTimeout(refitAll, 50)` line, add a delayed overlay show:

```js
    setTimeout(function () {
      refitAll();
      showResizeOverlay();
    }, 50);
```

And remove the existing `setTimeout(refitAll, 50);` line since it's now inside the new setTimeout.

So the end of `setLayout()` becomes:

```js
    entries.length = count;
    currentTerminalCount = count;
    localStorage.setItem('construct-layout', String(count));

    setTimeout(function () {
      refitAll();
      showResizeOverlay();
    }, 50);
  }
```

- [ ] **Step 5: Verify visually**

Run: `npm start`
Expected: Dragging the window edge to resize shows a centered blue HUD with `80 x 24` (or whatever the current size is). It fades out 800ms after you stop resizing. Changing layouts via `Ctrl+Shift+G` also flashes the overlay briefly.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css renderer.js
git commit -m "feat: resize overlay — HUD showing cols x rows"
```

---

### Task 6: Update README

Document all new features and the new shortcut.

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add new features to the feature table**

In `README.md`, add these rows to the Features table after the **Configurable grid** row:

```markdown
| **Split dimming** | Inactive terminals fade to 35% so the focused pane pops |
| **Focused pane glow** | Multi-layered blue glow on the active terminal — red glow when locked |
| **Window transparency** | Semi-transparent backgrounds let your desktop show through |
| **Focus-follows-mouse** | Hover a terminal to focus it — no click needed |
| **Pane zoom** | `Ctrl+Shift+Z` — toggle any terminal to fill the entire grid |
| **Resize overlay** | Shows terminal dimensions (`cols x rows`) during window resize |
```

- [ ] **Step 2: Add `Ctrl+Shift+Z` to the keyboard shortcuts table**

In the Keyboard shortcuts table, add after the `Ctrl+Shift+G` row:

```markdown
| `Ctrl+Shift+Z` | Toggle pane zoom (fullscreen focused terminal) |
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add Wave 1 cyberpunk features to README"
```
