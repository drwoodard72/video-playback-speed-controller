/**
 * Popup Script — Rush's Video Playback Speed Controller
 *
 * Communicates with all frames via chrome.scripting.executeScript.
 * The injected function is fully self-contained to avoid cross-world
 * isolation issues (executeScript runs in a separate isolated world
 * instance from manifest-declared content scripts).
 */
(function () {
  'use strict';

  // Presets are stored as objects: { speed: number, quick: boolean }
  const DEFAULT_PRESETS = [
    { speed: 0.1,  quick: false },
    { speed: 0.25, quick: false },
    { speed: 0.5,  quick: true },
    { speed: 0.75, quick: true },
    { speed: 1.0,  quick: true },
    { speed: 1.25, quick: true },
    { speed: 1.5,  quick: true },
    { speed: 1.75, quick: false },
    { speed: 2.0,  quick: true },
    { speed: 2.5,  quick: false },
    { speed: 3.0,  quick: true },
    { speed: 4.0,  quick: false },
    { speed: 8.0,  quick: false },
    { speed: 16.0, quick: false }
  ];
  const MAX_QUICK = 7;
  const MIN_SPEED = 0.1;
  const MAX_SPEED = 16.0;

  // --- DOM refs ---
  const btnDecrease = document.getElementById('btn-decrease');
  const btnSpeed = document.getElementById('btn-speed');
  const btnIncrease = document.getElementById('btn-increase');
  const btnRescan = document.getElementById('btn-rescan');
  const statusEl = document.getElementById('status');
  const btnConfig = document.getElementById('btn-config');
  const configPanel = document.getElementById('config-panel');
  const pctStepControls = document.getElementById('pct-step-controls');
  const pctStepValue = document.getElementById('pct-step-value');
  const pctStepDec = document.getElementById('pct-step-dec');
  const pctStepInc = document.getElementById('pct-step-inc');
  const presetListEl = document.getElementById('preset-list');
  const quickPresetsEl = document.getElementById('quick-presets');
  const btnPresetInsert = document.getElementById('btn-preset-insert');
  const btnPresetSort = document.getElementById('btn-preset-sort');
  const btnPresetReset = document.getElementById('btn-preset-reset');

  // --- State ---
  let currentSpeed = 1.0;
  let activeTabId = null;
  let mode = 'presets';       // 'presets' | 'percentage'
  let pctStep = 10;           // percentage step (1–100)
  let presets = DEFAULT_PRESETS.map(p => ({ ...p }));

  // =============================================
  // Helpers
  // =============================================

  function formatSpeed(rate) {
    return Math.round(rate * 100) + '%';
  }

  function clampSpeed(rate) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, rate));
  }

  /** Count how many presets currently have quick access enabled. */
  function quickCount() {
    return presets.filter(p => p.quick).length;
  }

  function updateDisplay() {
    btnSpeed.textContent = formatSpeed(currentSpeed);
    updateQuickPresets();
  }

  /**
   * Rebuild the quick-access buttons bar dynamically from presets
   * that have quick === true (1–7 buttons).
   */
  function updateQuickPresets() {
    quickPresetsEl.innerHTML = '';
    const quickItems = presets.filter(p => p.quick);
    quickItems.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'quick-btn';
      btn.textContent = formatSpeed(p.speed);
      btn.classList.toggle('active', Math.abs(currentSpeed - p.speed) < 0.001);
      btn.addEventListener('click', async () => {
        currentSpeed = p.speed;
        updateDisplay();
        saveConfig();
        const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
        updateStatus(results);
      });
      quickPresetsEl.appendChild(btn);
    });
  }

  function updateStatus(results) {
    if (!results || results.length === 0) {
      statusEl.textContent = 'No video elements found. Try Rescan.';
      return;
    }
    let totalVideos = 0;
    let framesWithVideo = 0;
    for (const r of results) {
      if (r.result && r.result.count > 0) {
        totalVideos += r.result.count;
        framesWithVideo++;
      }
    }
    if (totalVideos === 0) {
      statusEl.textContent = 'No video elements found. Try Rescan.';
    } else {
      statusEl.textContent = `Found ${totalVideos} video(s) across ${framesWithVideo} frame(s)`;
    }
  }

  // =============================================
  // Speed calculation
  // =============================================

  function nextHigherSpeed() {
    if (mode === 'percentage') {
      return clampSpeed(currentSpeed + pctStep / 100);
    }
    for (const p of presets) {
      if (p.speed > currentSpeed + 0.001) return p.speed;
    }
    return presets[presets.length - 1].speed;
  }

  function nextLowerSpeed() {
    if (mode === 'percentage') {
      return clampSpeed(currentSpeed - pctStep / 100);
    }
    for (let i = presets.length - 1; i >= 0; i--) {
      if (presets[i].speed < currentSpeed - 0.001) return presets[i].speed;
    }
    return presets[0].speed;
  }

  // =============================================
  // Frame communication
  // =============================================

  function injectedHandler(msg) {
    var found = [];
    document.querySelectorAll('video, audio').forEach(function (el) { found.push(el); });
    document.querySelectorAll('*').forEach(function (el) {
      if (el.shadowRoot) {
        el.shadowRoot.querySelectorAll('video, audio').forEach(function (m) { found.push(m); });
        el.shadowRoot.querySelectorAll('*').forEach(function (inner) {
          if (inner.shadowRoot) {
            inner.shadowRoot.querySelectorAll('video, audio').forEach(function (m) { found.push(m); });
          }
        });
      }
    });
    document.querySelectorAll('object, embed').forEach(function (el) {
      try {
        if (el.contentDocument) {
          el.contentDocument.querySelectorAll('video, audio').forEach(function (m) { found.push(m); });
        }
      } catch (_) {}
    });

    if (msg.action === 'setSpeed' || msg.action === 'rescan') {
      var rate = Math.min(16.0, Math.max(0.1, msg.speed || 1.0));
      found.forEach(function (el) {
        el.playbackRate = rate;
        el.defaultPlaybackRate = rate;
      });
      return { frameUrl: location.href, count: found.length, speed: rate };
    }
    if (msg.action === 'getSpeed') {
      var currentRate = found.length > 0 ? found[0].playbackRate : 1.0;
      return { frameUrl: location.href, count: found.length, speed: currentRate };
    }
    return { frameUrl: location.href, count: found.length, speed: 1.0 };
  }

  async function broadcastToAllFrames(message) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTabId, allFrames: true },
        func: injectedHandler,
        args: [message]
      });
      if (message.action === 'setSpeed') {
        chrome.tabs.sendMessage(activeTabId, message).catch(() => {});
      }
      return results;
    } catch (err) {
      statusEl.textContent = 'Cannot access this page';
      return [];
    }
  }

  // =============================================
  // Persistence
  // =============================================

  function saveConfig() {
    chrome.storage.local.set({
      speed: currentSpeed,
      mode: mode,
      pctStep: pctStep,
      presets: presets
    });
    updateQuickPresets();
  }

  async function loadConfig() {
    const stored = await chrome.storage.local.get({
      speed: 1.0,
      mode: 'presets',
      pctStep: 10,
      presets: DEFAULT_PRESETS.map(p => ({ ...p }))
    });
    currentSpeed = stored.speed;
    mode = stored.mode;
    pctStep = stored.pctStep;
    // Migrate legacy flat array format to object format
    if (stored.presets.length > 0 && typeof stored.presets[0] === 'number') {
      presets = stored.presets.map(speed => {
        const def = DEFAULT_PRESETS.find(d => Math.abs(d.speed - speed) < 0.001);
        return { speed: speed, quick: def ? def.quick : false };
      });
    } else {
      presets = stored.presets;
    }
    // Ensure 100% always has quick enabled
    const oneX = presets.find(p => Math.abs(p.speed - 1.0) < 0.001);
    if (oneX) oneX.quick = true;
  }

  // =============================================
  // Config panel — mode switching
  // =============================================

  function applyModeUI() {
    document.querySelector(`input[name="mode"][value="${mode}"]`).checked = true;
    if (mode === 'percentage') {
      pctStepControls.classList.add('active');
    } else {
      pctStepControls.classList.remove('active');
    }
    pctStepValue.value = pctStep;
  }

  document.querySelectorAll('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      mode = radio.value;
      applyModeUI();
      saveConfig();
    });
  });

  // --- Percentage step controls ---

  pctStepInc.addEventListener('click', () => {
    pctStep = Math.min(100, pctStep + 1);
    pctStepValue.value = pctStep;
    saveConfig();
  });

  pctStepDec.addEventListener('click', () => {
    pctStep = Math.max(1, pctStep - 1);
    pctStepValue.value = pctStep;
    saveConfig();
  });

  pctStepValue.addEventListener('change', () => {
    let val = parseInt(pctStepValue.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 100) val = 100;
    pctStep = val;
    pctStepValue.value = pctStep;
    saveConfig();
  });

  // =============================================
  // Config panel — preset editor
  // =============================================

  function renderPresets() {
    presetListEl.innerHTML = '';
    presets.forEach((preset, index) => {
      const row = document.createElement('div');
      row.className = 'preset-row';

      // Quick-access checkbox
      const isOneX = Math.abs(preset.speed - 1.0) < 0.001;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = preset.quick;
      checkbox.title = 'Show in quick access bar';
      // 100% is always checked; disable unchecking if at max and not already checked
      if (isOneX) {
        checkbox.disabled = true;
      } else if (!preset.quick && quickCount() >= MAX_QUICK) {
        checkbox.disabled = true;
        checkbox.title = 'Maximum of ' + MAX_QUICK + ' quick access presets';
      }
      checkbox.addEventListener('change', () => {
        if (isOneX) { checkbox.checked = true; return; }
        if (checkbox.checked && quickCount() >= MAX_QUICK) {
          checkbox.checked = false;
          return;
        }
        preset.quick = checkbox.checked;
        renderPresets();
        saveConfig();
      });

      const input = document.createElement('input');
      input.type = 'number';
      input.value = Math.round(preset.speed * 100);
      input.min = Math.round(MIN_SPEED * 100);
      input.max = Math.round(MAX_SPEED * 100);
      input.step = 1;
      input.addEventListener('change', () => {
        let pct = parseFloat(input.value);
        if (isNaN(pct)) { input.classList.add('invalid'); return; }
        pct = Math.min(MAX_SPEED * 100, Math.max(MIN_SPEED * 100, pct));
        const newRate = pct / 100;
        const isDupe = presets.some((p, i) => i !== index && Math.abs(p.speed - newRate) < 0.001);
        if (isDupe) {
          input.classList.add('invalid');
          return;
        }
        input.classList.remove('invalid');
        preset.speed = newRate;
        input.value = Math.round(pct);
        saveConfig();
      });

      const pctLabel = document.createElement('span');
      pctLabel.className = 'pct-label';
      pctLabel.textContent = '%';

      const btnUp = document.createElement('button');
      btnUp.className = 'move-btn';
      btnUp.textContent = '\u25B2';
      btnUp.title = 'Move up';
      btnUp.disabled = index === 0;
      btnUp.addEventListener('click', () => {
        if (index > 0) {
          [presets[index - 1], presets[index]] = [presets[index], presets[index - 1]];
          renderPresets();
          saveConfig();
        }
      });

      const btnDown = document.createElement('button');
      btnDown.className = 'move-btn';
      btnDown.textContent = '\u25BC';
      btnDown.title = 'Move down';
      btnDown.disabled = index === presets.length - 1;
      btnDown.addEventListener('click', () => {
        if (index < presets.length - 1) {
          [presets[index], presets[index + 1]] = [presets[index + 1], presets[index]];
          renderPresets();
          saveConfig();
        }
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'delete-btn';
      btnDelete.textContent = '\u00D7';
      btnDelete.title = 'Delete';
      btnDelete.disabled = isOneX;
      btnDelete.addEventListener('click', () => {
        if (!isOneX) {
          presets.splice(index, 1);
          renderPresets();
          saveConfig();
        }
      });

      row.appendChild(checkbox);
      row.appendChild(input);
      row.appendChild(pctLabel);
      row.appendChild(btnUp);
      row.appendChild(btnDown);
      row.appendChild(btnDelete);
      presetListEl.appendChild(row);
    });
  }

  // --- Preset action buttons ---

  btnPresetInsert.addEventListener('click', () => {
    let candidate = 1.0;
    for (let c = 1.0; c <= MAX_SPEED; c += 0.25) {
      if (!presets.some(p => Math.abs(p.speed - c) < 0.001)) {
        candidate = c;
        break;
      }
    }
    presets.push({ speed: candidate, quick: false });
    renderPresets();
    saveConfig();
    presetListEl.scrollTop = presetListEl.scrollHeight;
  });

  btnPresetSort.addEventListener('click', () => {
    presets.sort((a, b) => a.speed - b.speed);
    renderPresets();
    saveConfig();
  });

  btnPresetReset.addEventListener('click', () => {
    presets = DEFAULT_PRESETS.map(p => ({ ...p }));
    renderPresets();
    saveConfig();
  });

  // =============================================
  // Config panel — toggle
  // =============================================

  btnConfig.addEventListener('click', () => {
    const isHidden = configPanel.classList.toggle('hidden');
    btnConfig.classList.toggle('open', !isHidden);
  });

  // =============================================
  // Speed control buttons
  // =============================================

  btnIncrease.addEventListener('click', async () => {
    currentSpeed = nextHigherSpeed();
    updateDisplay();
    saveConfig();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
    updateStatus(results);
  });

  btnDecrease.addEventListener('click', async () => {
    currentSpeed = nextLowerSpeed();
    updateDisplay();
    saveConfig();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
    updateStatus(results);
  });

  btnSpeed.addEventListener('click', async () => {
    currentSpeed = 1.0;
    updateDisplay();
    saveConfig();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: 1.0 });
    updateStatus(results);
  });

  btnRescan.addEventListener('click', async () => {
    btnRescan.classList.add('spinning');
    setTimeout(() => btnRescan.classList.remove('spinning'), 500);

    const results = await broadcastToAllFrames({ action: 'rescan', speed: currentSpeed });
    updateStatus(results);

    const speedResults = await broadcastToAllFrames({ action: 'getSpeed' });
    if (speedResults && speedResults.length > 0) {
      for (const r of speedResults) {
        if (r.result && r.result.speed) {
          currentSpeed = r.result.speed;
          updateDisplay();
          break;
        }
      }
    }
  });

  // =============================================
  // Init
  // =============================================

  async function init() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        statusEl.textContent = 'No active tab found';
        return;
      }
      activeTabId = tab.id;

      await loadConfig();
      updateDisplay();
      applyModeUI();
      renderPresets();

      const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
      updateStatus(results);
    } catch (err) {
      statusEl.textContent = 'Cannot access this page';
    }
  }

  init();
})();
