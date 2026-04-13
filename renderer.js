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
  var runtimeInfo = null;
  var benchmarkState = {
    active: false,
    reportPath: '',
    status: '',
  };

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

  // ── Themes ─────────────────────────────────────────────────

  var THEMES = {
    dark: {
      name: 'dark',
      terminal: {
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
      css: {
        '--bg-base': '#11111b',
        '--bg-surface': '#1e1e2e',
        '--bg-overlay': '#313244',
        '--text-primary': '#cdd6f4',
        '--text-muted': '#585b70',
        '--accent': '#89b4fa',
        '--accent-bg': 'rgba(137, 180, 250, 0.1)',
        '--accent-border': 'rgba(137, 180, 250, 0.5)',
        '--border': 'rgba(127, 132, 156, 0.08)',
        '--border-subtle': 'rgba(127, 132, 156, 0.06)',
        '--inactive-dim': 'rgba(0, 0, 0, 0.15)',
        '--danger': '#f38ba8',
        '--danger-bg': 'rgba(243, 139, 168, 0.15)',
        '--titlebar-bg': '#11111b',
        '--rain-fg': '#0f0',
        '--rain-bg': 'rgba(0, 0, 0, 0.05)',
      },
    },
    daylight: {
      name: 'daylight',
      terminal: {
        background: '#eff1f5',
        foreground: '#4c4f69',
        cursor: '#dc8a78',
        cursorAccent: '#eff1f5',
        selectionBackground: 'rgba(30, 102, 245, 0.2)',
        selectionForeground: '#4c4f69',
        selectionInactiveBackground: 'rgba(30, 102, 245, 0.1)',
        black: '#5c5f77',
        red: '#d20f39',
        green: '#40a02b',
        yellow: '#df8e1d',
        blue: '#1e66f5',
        magenta: '#8839ef',
        cyan: '#179299',
        white: '#acb0be',
        brightBlack: '#6c6f85',
        brightRed: '#d20f39',
        brightGreen: '#40a02b',
        brightYellow: '#df8e1d',
        brightBlue: '#1e66f5',
        brightMagenta: '#8839ef',
        brightCyan: '#179299',
        brightWhite: '#bcc0cc',
      },
      css: {
        '--bg-base': '#e6e9ef',
        '--bg-surface': '#eff1f5',
        '--bg-overlay': '#ccd0da',
        '--text-primary': '#4c4f69',
        '--text-muted': '#8c8fa1',
        '--accent': '#1e66f5',
        '--accent-bg': 'rgba(30, 102, 245, 0.1)',
        '--accent-border': 'rgba(30, 102, 245, 0.5)',
        '--border': 'rgba(76, 79, 105, 0.12)',
        '--border-subtle': 'rgba(76, 79, 105, 0.08)',
        '--inactive-dim': 'rgba(255, 255, 255, 0.25)',
        '--danger': '#d20f39',
        '--danger-bg': 'rgba(210, 15, 57, 0.12)',
        '--titlebar-bg': '#e6e9ef',
        '--rain-fg': '#40a02b',
        '--rain-bg': 'rgba(239, 241, 245, 0.08)',
      },
    },
  };

  var currentTheme = 'dark';

  function applyTheme(themeName) {
    var theme = THEMES[themeName];
    if (!theme) return;
    currentTheme = themeName;

    // Update default options so new terminals get the right theme
    TERMINAL_OPTIONS.theme = theme.terminal;

    // Apply CSS variables
    var root = document.documentElement;
    var css = theme.css;
    for (var key in css) {
      root.style.setProperty(key, css[key]);
    }

    // Apply terminal theme to all open terminals
    for (var i = 0; i < entries.length; i++) {
      if (entries[i]) {
        entries[i].terminal.options.theme = theme.terminal;
      }
    }

    document.body.setAttribute('data-theme', themeName);
  }

  function toggleTheme() {
    applyTheme(currentTheme === 'dark' ? 'daylight' : 'dark');
  }

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
    theme: THEMES.dark.terminal,
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
    throttled: false,
    lastFrame: 0,
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
      this.canvas.style.pointerEvents = 'none';
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
      // Throttle to ~15fps when used as screensaver to save CPU
      if (this.throttled) {
        var now = performance.now();
        if (now - this.lastFrame < 66) {
          var self = this;
          this.animId = requestAnimationFrame(function () { self._draw(); });
          return;
        }
        this.lastFrame = now;
      }
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
        this.canvas.style.pointerEvents = 'none';
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
    rain.throttled = false;
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
      // Re-fit and refocus terminals after screensaver dismissal
      // to clear any stale rendering state
      for (var i = 0; i < entries.length; i++) {
        if (entries[i]) {
          entries[i].fitAddon.fit();
        }
      }
      var focused = false;
      for (var j = 0; j < entries.length; j++) {
        if (entries[j] && document.activeElement === entries[j].terminal.textarea) {
          entries[j].terminal.focus();
          focused = true;
          break;
        }
      }
      if (!focused && entries[0]) {
        entries[0].terminal.focus();
      }
    }
    clearTimeout(afkTimer);
    afkTimer = setTimeout(startScreensaver, AFK_TIMEOUT);
  }

  function startScreensaver() {
    if (screensaverActive) return;
    screensaverActive = true;
    rain.canvas = document.getElementById('matrix-rain');
    rain.throttled = true;
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
    // Dismiss screensaver when window regains focus (Wayland doesn't always
    // fire keydown on the first interaction after focus returns)
    window.addEventListener('focus', resetAfkTimer, { passive: true });
    resetAfkTimer();
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function roundNumber(value) {
    return Math.round(value * 100) / 100;
  }

  function percentile(values, fraction) {
    if (!values.length) return 0;

    var sorted = values.slice().sort(function (a, b) { return a - b; });
    var index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * fraction)));
    return roundNumber(sorted[index]);
  }

  function setBenchmarkStatus(text) {
    benchmarkState.status = text;

    var node = document.getElementById('benchmark-status');
    if (!node) return;

    node.textContent = text;
    node.classList.toggle('active', Boolean(text));
  }

  function createFrameMonitor() {
    var active = false;
    var frameIntervals = [];
    var frameCount = 0;
    var totalFrameMs = 0;
    var maxFrameMs = 0;
    var over32Ms = 0;
    var over50Ms = 0;
    var rafId = 0;
    var previousTs = 0;

    function tick(ts) {
      if (!active) return;

      if (previousTs) {
        var frameMs = ts - previousTs;
        frameIntervals.push(frameMs);
        totalFrameMs += frameMs;
        frameCount++;
        if (frameMs > maxFrameMs) maxFrameMs = frameMs;
        if (frameMs > 32) over32Ms++;
        if (frameMs > 50) over50Ms++;
      }

      previousTs = ts;
      rafId = requestAnimationFrame(tick);
    }

    return {
      start: function () {
        if (active) return;
        active = true;
        previousTs = 0;
        rafId = requestAnimationFrame(tick);
      },
      stop: function () {
        active = false;
        if (rafId) cancelAnimationFrame(rafId);

        var averageFrameMs = frameCount ? totalFrameMs / frameCount : 0;

        return {
          avgFps: averageFrameMs ? roundNumber(1000 / averageFrameMs) : 0,
          avgFrameMs: roundNumber(averageFrameMs),
          frameCount: frameCount,
          longFrames32Ms: over32Ms,
          longFrames50Ms: over50Ms,
          maxFrameMs: roundNumber(maxFrameMs),
          p95FrameMs: percentile(frameIntervals, 0.95),
        };
      },
    };
  }

  function getActiveTerminalIds() {
    var ids = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i]) ids.push(i);
    }
    return ids;
  }

  function getRendererSummary() {
    var renderers = [];
    for (var i = 0; i < entries.length; i++) {
      if (entries[i]) renderers.push(entries[i].rendererType);
    }

    var webglCount = 0;
    var canvasCount = 0;
    for (var j = 0; j < renderers.length; j++) {
      if (renderers[j] === 'webgl') webglCount++;
      else canvasCount++;
    }

    return {
      canvasPanes: canvasCount,
      renderers: renderers,
      webglPanes: webglCount,
    };
  }

  function probeWebglEnvironment() {
    var canvas = document.createElement('canvas');
    var contexts = ['webgl2', 'webgl', 'experimental-webgl'];

    for (var i = 0; i < contexts.length; i++) {
      var contextName = contexts[i];
      var gl = null;

      try {
        gl = canvas.getContext(contextName, { antialias: false, powerPreference: 'high-performance' });
      } catch (_error) {
        gl = null;
      }

      if (!gl) continue;

      var debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      var vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      var renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);

      return {
        contextName: contextName,
        renderer: renderer,
        vendor: vendor,
        version: gl.getParameter(gl.VERSION),
      };
    }

    return null;
  }

  function getTotalBytesReceived() {
    var total = 0;
    for (var i = 0; i < entries.length; i++) {
      if (entries[i]) total += entries[i].bytesReceived;
    }
    return total;
  }

  function clearTerminalSurfaces() {
    for (var i = 0; i < entries.length; i++) {
      if (!entries[i]) continue;
      entries[i].terminal.reset();
      entries[i].terminal.clear();
      entries[i].terminal.scrollToBottom();
    }
  }

  async function waitForRenderIdle(quietMs, timeoutMs) {
    var quietFor = quietMs || 150;
    var deadline = Date.now() + (timeoutMs || 8000);
    var quietSince = 0;

    while (Date.now() < deadline) {
      var idle = true;
      var now = Date.now();

      for (var i = 0; i < entries.length; i++) {
        if (!entries[i]) continue;
        if (entries[i].pendingWrites > 0) {
          idle = false;
          break;
        }
        if (entries[i].lastOutputTime && now - entries[i].lastOutputTime < quietFor) {
          idle = false;
          break;
        }
      }

      if (idle) {
        if (!quietSince) quietSince = now;
        if (now - quietSince >= quietFor) return true;
      } else {
        quietSince = 0;
      }

      await sleep(50);
    }

    return false;
  }

  async function measurePhase(name, work) {
    var frameMonitor = createFrameMonitor();
    var startedAt = performance.now();
    frameMonitor.start();

    await work();

    var renderIdle = await waitForRenderIdle(150, 8000);
    var endedAt = performance.now();
    var frameStats = frameMonitor.stop();

    return {
      durationMs: roundNumber(endedAt - startedAt),
      frameStats: frameStats,
      name: name,
      renderIdle: renderIdle,
    };
  }

  async function runSyntheticPhase(name, scenario, options) {
    var ids = getActiveTerminalIds();
    var bytesBefore = getTotalBytesReceived();
    var result = await measurePhase(name, async function () {
      await window.appAPI.runBenchmarkScenario({
        ids: ids,
        options: options,
        scenario: scenario,
      });
    });

    result.bytesReceived = getTotalBytesReceived() - bytesBefore;
    result.rendererSummary = getRendererSummary();
    return result;
  }

  async function runScrollBenchmark() {
    var steps = 120;
    var stepSize = 3;
    var delayMs = 12;
    var result = await measurePhase('scroll', async function () {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i]) entries[i].terminal.scrollToTop();
      }

      await sleep(120);

      for (var step = 0; step < steps; step++) {
        for (var j = 0; j < entries.length; j++) {
          if (entries[j]) entries[j].terminal.scrollLines(stepSize);
        }
        await sleep(delayMs);
      }

      for (var k = 0; k < entries.length; k++) {
        if (entries[k]) entries[k].terminal.scrollToBottom();
      }
    });

    result.rendererSummary = getRendererSummary();
    result.steps = steps;
    result.stepDelayMs = delayMs;
    result.stepSize = stepSize;
    return result;
  }

  async function runResizeBenchmark() {
    var sizes = [
      { width: 1200, height: 800 },
      { width: 1440, height: 900 },
      { width: 1024, height: 720 },
      { width: 1600, height: 960 },
      { width: 1200, height: 800 },
    ];

    var result = await measurePhase('resize', async function () {
      for (var i = 0; i < sizes.length; i++) {
        await window.windowAPI.setBounds(sizes[i]);
        await sleep(250);
      }
    });

    result.rendererSummary = getRendererSummary();
    result.sizes = sizes;
    return result;
  }

  async function runBenchmarkPass(paneCount) {
    setBenchmarkStatus('benchmark: ' + paneCount + ' panes');
    setLayout(paneCount);
    focusTerminal(0);
    await sleep(300);
    await waitForRenderIdle(120, 3000);
    clearTerminalSurfaces();

    return {
      paneCount: paneCount,
      phases: [
        await runSyntheticPhase('heavy-output', 'heavy-output', {
          batchSize: 60,
          lineCount: 2500,
          lineWidth: 110,
        }),
        await runScrollBenchmark(),
        await runResizeBenchmark(),
        await runSyntheticPhase('tui', 'tui', {
          frameCount: 90,
          frameDelayMs: 16,
          rowCount: 14,
          rowWidth: 32,
        }),
      ],
      rendererSummary: getRendererSummary(),
    };
  }

  async function runBenchmarks() {
    benchmarkState.active = true;
    setBenchmarkStatus('benchmark: collecting runtime info');

    var report = {
      completedAt: null,
      method: 'synthetic main-process IPC output benchmark',
      results: [],
      runtime: Object.assign({}, runtimeInfo, {
        webglProbe: probeWebglEnvironment(),
      }),
      startedAt: new Date().toISOString(),
    };

    var paneCounts = [1, 4, 6, 12];
    for (var i = 0; i < paneCounts.length; i++) {
      report.results.push(await runBenchmarkPass(paneCounts[i]));
    }

    report.completedAt = new Date().toISOString();
    report.reportPath = await window.appAPI.saveBenchmarkReport(report);
    benchmarkState.reportPath = report.reportPath;

    setBenchmarkStatus('benchmark complete\n' + report.reportPath);
    console.log('[construct benchmark] report saved to', report.reportPath, report);

    await sleep(1200);
    window.windowAPI.close();
  }

  // ── Terminal Management ─────────────────────────────────────

  /** @type {({ terminal: *, fitAddon: *, searchAddon: *, locked: boolean, lastOutputTime: number, pendingWrites: number, bytesReceived: number, rendererType: string } | null)[]} */
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
    var rendererType = 'canvas';
    try {
      var webglAddon = new WebglAddon();
      webglAddon.onContextLoss(function () { webglAddon.dispose(); });
      terminal.loadAddon(webglAddon);
      rendererType = 'webgl';
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
      if (entries[id]) {
        entries[id].lastOutputTime = Date.now();
        entries[id].bytesReceived += data.length;
        entries[id].pendingWrites++;
      }

      terminal.write(data, function () {
        if (entries[id]) entries[id].pendingWrites = Math.max(0, entries[id].pendingWrites - 1);
      });

      clearTimeout(outputTimer);
      outputTimer = setTimeout(function () {
        if (!benchmarkState.active && !document.hasFocus()) {
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

    entries[id] = {
      terminal: terminal,
      fitAddon: fitAddon,
      searchAddon: searchAddon,
      locked: false,
      lastOutputTime: 0,
      pendingWrites: 0,
      bytesReceived: 0,
      rendererType: rendererType,
    };
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
      if (e.key === 'T') { e.preventDefault(); toggleTheme(); return; }
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

  async function boot() {
    applyTheme(currentTheme);
    runtimeInfo = await window.appAPI.getRuntimeInfo();
    initWindowControls();

    if (runtimeInfo && runtimeInfo.benchmarkMode) {
      setLayout(1);
      focusTerminal(0);
      await sleep(200);
      await runBenchmarks();
      return;
    }

    await runBootRain();
    setLayout(getInitialCount());
    focusTerminal(0);
    initAfkWatcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
