/**
 * Popup Script — Rush's Video Playback Speed Controller
 *
 * Communicates with content scripts running in all frames of the active tab
 * via chrome.scripting.executeScript with allFrames: true.
 */
(function () {
  'use strict';

  const SPEED_STEPS = [0.1, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0, 4.0, 8.0, 16.0];

  const btnDecrease = document.getElementById('btn-decrease');
  const btnSpeed = document.getElementById('btn-speed');
  const btnIncrease = document.getElementById('btn-increase');
  const btnRescan = document.getElementById('btn-rescan');
  const statusEl = document.getElementById('status');

  let currentSpeed = 1.0;
  let activeTabId = null;

  /** Format a rate as a rounded integer percentage string. */
  function formatSpeed(rate) {
    return Math.round(rate * 100) + '%';
  }

  /** Update the speed display button. */
  function updateDisplay() {
    btnSpeed.textContent = formatSpeed(currentSpeed);
  }

  /** Update the status line with video/frame counts. */
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

  /**
   * Broadcast a message to all frames in the active tab using executeScript.
   * Uses the window.__vsc__ bridge exposed by the content script.
   * @param {{ action: string, speed?: number }} message
   * @returns {Promise<Array<{ frameId: number, result: object }>>}
   */
  async function broadcastToAllFrames(message) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTabId, allFrames: true },
        func: (msg) => {
          return window.__vsc__ ? window.__vsc__.handleMessage(msg) : null;
        },
        args: [message]
      });
      return results;
    } catch (err) {
      statusEl.textContent = 'Cannot access this page';
      return [];
    }
  }

  /** Get the next speed step above the current speed. */
  function nextHigherSpeed() {
    for (const step of SPEED_STEPS) {
      if (step > currentSpeed + 0.001) return step;
    }
    return SPEED_STEPS[SPEED_STEPS.length - 1];
  }

  /** Get the next speed step below the current speed. */
  function nextLowerSpeed() {
    for (let i = SPEED_STEPS.length - 1; i >= 0; i--) {
      if (SPEED_STEPS[i] < currentSpeed - 0.001) return SPEED_STEPS[i];
    }
    return SPEED_STEPS[0];
  }

  /** Save current speed to storage. */
  function saveSpeed() {
    chrome.storage.local.set({ speed: currentSpeed });
  }

  // --- Button handlers ---

  btnIncrease.addEventListener('click', async () => {
    currentSpeed = nextHigherSpeed();
    updateDisplay();
    saveSpeed();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
    updateStatus(results);
  });

  btnDecrease.addEventListener('click', async () => {
    currentSpeed = nextLowerSpeed();
    updateDisplay();
    saveSpeed();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
    updateStatus(results);
  });

  btnSpeed.addEventListener('click', async () => {
    currentSpeed = 1.0;
    updateDisplay();
    saveSpeed();
    const results = await broadcastToAllFrames({ action: 'setSpeed', speed: 1.0 });
    updateStatus(results);
  });

  btnRescan.addEventListener('click', async () => {
    // Animate the rescan button
    btnRescan.classList.add('spinning');
    setTimeout(() => btnRescan.classList.remove('spinning'), 500);

    const results = await broadcastToAllFrames({ action: 'rescan' });
    updateStatus(results);

    // Re-query speed from frames
    const speedResults = await broadcastToAllFrames({ action: 'getSpeed' });
    if (speedResults && speedResults.length > 0) {
      // Use the speed from the first frame that reports one
      for (const r of speedResults) {
        if (r.result && r.result.speed) {
          currentSpeed = r.result.speed;
          updateDisplay();
          break;
        }
      }
    }
  });

  // --- Initialization on popup open ---

  async function init() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        statusEl.textContent = 'No active tab found';
        return;
      }
      activeTabId = tab.id;

      // Load saved speed, default to 1.0
      const stored = await chrome.storage.local.get({ speed: 1.0 });
      currentSpeed = stored.speed;
      updateDisplay();

      // Apply saved speed to all frames
      const results = await broadcastToAllFrames({ action: 'setSpeed', speed: currentSpeed });
      updateStatus(results);
    } catch (err) {
      statusEl.textContent = 'Cannot access this page';
    }
  }

  init();
})();
