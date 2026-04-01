// renderer.js — dynamic terminal grid with configurable layout
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
  var layoutPickerVisible = false;

  // ── Layout Presets ──────────────────────────────────────────

  var LAYOUTS = [
    { count: 1,  cols: 1, rows: 1, label: '1 \u2014 single' },
    { count: 2,  cols: 2, rows: 1, label: '2 \u2014 side by side' },
    { count: 3,  cols: 3, rows: 1, label: '3 \u2014 triple' },
    { count: 4,  cols: 2, rows: 2, label: '4 \u2014 2\u00D72 grid' },
    { count: 6,  cols: 3, rows: 2, label: '6 \u2014 3\u00D72 grid' },
    { count: 8,  cols: 4, rows: 2, label: '8 \u2014 4\u00D72 grid' },
    { count: 9,  cols: 3, rows: 3, label: '9 \u2014 3\u00D73 grid' },
    { count: 12, cols: 4, rows: 3, label: '12 \u2014 4\u00D73 grid' },
  ];

  var currentTerminalCount = 0;
  var layoutPickerSelectedIdx = 0;
  var zoomedTerminalId = -1;

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
    chars: '\u30A2\u30A4\u30A6\u30A8\u30AA\u30AB\u30AD\u30AF\u30B1\u30B3\u30B5\u30B7\u30B9\u30BB\u30BD\u30BF\u30C1\u30C4\u30C6\u30C8\u30CA\u30CB\u30CC\u30CD\u30CE\u30CF\u30D2\u30D5\u30D8\u30DB\u30DE\u30DF\u30E0\u30E1\u30E2\u30E4\u30E6\u30E8\u30E9\u30EA\u30EB\u30EC\u30ED\u30EF\u30F2\u30F30123456789ABCDEFZ'.split(''),
    fontSize: 14,
    frameCount: 0,

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

      // Subliminal message — spawn every ~8 seconds
      if (this.frameCount % 480 === 0 && !this.activeMsg) {
        var text = this.subliminals[this.subliminalIdx];
        this.subliminalIdx = (this.subliminalIdx + 1) % this.subliminals.length;
        var x = w * 0.1 + Math.random() * w * 0.6;
        var startY = h * 0.1 + Math.random() * h * 0.5;
        this.activeMsg = { x: x, y: startY, charIdx: 0, text: text, age: 0 };
      }

      // Render — same size as rain, blends in, subtle green glow
      if (this.activeMsg) {
        var m = this.activeMsg;
        m.age++;
        if (m.age % 3 === 0 && m.charIdx < m.text.length) {
          m.charIdx++;
        }
        ctx.save();
        for (var c = 0; c < m.charIdx; c++) {
          var isLead = (c === m.charIdx - 1);
          if (isLead) {
            ctx.fillStyle = 'rgba(170, 255, 170, 0.6)';
            ctx.font = 'bold ' + fs + 'px monospace';
          } else {
            var fade = Math.max(0.15, 0.45 - (m.charIdx - c) * 0.03);
            ctx.fillStyle = 'rgba(0, 255, 70, ' + fade + ')';
            ctx.font = fs + 'px monospace';
          }
          ctx.fillText(m.text[c], m.x, m.y + c * (fs + 1));
        }
        ctx.restore();
        if (m.charIdx >= m.text.length) {
          m.age++;
          if (m.age > m.text.length * 2 + 40) this.activeMsg = null;
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
    if (manualRain) return;
    if (screensaverActive) {
      screensaverActive = false;
      rain.stop();
      setTimeout(function () { rain.hide(); }, FADE_DURATION);
      for (var i = 0; i < entries.length; i++) {
        if (entries[i] && document.activeElement === entries[i].terminal.textarea) {
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

  // ── Terminal Management ─────────────────────────────────────

  /** @type {({ terminal: *, fitAddon: *, searchAddon: *, locked: boolean, lastOutputTime: number } | null)[]} */
  var entries = [];
  var focusFollowsTimer = null;

  function getLayout(count) {
    for (var i = 0; i < LAYOUTS.length; i++) {
      if (LAYOUTS[i].count === count) return LAYOUTS[i];
    }
    return null;
  }

  function getInitialCount() {
    var saved = localStorage.getItem('construct-layout');
    if (saved) {
      var count = parseInt(saved, 10);
      if (getLayout(count)) return count;
    }
    return 6;
  }

  function createTerminalCell(id) {
    var cell = document.createElement('div');
    cell.className = 'terminal-cell';
    cell.id = 'terminal-' + id;

    var label = document.createElement('div');
    label.className = 'terminal-label';

    var num = document.createElement('span');
    num.className = 'label-num';
    num.textContent = String(id + 1);

    var name = document.createElement('span');
    name.className = 'label-name';
    name.textContent = 'shell';

    var lock = document.createElement('span');
    lock.className = 'label-lock';
    lock.style.display = 'none';
    lock.textContent = '\uD83D\uDD12';

    label.appendChild(num);
    label.appendChild(name);
    label.appendChild(lock);
    cell.appendChild(label);

    return cell;
  }

  function setupTerminal(id) {
    var container = document.getElementById('terminal-' + id);
    if (!container) return;

    var terminal = new Terminal(TERMINAL_OPTIONS);
    var fitAddon = new FitAddon();
    var searchAddon = new SearchAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(searchAddon);
    terminal.open(container);

    // WebGL renderer — 5-10x faster than Canvas 2D
    try {
      var webglAddon = new WebglAddon();
      webglAddon.onContextLoss(function () { webglAddon.dispose(); });
      terminal.loadAddon(webglAddon);
    } catch (e) {
      // WebGL not available, falls back to canvas automatically
    }

    fitAddon.fit();

    // User input -> pty (blocked when locked, broadcast when enabled)
    terminal.onData(function (data) {
      if (broadcastMode) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i] && !entries[i].locked) window.terminalAPI.send(i, data);
        }
      } else if (entries[id] && !entries[id].locked) {
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

    // pty output -> terminal display + track activity for notifications
    var outputTimer = null;
    window.terminalAPI.onData(id, function (data) {
      terminal.write(data);
      if (entries[id]) entries[id].lastOutputTime = Date.now();

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
        var newName = prompt('Rename terminal ' + (id + 1) + ':', labelName.textContent);
        if (newName !== null && newName.trim()) labelName.textContent = newName.trim();
      });
    }

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

    entries[id] = { terminal: terminal, fitAddon: fitAddon, searchAddon: searchAddon, locked: false, lastOutputTime: 0 };
  }

  function setLayout(count) {
    var layout = getLayout(count);
    if (!layout) return;
    unzoomIfNeeded();
    var grid = document.getElementById('grid');

    // Update CSS grid dimensions
    grid.style.gridTemplateColumns = 'repeat(' + layout.cols + ', 1fr)';
    grid.style.gridTemplateRows = 'repeat(' + layout.rows + ', 1fr)';

    // Remove excess terminals if shrinking
    for (var i = count; i < currentTerminalCount; i++) {
      if (entries[i]) {
        entries[i].terminal.dispose();
        entries[i] = null;
      }
      var cell = document.getElementById('terminal-' + i);
      if (cell) cell.remove();
      window.terminalAPI.offData(i);
      window.terminalAPI.killPty(i);
    }

    // Add new terminals if growing
    for (var i = currentTerminalCount; i < count; i++) {
      grid.appendChild(createTerminalCell(i));
      setupTerminal(i);
    }

    entries.length = count;
    currentTerminalCount = count;
    localStorage.setItem('construct-layout', String(count));

    setTimeout(function () {
      refitAll();
      showResizeOverlay();
    }, 50);
  }

  function refitAll() {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i]) {
        entries[i].fitAddon.fit();
        window.terminalAPI.resize(i, entries[i].terminal.cols, entries[i].terminal.rows);
      }
    }
  }

  // ── Pane Zoom ────────────────────────────────────────────────

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
      var zLabel = document.querySelector('#terminal-' + zoomedTerminalId + ' .label-zoom');
      if (zLabel) zLabel.remove();
      zoomedTerminalId = -1;
      setTimeout(refitAll, 50);
      return;
    }

    var id = getFocusedTerminalId();
    if (id < 0) return;

    zoomedTerminalId = id;

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
      toggleZoom();
    }
  }

  // ── Focus Management ────────────────────────────────────────

  function focusTerminal(id) {
    if (id >= 0 && id < entries.length && entries[id]) {
      entries[id].terminal.focus();
    }
  }

  function getFocusedTerminalId() {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i] && document.activeElement === entries[i].terminal.textarea) {
        return i;
      }
    }
    return -1;
  }

  function toggleLock(id) {
    if (id < 0 || id >= entries.length || !entries[id]) return;
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
    if (id >= 0 && entries[id]) {
      entries[id].searchAddon.clearDecorations();
      entries[id].terminal.focus();
    }
  }

  document.getElementById('search-input').addEventListener('input', function (e) {
    var id = getFocusedTerminalId();
    if (id < 0) id = 0;
    if (entries[id]) entries[id].searchAddon.findNext(e.target.value);
  });

  document.getElementById('search-input').addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeSearch(); return; }
    if (e.key === 'Enter') {
      var id = getFocusedTerminalId();
      if (id < 0) id = 0;
      if (entries[id]) {
        if (e.shiftKey) entries[id].searchAddon.findPrevious(e.target.value);
        else entries[id].searchAddon.findNext(e.target.value);
      }
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
    if (id >= 0 && entries[id]) entries[id].terminal.focus();
  }

  function renderSnippets(filter) {
    var list = document.getElementById('snippet-list');
    var filtered = defaultSnippets.filter(function (s) {
      return s.name.toLowerCase().indexOf(filter.toLowerCase()) !== -1 ||
             s.cmd.toLowerCase().indexOf(filter.toLowerCase()) !== -1;
    });
    snippetSelectedIdx = 0;
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
    if (entries[id] && !entries[id].locked) {
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

  // ── Layout Picker ──────────────────────────────────────────

  function openLayoutPicker() {
    layoutPickerVisible = true;
    document.getElementById('layout-palette').classList.add('active');
    document.getElementById('layout-overlay').classList.add('active');
    layoutPickerSelectedIdx = 0;
    for (var i = 0; i < LAYOUTS.length; i++) {
      if (LAYOUTS[i].count === currentTerminalCount) {
        layoutPickerSelectedIdx = i;
        break;
      }
    }
    renderLayoutOptions();
  }

  function closeLayoutPicker() {
    layoutPickerVisible = false;
    document.getElementById('layout-palette').classList.remove('active');
    document.getElementById('layout-overlay').classList.remove('active');
    var id = getFocusedTerminalId();
    if (id >= 0 && entries[id]) entries[id].terminal.focus();
  }

  function renderLayoutOptions() {
    var list = document.getElementById('layout-list');
    while (list.firstChild) list.removeChild(list.firstChild);
    LAYOUTS.forEach(function (layout, i) {
      var item = document.createElement('div');
      item.className = 'layout-item';
      if (i === layoutPickerSelectedIdx) item.className += ' selected';
      item.setAttribute('data-count', String(layout.count));

      // Grid preview: small dots arranged in the grid pattern
      var preview = document.createElement('span');
      preview.className = 'layout-preview';
      preview.style.gridTemplateColumns = 'repeat(' + layout.cols + ', 8px)';
      for (var idx = 0; idx < layout.cols * layout.rows; idx++) {
        var dot = document.createElement('span');
        dot.className = 'layout-dot';
        if (idx < layout.count) dot.classList.add('filled');
        preview.appendChild(dot);
      }

      var labelSpan = document.createElement('span');
      labelSpan.className = 'layout-label';
      labelSpan.textContent = layout.label;

      var badge = document.createElement('span');
      badge.className = 'layout-current';
      if (layout.count === currentTerminalCount) badge.textContent = 'current';

      item.appendChild(preview);
      item.appendChild(labelSpan);
      item.appendChild(badge);
      list.appendChild(item);
    });
  }

  document.getElementById('layout-list').addEventListener('click', function (e) {
    var item = e.target.closest('.layout-item');
    if (item) {
      var count = parseInt(item.getAttribute('data-count'), 10);
      setLayout(count);
      closeLayoutPicker();
    }
  });

  document.getElementById('layout-overlay').addEventListener('click', closeLayoutPicker);

  // ── Copy/Paste ──────────────────────────────────────────────

  function copySelection() {
    var id = getFocusedTerminalId();
    if (id >= 0 && entries[id]) {
      var sel = entries[id].terminal.getSelection();
      if (sel) navigator.clipboard.writeText(sel);
    }
  }

  function pasteClipboard() {
    var id = getFocusedTerminalId();
    if (id < 0 || !entries[id]) return;
    navigator.clipboard.readText().then(function (text) {
      if (!entries[id].locked) {
        window.terminalAPI.send(id, text);
      }
    });
  }

  // ── All Keyboard Shortcuts ──────────────────────────────────

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (layoutPickerVisible) { closeLayoutPicker(); return; }
      if (snippetVisible) { closeSnippetPalette(); return; }
      if (searchVisible) { closeSearch(); return; }
    }

    // Layout picker navigation (no modifier needed while open)
    if (layoutPickerVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        layoutPickerSelectedIdx = Math.min(layoutPickerSelectedIdx + 1, LAYOUTS.length - 1);
        renderLayoutOptions();
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        layoutPickerSelectedIdx = Math.max(layoutPickerSelectedIdx - 1, 0);
        renderLayoutOptions();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        setLayout(LAYOUTS[layoutPickerSelectedIdx].count);
        closeLayoutPicker();
        return;
      }
    }

    if (!e.ctrlKey) return;

    // Ctrl+1 through Ctrl+9 — focus terminal by number
    var num = parseInt(e.key, 10);
    if (num >= 1 && num <= 9 && num <= currentTerminalCount) {
      e.preventDefault();
      unzoomIfNeeded();
      focusTerminal(num - 1);
      return;
    }

    // Ctrl+` to cycle
    if (e.key === '`') {
      e.preventDefault();
      var next = (getFocusedTerminalId() + 1) % entries.length;
      focusTerminal(next);
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
      if (e.key === 'G') { e.preventDefault(); openLayoutPicker(); return; }
      if (e.key === 'Z') { e.preventDefault(); toggleZoom(); return; }
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

  // ── Debounced Resize + Overlay ────────────────────────────────

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

  function boot() {
    initWindowControls();
    runBootRain().then(function () {
      setLayout(getInitialCount());
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
