// Offscreen Document — WebSocket 连接管理 + 音频播放
(function() {
  const audioManager = new AudioManager();
  const edgeProvider = new EdgeTTSProvider();
  const synthProvider = new SpeechSynthesisProvider();

  let currentReq = null; // 当前请求参数

  // 监听来自 SW 的消息
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
    case MSG.OFFS_INIT_WS:
      currentReq = msg;
      startEdgeTTS(msg.text, msg.voiceId, msg.speed);
      break;
    case MSG.OFFS_PLAY:
      audioManager.resume();
      break;
    case MSG.OFFS_PAUSE:
      audioManager.pause();
      postState('paused');
      break;
    case MSG.OFFS_RESUME:
      audioManager.resume();
      postState('playing');
      break;
    case MSG.OFFS_STOP:
      stopAll();
      break;
    }
  });

  async function startEdgeTTS(text, voiceId, speed) {
    postState('loading');
    try {
      const result = await edgeProvider.synthesize(text, voiceId, speed);
      if (!result.audioChunks || result.audioChunks.length === 0) {
        throw new Error('server');
      }
      const blob = new Blob(result.audioChunks, { type: result.contentType });
      const blobUrl = URL.createObjectURL(blob);

      audioManager.onEnd(() => {
        URL.revokeObjectURL(blobUrl);
        postState('ended');
      });

      audioManager.onError(() => {
        URL.revokeObjectURL(blobUrl);
        postState('error', 'server');
        fallbackToSynth(text, voiceId, speed);
      });

      await audioManager.play(blobUrl);
      postState('playing');
    } catch (e) {
      console.error('[tts] Edge TTS failed:', e.message);
      const errorCode = mapErrorCode(e.message);
      postState('error', errorCode);
      fallbackToSynth(text, voiceId, speed);
    }
  }

  function mapErrorCode(msg) {
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('连接')) return 'network';
    return 'server';
  }

  async function fallbackToSynth(text, voiceId, speed) {
    try {
      await synthProvider.synthesize(text, voiceId, speed);
      postState('playing');
    } catch (e) {
      console.error('[tts] SpeechSynthesis fallback failed:', e.message);
      postState('error', 'not_supported');
    }
  }

  function stopAll() {
    edgeProvider.cancel();
    synthProvider.cancel();
    audioManager.stop();
  }

  function postState(state, errorCode) {
    chrome.runtime.sendMessage({
      type: MSG.OFFS_STATE,
      state: state,
      errorCode: errorCode || null
    });
  }
})();
