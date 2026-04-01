// renderer.js — wires 6 xterm.js terminals to node-pty via IPC
//
// xterm 5.x UMD bundle spreads all its exports onto window directly,
// so Terminal is available as window.Terminal.
// xterm-addon-fit UMD bundle assigns e.FitAddon = t() on self (window),
// so FitAddon is available as window.FitAddon.

(function () {
  'use strict';

  const Terminal = window.Terminal;
  const FitAddon = window.FitAddon.FitAddon;
  const WebglAddon = window.WebglAddon.WebglAddon;
  const SearchAddon = window.SearchAddon.SearchAddon;

  var broadcastMode = false;
  var searchVisible = false;
  var snippetVisible = false;

  const TERMINAL_COUNT = 6;

  const TERMINAL_OPTIONS = {
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
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: 'rgba(137, 180, 250, 0.25)',
      selectionForeground: '#cdd6f4',
      selectionInactiveBackground: 'rgba(137, 180, 250, 0.12)',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#cba6f7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#cba6f7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
  };

  // ── Matrix Rain Engine (reusable for boot + screensaver) ────

  var FADE_DURATION = 800;
  var AFK_TIMEOUT = 3 * 60 * 1000; // 3 minutes

  var rain = {
    canvas: null,
    ctx: null,
    animId: null,
    drops: [],
    running: false,
    chars: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ'.split(''),
    fontSize: 14,
    frameCount: 0,

    // Subliminal messages — trail down vertically like rain columns
    subliminals: [
      'wake up',
      'there is no spoon',
      'follow the white rabbit',
      'you are the one',
      'the matrix has you',
      'knock knock',
      'free your mind',
      'I know kung fu',
      'remember all I offer is the truth',
      'what is real?',
      'do not try to bend the spoon',
      'choice is an illusion',
      'not like this',
      'deja vu',
      'whoa',
      'the one',
      'everything has an end',
    ],
    subliminalIdx: 0,
    // Active trailing message: { x, startRow, charIdx, text }
    activeMsg: null,

    start: function () {
      if (this.running) return;
      this.running = true;
      this.frameCount = 0;
      this.activeMsg = null;
      this.canvas = document.getElementById('matrix-rain');
      if (!this.canvas) return;
      this.canvas.style.display = 'block';
      this.canvas.classList.remove('fade-out');
      this.canvas.style.opacity = '1';
      this.ctx = this.canvas.getContext('2d');
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;

      var columns = Math.floor(this.canvas.width / this.fontSize);
      this.drops = [];
      for (var i = 0; i < columns; i++) {
        this.drops[i] = Math.random() * -50;
      }
      this._draw();
    },

    _draw: function () {
      if (!this.running) return;
      var ctx = this.ctx;
      var w = this.canvas.width;
      var h = this.canvas.height;
      var fs = this.fontSize;
      this.frameCount++;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, w, h);

      for (var i = 0; i < this.drops.length; i++) {
        var char = this.chars[Math.floor(Math.random() * this.chars.length)];
        if (Math.random() > 0.3) {
          ctx.fillStyle = '#0f0';
          ctx.font = fs + 'px monospace';
        } else {
          ctx.fillStyle = '#aff';
          ctx.font = 'bold ' + fs + 'px monospace';
        }
        ctx.fillText(char, i * fs, this.drops[i] * fs);
        if (this.drops[i] * fs > h && Math.random() > 0.975) {
          this.drops[i] = 0;
        }
        this.drops[i]++;
      }

      // Subliminal message — spawn every ~4 seconds
      if (this.frameCount % 240 === 0 && !this.activeMsg) {
        var text = this.subliminals[this.subliminalIdx];
        this.subliminalIdx = (this.subliminalIdx + 1) % this.subliminals.length;
        // Center-ish, with some randomness
        var x = w * 0.15 + Math.random() * w * 0.5;
        var startY = h * 0.15 + Math.random() * h * 0.4;
        this.activeMsg = { x: x, y: startY, charIdx: 0, text: text, age: 0 };
      }

      // Render trailing message vertically — one char every 2 frames
      if (this.activeMsg) {
        var m = this.activeMsg;
        m.age++;
        if (m.age % 2 === 0 && m.charIdx < m.text.length) {
          m.charIdx++;
        }
        ctx.save();
        var msgFs = 20;
        // Draw all revealed characters going straight down
        for (var c = 0; c < m.charIdx; c++) {
          var isLead = (c === m.charIdx - 1);
          if (isLead) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold ' + msgFs + 'px monospace';
          } else {
            ctx.fillStyle = '#0f0';
            ctx.font = msgFs + 'px monospace';
          }
          ctx.fillText(m.text[c], m.x, m.y + c * (msgFs + 2));
        }
        ctx.restore();
        // After fully revealed, let it linger then clear
        if (m.charIdx >= m.text.length) {
          m.age++;
          if (m.age > m.text.length * 2 + 80) this.activeMsg = null;
        }
      }

      var self = this;
      this.animId = requestAnimationFrame(function () { self._draw(); });
    },

    stop: function () {
      if (!this.running) return;
      this.running = false;
      if (this.animId) cancelAnimationFrame(this.animId);
      this.animId = null;
      if (this.canvas) {
        this.canvas.classList.add('fade-out');
      }
    },

    hide: function () {
      if (this.canvas) {
        this.canvas.style.display = 'none';
      }
    }
  };

  // Boot sequence: rain for 2.5s then fade
  function runBootRain() {
    rain.start();
    return new Promise(function (resolve) {
      setTimeout(function () {
        rain.stop();
        setTimeout(function () {
          rain.hide();
          resolve();
        }, FADE_DURATION);
      }, 2500);
    });
  }

  // ── AFK Screensaver ─────────────────────────────────────────

  var afkTimer = null;
  var screensaverActive = false;

  function resetAfkTimer() {
    if (manualRain) return; // Don't interrupt manual toggle
    if (screensaverActive) {
      screensaverActive = false;
      rain.stop();
      setTimeout(function () { rain.hide(); }, FADE_DURATION);
      for (var i = 0; i < entries.length; i++) {
        if (document.activeElement === entries[i].terminal.textarea) {
          entries[i].terminal.focus();
          break;
        }
      }
    }
    clearTimeout(afkTimer);
    afkTimer = setTimeout(startScreensaver, AFK_TIMEOUT);
  }

  function startScreensaver() {
    if (screensaverActive) return;
    screensaverActive = true;
    rain.canvas = document.getElementById('matrix-rain');
    rain.start();
  }

  var manualRain = false;

  function toggleScreensaver() {
    if (screensaverActive) {
      manualRain = false;
      resetAfkTimer();
    } else {
      manualRain = true;
      startScreensaver();
    }
  }

  function initAfkWatcher() {
    ['keydown', 'mousemove', 'mousedown', 'touchstart'].forEach(function (evt) {
      document.addEventListener(evt, resetAfkTimer, { passive: true });
    });
    resetAfkTimer();
  }

  // ── Terminal Setup ───────────────────────────────────────────

  /** @type {{ terminal: *, fitAddon: *, locked: boolean, lastOutputTime: number }[]} */
  var entries = [];

  function initTerminals() {
    for (let id = 0; id < TERMINAL_COUNT; id++) {
      const container = document.getElementById(`terminal-${id}`);
      if (!container) {
        console.error(`[renderer] container #terminal-${id} not found`);
        continue;
      }

      const terminal = new Terminal(TERMINAL_OPTIONS);
      const fitAddon = new FitAddon();
      const searchAddon = new SearchAddon();

      terminal.loadAddon(fitAddon);
      terminal.loadAddon(searchAddon);
      terminal.open(container);

      // WebGL renderer — 5-10x faster than Canvas 2D
      try {
        var webglAddon = new WebglAddon();
        webglAddon.onContextLoss(function () {
          webglAddon.dispose();
        });
        terminal.loadAddon(webglAddon);
      } catch (e) {
        // WebGL not available, falls back to canvas automatically
      }

      fitAddon.fit();

      // User input → pty (blocked when locked, broadcast when enabled)
      terminal.onData(function (data) {
        if (broadcastMode) {
          entries.forEach(function (entry, idx) {
            if (!entry.locked) window.terminalAPI.send(idx, data);
          });
        } else if (!entries[id] || !entries[id].locked) {
          window.terminalAPI.send(id, data);
        }
      });

      // Multiline paste warning
      terminal.textarea.addEventListener('paste', function (e) {
        var text = (e.clipboardData || window.clipboardData).getData('text');
        var lines = text.split('\n').length;
        if (lines > 1) {
          e.preventDefault();
          e.stopPropagation();
          if (confirm('Paste ' + lines + ' lines into terminal ' + (id + 1) + '?')) {
            window.terminalAPI.send(id, text);
          }
        }
      }, true);

      // pty output → terminal display + track activity for notifications
      var outputTimer = null;
      window.terminalAPI.onData(id, function (data) {
        terminal.write(data);
        entries[id].lastOutputTime = Date.now();

        // Process completion detection: if output stops for 3s after activity,
        // and the window is blurred, fire a notification
        clearTimeout(outputTimer);
        outputTimer = setTimeout(function () {
          if (!document.hasFocus()) {
            window.terminalAPI.notify(id);
          }
        }, 3000);
      });

      // Send initial dimensions to pty
      window.terminalAPI.resize(id, terminal.cols, terminal.rows);

      // Double-click label to rename
      var labelName = container.querySelector('.label-name');
      if (labelName) {
        labelName.style.pointerEvents = 'auto';
        labelName.style.cursor = 'pointer';
        labelName.addEventListener('dblclick', function () {
          var name = prompt('Rename terminal ' + (id + 1) + ':', labelName.textContent);
          if (name !== null && name.trim()) labelName.textContent = name.trim();
        });
      }

      entries.push({ terminal, fitAddon, searchAddon, locked: false, lastOutputTime: 0 });
    }
  }

  function refitAll() {
    entries.forEach(function ({ terminal, fitAddon }, id) {
      fitAddon.fit();
      window.terminalAPI.resize(id, terminal.cols, terminal.rows);
    });
  }

  // ── Focus Management & Keyboard Shortcuts ────────────────────

  function focusTerminal(id) {
    if (id >= 0 && id < entries.length) {
      entries[id].terminal.focus();
    }
  }

  function renameTerminal(id, name) {
    var label = document.querySelector('#terminal-' + id + ' .label-name');
    if (label) { label.textContent = name; }
  }

  function getFocusedTerminalId() {
    for (var i = 0; i < entries.length; i++) {
      if (document.activeElement === entries[i].terminal.textarea) {
        return i;
      }
    }
    return -1;
  }

  function toggleLock(id) {
    if (id < 0 || id >= entries.length) return;
    entries[id].locked = !entries[id].locked;
    var lockIcon = document.querySelector('#terminal-' + id + ' .label-lock');
    if (lockIcon) {
      lockIcon.style.display = entries[id].locked ? 'flex' : 'none';
    }
    var cell = document.getElementById('terminal-' + id);
    if (cell) {
      cell.classList.toggle('locked', entries[id].locked);
    }
  }

  // ── Broadcast Mode ───────────────────────────────────────────

  function toggleBroadcast() {
    broadcastMode = !broadcastMode;
    var bar = document.getElementById('broadcast-bar');
    bar.classList.toggle('active', broadcastMode);
    document.getElementById('grid').style.height = broadcastMode
      ? 'calc(100vh - 56px)' : 'calc(100vh - 32px)';
    refitAll();
  }

  // ── Search ──────────────────────────────────────────────────

  function openSearch() {
    searchVisible = true;
    document.getElementById('search-bar').classList.add('active');
    document.getElementById('search-input').focus();
  }

  function closeSearch() {
    searchVisible = false;
    document.getElementById('search-bar').classList.remove('active');
    document.getElementById('search-input').value = '';
    var id = getFocusedTerminalId();
    if (id >= 0) {
      entries[id].searchAddon.clearDecorations();
      entries[id].terminal.focus();
    }
  }

  document.getElementById('search-input').addEventListener('input', function (e) {
    var id = getFocusedTerminalId();
    if (id < 0) id = 0;
    entries[id].searchAddon.findNext(e.target.value);
  });

  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'Enter') {
      var id = getFocusedTerminalId();
      if (id < 0) id = 0;
      if (e.shiftKey) entries[id].searchAddon.findPrevious(e.target.value);
      else entries[id].searchAddon.findNext(e.target.value);
    }
  });

  document.getElementById('search-close').addEventListener('click', closeSearch);

  // ── Snippet Palette ─────────────────────────────────────────

  var defaultSnippets = [
    { name: 'List files', cmd: 'ls -la' },
    { name: 'Git status', cmd: 'git status' },
    { name: 'Git log (oneline)', cmd: 'git log --oneline -20' },
    { name: 'Disk usage', cmd: 'df -h' },
    { name: 'Process list', cmd: 'ps aux | head -20' },
    { name: 'Docker containers', cmd: 'docker ps' },
    { name: 'Network ports', cmd: 'ss -tlnp' },
    { name: 'System info', cmd: 'uname -a' },
  ];

  var snippetSelectedIdx = 0;

  function openSnippetPalette() {
    snippetVisible = true;
    document.getElementById('snippet-palette').classList.add('active');
    document.getElementById('snippet-overlay').classList.add('active');
    document.getElementById('snippet-input').value = '';
    document.getElementById('snippet-input').focus();
    renderSnippets('');
  }

  function closeSnippetPalette() {
    snippetVisible = false;
    document.getElementById('snippet-palette').classList.remove('active');
    document.getElementById('snippet-overlay').classList.remove('active');
    var id = getFocusedTerminalId();
    if (id >= 0) entries[id].terminal.focus();
  }

  function renderSnippets(filter) {
    var list = document.getElementById('snippet-list');
    var filtered = defaultSnippets.filter(function (s) {
      return s.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
             s.cmd.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    });
    snippetSelectedIdx = 0;
    // Clear and rebuild with safe DOM methods
    while (list.firstChild) list.removeChild(list.firstChild);
    filtered.forEach(function (s, i) {
      var item = document.createElement('div');
      item.className = 'snippet-item' + (i === 0 ? ' selected' : '');
      item.setAttribute('data-cmd', s.cmd);
      var nameSpan = document.createElement('span');
      nameSpan.textContent = s.name;
      var cmdSpan = document.createElement('span');
      cmdSpan.className = 'snippet-key';
      cmdSpan.textContent = s.cmd;
      item.appendChild(nameSpan);
      item.appendChild(cmdSpan);
      list.appendChild(item);
    });
  }

  function executeSnippet(cmd) {
    var id = getFocusedTerminalId();
    if (id < 0) id = 0;
    if (!entries[id].locked) {
      window.terminalAPI.send(id, cmd + '\n');
    }
    closeSnippetPalette();
  }

  document.getElementById('snippet-input').addEventListener('input', function (e) {
    renderSnippets(e.target.value);
  });

  document.getElementById('snippet-input').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSnippetPalette(); return; }
    var items = document.querySelectorAll('.snippet-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      snippetSelectedIdx = Math.min(snippetSelectedIdx + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      snippetSelectedIdx = Math.max(snippetSelectedIdx - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var input = document.getElementById('snippet-input').value.trim();
      if (items[snippetSelectedIdx]) {
        executeSnippet(items[snippetSelectedIdx].getAttribute('data-cmd'));
      } else if (input) {
        executeSnippet(input);
      }
      return;
    } else {
      return;
    }
    items.forEach(function (el, i) {
      el.classList.toggle('selected', i === snippetSelectedIdx);
    });
  });

  document.getElementById('snippet-list').addEventListener('click', function (e) {
    var item = e.target.closest('.snippet-item');
    if (item) executeSnippet(item.getAttribute('data-cmd'));
  });

  document.getElementById('snippet-overlay').addEventListener('click', closeSnippetPalette);

  // ── Copy/Paste ──────────────────────────────────────────────

  function copySelection() {
    var id = getFocusedTerminalId();
    if (id >= 0) {
      var sel = entries[id].terminal.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
    }
  }

  function pasteClipboard() {
    var id = getFocusedTerminalId();
    if (id < 0) return;
    navigator.clipboard.readText().then(function (text) {
      if (!entries[id].locked) {
        window.terminalAPI.send(id, text);
      }
    });
  }

  // ── All Keyboard Shortcuts ──────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (snippetVisible) { closeSnippetPalette(); return; }
      if (searchVisible) { closeSearch(); return; }
    }

    if (!e.ctrlKey) return;

    // Ctrl+1 through Ctrl+6
    if (e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      focusTerminal(parseInt(e.key, 10) - 1);
      return;
    }

    // Ctrl+` to cycle
    if (e.key === '`') {
      e.preventDefault();
      focusTerminal((getFocusedTerminalId() + 1) % entries.length);
      return;
    }

    if (e.shiftKey) {
      if (e.key === 'L') { e.preventDefault(); toggleLock(getFocusedTerminalId()); return; }
      if (e.key === 'B') { e.preventDefault(); toggleBroadcast(); return; }
      if (e.key === 'F') { e.preventDefault(); openSearch(); return; }
      if (e.key === 'P') { e.preventDefault(); openSnippetPalette(); return; }
      if (e.key === 'C') { e.preventDefault(); copySelection(); return; }
      if (e.key === 'V') { e.preventDefault(); pasteClipboard(); return; }
      if (e.key === 'M') { e.preventDefault(); toggleScreensaver(); return; }
    }
  });

  // ── Window Controls ──────────────────────────────────────────

  function initWindowControls() {
    document.getElementById('btn-minimize').addEventListener('click', function () {
      window.windowAPI.minimize();
    });
    document.getElementById('btn-maximize').addEventListener('click', function () {
      window.windowAPI.maximize();
    });
    document.getElementById('btn-close').addEventListener('click', function () {
      window.windowAPI.close();
    });
  }

  // ── Debounced Resize ──────────────────────────────────────────

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refitAll, 50);
  });

  function boot() {
    initWindowControls();
    runBootRain().then(function () {
      initTerminals();
      focusTerminal(0);
      initAfkWatcher();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
