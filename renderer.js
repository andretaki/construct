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

  // ── Matrix Rain Boot Sequence ──────────────────────────────────
  var BOOT_DURATION = 2500;
  var FADE_DURATION = 800;

  function runMatrixRain() {
    var canvas = document.getElementById('matrix-rain');
    if (!canvas) { return Promise.resolve(); }

    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var fontSize = 14;
    var columns = Math.floor(canvas.width / fontSize);
    var drops = [];
    for (var i = 0; i < columns; i++) {
      drops[i] = Math.random() * -50;
    }

    var chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789ABCDEFZ';
    var charArr = chars.split('');

    var animId;
    var startTime = Date.now();

    function draw() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (var i = 0; i < drops.length; i++) {
        var char = charArr[Math.floor(Math.random() * charArr.length)];

        // Lead character is bright white-green, trail is green
        if (Math.random() > 0.3) {
          ctx.fillStyle = '#0f0';
          ctx.font = fontSize + 'px monospace';
        } else {
          ctx.fillStyle = '#aff';
          ctx.font = 'bold ' + fontSize + 'px monospace';
        }

        ctx.fillText(char, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      if (Date.now() - startTime < BOOT_DURATION) {
        animId = requestAnimationFrame(draw);
      }
    }

    animId = requestAnimationFrame(draw);

    return new Promise(function (resolve) {
      setTimeout(function () {
        cancelAnimationFrame(animId);
        canvas.classList.add('fade-out');
        setTimeout(function () {
          canvas.remove();
          resolve();
        }, FADE_DURATION);
      }, BOOT_DURATION);
    });
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

      terminal.loadAddon(fitAddon);
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

      // User input → pty (blocked when locked)
      terminal.onData(function (data) {
        if (!entries[id] || !entries[id].locked) {
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

      entries.push({ terminal, fitAddon, locked: false, lastOutputTime: 0 });
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

  // Ctrl+1-6 focus, Ctrl+` cycle, Ctrl+Shift+L lock
  document.addEventListener('keydown', function (e) {
    if (!e.ctrlKey) return;

    // Ctrl+1 through Ctrl+6
    if (e.key >= '1' && e.key <= '6') {
      e.preventDefault();
      focusTerminal(parseInt(e.key, 10) - 1);
      return;
    }

    // Ctrl+` to cycle to next terminal
    if (e.key === '`') {
      e.preventDefault();
      focusTerminal((getFocusedTerminalId() + 1) % entries.length);
      return;
    }

    // Ctrl+Shift+L to toggle read-only lock
    if (e.key === 'L' && e.shiftKey) {
      e.preventDefault();
      toggleLock(getFocusedTerminalId());
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
    runMatrixRain().then(function () {
      initTerminals();
      focusTerminal(0);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
