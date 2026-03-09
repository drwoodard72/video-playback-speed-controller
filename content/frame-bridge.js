/**
 * Frame Bridge — Optional helper for cross-frame messaging fallback.
 *
 * This script can be injected into sandboxed frames via web_accessible_resources
 * when the standard content script injection does not reach them. It listens for
 * window.postMessage events from the parent frame and forwards speed commands
 * to any media elements it can find.
 */
(function () {
  'use strict';

  window.addEventListener('message', (event) => {
    if (!event.data || event.data.source !== '__vsc_bridge__') return;

    const msg = event.data;
    const media = document.querySelectorAll('video, audio');

    if (msg.action === 'setSpeed') {
      const rate = Math.min(16.0, Math.max(0.1, msg.speed));
      media.forEach(el => {
        el.playbackRate = rate;
        el.defaultPlaybackRate = rate;
      });
    }
  });
})();
