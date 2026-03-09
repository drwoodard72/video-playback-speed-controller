/**
 * Video Speed Controller — Content Script
 *
 * Injected into every frame (including cross-origin iframes) via the manifest.
 * Each instance manages media elements within its own frame only.
 */
(function () {
  'use strict';

  /** Current playback speed for this frame. */
  let currentSpeed = 1.0;

  /**
   * Find all HTMLVideoElement and HTMLAudioElement nodes in the current
   * document, including those nested inside open shadow DOM trees.
   * @returns {HTMLMediaElement[]} Deduplicated array of media elements.
   */
  function findMediaElements() {
    const found = new Set();

    // Top-level query
    document.querySelectorAll('video, audio').forEach(el => found.add(el));

    // Walk open shadow roots recursively
    function walkShadow(root) {
      root.querySelectorAll('*').forEach(el => {
        if (el.shadowRoot) {
          el.shadowRoot.querySelectorAll('video, audio').forEach(m => found.add(m));
          walkShadow(el.shadowRoot);
        }
      });
    }
    walkShadow(document);

    // Attempt to reach into same-origin <object> and <embed> elements
    document.querySelectorAll('object, embed').forEach(el => {
      try {
        const doc = el.contentDocument;
        if (doc) {
          doc.querySelectorAll('video, audio').forEach(m => found.add(m));
        }
      } catch (_) {
        // Cross-origin — silently skip
      }
    });

    return Array.from(found);
  }

  /**
   * Apply a playback rate to every media element in this frame.
   * @param {number} rate - Desired playback rate.
   * @returns {{ frameUrl: string, count: number, speed: number }}
   */
  function applySpeed(rate) {
    // Clamp to [0.1, 16.0]
    rate = Math.min(16.0, Math.max(0.1, rate));
    currentSpeed = rate;

    const elements = findMediaElements();
    elements.forEach(el => {
      el.playbackRate = rate;
      el.defaultPlaybackRate = rate;
    });

    return { frameUrl: location.href, count: elements.length, speed: rate };
  }

  // --- MutationObserver: catch dynamically added media elements ---
  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        if (node.matches && node.matches('video, audio')) {
          node.playbackRate = currentSpeed;
          node.defaultPlaybackRate = currentSpeed;
        }
        // Also check children of the added node
        if (node.querySelectorAll) {
          node.querySelectorAll('video, audio').forEach(el => {
            el.playbackRate = currentSpeed;
            el.defaultPlaybackRate = currentSpeed;
          });
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  }

  // --- Apply current speed to any elements already present ---
  applySpeed(currentSpeed);

  // --- Message listener (chrome.runtime.onMessage) ---
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'setSpeed') {
      sendResponse(applySpeed(message.speed));
    } else if (message.action === 'getSpeed') {
      sendResponse({
        speed: currentSpeed,
        count: findMediaElements().length,
        frameUrl: location.href
      });
    } else if (message.action === 'rescan') {
      const result = applySpeed(currentSpeed);
      sendResponse(result);
    }
    return true; // keep message channel open for async responses
  });

  // --- Window bridge for popup's executeScript approach ---
  if (!window.__vsc__) {
    window.__vsc__ = {
      /**
       * Handle a message from the popup via executeScript injection.
       * @param {{ action: string, speed?: number }} msg
       * @returns {object|null}
       */
      handleMessage(msg) {
        if (msg.action === 'setSpeed') return applySpeed(msg.speed);
        if (msg.action === 'getSpeed') return {
          speed: currentSpeed,
          count: findMediaElements().length,
          frameUrl: location.href
        };
        if (msg.action === 'rescan') return applySpeed(currentSpeed);
        return null;
      }
    };
  }
})();
