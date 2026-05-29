// Popup — 音色选择、语速调节、试听
(function() {
  const voiceSelect = document.getElementById('voiceSelect');
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');
  const previewBtn = document.getElementById('previewBtn');
  const previewStatus = document.getElementById('previewStatus');

  let previewAudio = null;
  let previewAbort = null;

  // 初始化音色列表
  function initVoiceList() {
    VOICES.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      const rec = v.recommend ? ' · 推荐' : '';
      opt.textContent = `${v.name} (${v.gender === 'male' ? '男' : '女'}·${v.style}${rec})`;
      voiceSelect.appendChild(opt);
    });
  }

  // 加载已保存设置
  function loadSettings() {
    chrome.runtime.sendMessage({ type: MSG.POPUP_GET_SETTINGS }, (res) => {
      if (res) {
        voiceSelect.value = res.voiceId || CONSTANTS.DEFAULT_VOICE_ID;
        speedSlider.value = res.speed || CONSTANTS.DEFAULT_SPEED;
        speedValue.textContent = speedSlider.value + 'x';
      }
    });
  }

  // 保存设置
  function saveSettings() {
    chrome.runtime.sendMessage({
      type: MSG.POPUP_SAVE_SETTINGS,
      voiceId: voiceSelect.value,
      speed: parseFloat(speedSlider.value)
    });
  }

  // 通过远程代理试听（Edge 神经网络语音）
  async function startPreview() {
    // 如果正在播放，停止
    if (previewAudio) {
      previewAudio.pause();
      previewAudio = null;
      if (previewAbort) { previewAbort.abort(); previewAbort = null; }
      updatePreviewUI(false);
      return;
    }

    const voiceId = voiceSelect.value;
    const speed = parseFloat(speedSlider.value);
    const text = '你好，这是试听语音。今天天气不错，适合出去走走。';

    updatePreviewUI(true);
    previewStatus.textContent = '加载中...';

    try {
      previewAbort = new AbortController();
      const resp = await fetch(`${CONSTANTS.REMOTE_TTS_ENDPOINT}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId, speed }),
        signal: previewAbort.signal,
      });

      if (!resp.ok) {
        throw new Error('server');
      }

      const audioData = await resp.arrayBuffer();
      const blob = new Blob([audioData], { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);

      previewAudio = new Audio(blobUrl);
      previewAudio.onended = () => {
        URL.revokeObjectURL(blobUrl);
        previewAudio = null;
        updatePreviewUI(false);
      };
      previewAudio.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        previewAudio = null;
        updatePreviewUI(false);
        previewStatus.textContent = '播放失败';
      };

      previewStatus.textContent = '播放中...';
      await previewAudio.play();
    } catch (e) {
      if (e.name === 'AbortError') return;
      previewAudio = null;
      updatePreviewUI(false);
      previewStatus.textContent = '试听失败';
    }

    // 15s 超时自动停止
    setTimeout(() => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio = null;
        updatePreviewUI(false);
      }
    }, 15000);
  }

  function updatePreviewUI(playing) {
    previewBtn.textContent = playing ? '停止' : '试听';
    previewBtn.classList.toggle('playing', playing);
    previewStatus.textContent = playing ? '播放中...' : '';
  }

  // 事件绑定
  voiceSelect.addEventListener('change', saveSettings);
  speedSlider.addEventListener('input', () => {
    speedValue.textContent = speedSlider.value + 'x';
  });
  speedSlider.addEventListener('change', saveSettings);
  previewBtn.addEventListener('click', startPreview);

  // 页面加载
  initVoiceList();
  loadSettings();
})();
