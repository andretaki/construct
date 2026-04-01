// renderer.js — wires 6 xterm.js terminals to node-pty via IPC
//
// xterm 5.x UMD bundle spreads all its exports onto window directly,
// so Terminal is available as window.Terminal.
// xterm-addon-fit UMD bundle assigns e.FitAddon = t() on self (window),
// so FitAddon is available as window.FitAddon.

(function () {
  'use strict';

  const { Terminal } = window;
  const { FitAddon } = window;

  const TERMINAL_COUNT = 6;

  const TERMINAL_OPTIONS = {
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'monospace',
    theme: {
      background: '#000000',
      foreground: '#cccccc',
    },
  };

  /**
   * @typedef {{ terminal: import('xterm').Terminal, fitAddon: FitAddon }} TerminalEntry
   */

  /** @type {TerminalEntry[]} */
  const entries = [];

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
      fitAddon.fit();

      // User input → pty
      terminal.onData(function (data) {
        window.terminalAPI.send(id, data);
      });

      // pty output → terminal display
      window.terminalAPI.onData(id, function (data) {
        terminal.write(data);
      });

      // Send initial dimensions to pty
      window.terminalAPI.resize(id, terminal.cols, terminal.rows);

      entries.push({ terminal, fitAddon });
    }
  }

  function refitAll() {
    entries.forEach(function ({ terminal, fitAddon }, id) {
      fitAddon.fit();
      window.terminalAPI.resize(id, terminal.cols, terminal.rows);
    });
  }

  // Re-fit terminals whenever the window is resized
  window.addEventListener('resize', refitAll);

  // Initialise once the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminals);
  } else {
    initTerminals();
  }
})();
