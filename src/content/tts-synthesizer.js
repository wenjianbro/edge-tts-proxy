// TTSSynthesizer — Content Script TTS 合成 + 音频播放
const TTSSynthesizer = {
  _remoteProvider: null,
  _synthProvider: null,
  _audioManager: null,
  _provider: null, // 'remote' | 'synth'
  _onAudioEnd: null,

  // 流式播放状态
  _streamAudio: null,
  _mediaSource: null,
  _streamAborted: false,

  init() {
    this._remoteProvider = new RemoteTTSProvider();
    this._synthProvider = new SpeechSynthesisProvider();
    this._audioManager = new AudioManager();
  },

  async speak(text, voiceId, speed) {
    this._provider = 'remote';
    console.log('[tts:diag] 开始 Remote TTS 流式合成, text 长度:', text.length);

    try {
      return await this._streamPlay(text, voiceId, speed);
    } catch (e) {
      console.warn('[tts:diag] Remote TTS 失败:', e.message);
      return this._fallbackToSynth(text, voiceId, speed);
    }
  },

  _streamPlay(text, voiceId, speed) {
    return new Promise((resolve, reject) => {
      const mediaSource = new MediaSource();
      const audio = new Audio();
      let sourceBuffer = null;
      const pendingChunks = [];
      let started = false;
      let ended = false;

      this._streamAudio = audio;
      this._mediaSource = mediaSource;
      this._streamAborted = false;

      audio.src = URL.createObjectURL(mediaSource);

      const onSourceOpen = async () => {
        if (this._streamAborted) return;
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

          const feedNext = () => {
            if (this._streamAborted) return;
            if (pendingChunks.length > 0 && !sourceBuffer.updating) {
              try {
                sourceBuffer.appendBuffer(pendingChunks.shift());
              } catch (e) {
                feedNext();
              }
            } else if (ended && pendingChunks.length === 0 && !sourceBuffer.updating && mediaSource.readyState === 'open') {
              try { mediaSource.endOfStream(); } catch (e) { /* ignore */ }
            }
          };

          sourceBuffer.addEventListener('updateend', feedNext);

          await this._remoteProvider.synthesizeStream(
            text, voiceId, speed,
            (chunk) => {
              if (this._streamAborted) return;
              pendingChunks.push(chunk);
              feedNext();
              if (!started) {
                started = true;
                audio.play().catch(reject);
                resolve('playing');
              }
            }
          );

          ended = true;
          feedNext();
        } catch (e) {
          if (!this._streamAborted) {
            this._cleanupStream();
            reject(e);
          }
        }
      };

      if (mediaSource.readyState === 'open') {
        onSourceOpen();
      } else {
        mediaSource.addEventListener('sourceopen', onSourceOpen, { once: true });
      }

      audio.onended = () => {
        if (!this._streamAborted && this._onAudioEnd) this._onAudioEnd();
        this._cleanupStream();
      };

      audio.onerror = () => {
        if (!this._streamAborted) {
          this._cleanupStream();
          reject(new Error('server'));
        }
      };
    });
  },

  _cleanupStream() {
    if (this._streamAudio) {
      this._streamAudio.pause();
      URL.revokeObjectURL(this._streamAudio.src);
      this._streamAudio = null;
    }
    if (this._mediaSource && this._mediaSource.readyState === 'open') {
      try { this._mediaSource.endOfStream(); } catch (e) { /* ignore */ }
    }
    this._mediaSource = null;
  },

  async _fallbackToSynth(text, voiceId, speed) {
    this._provider = 'synth';
    console.log('[tts:diag] 降级到 SpeechSynthesis, voiceId:', voiceId);
    this._synthProvider.synthesize(text, voiceId, speed)
      .then(() => { if (this._onAudioEnd) this._onAudioEnd(); })
      .catch(() => { if (this._onAudioEnd) this._onAudioEnd(); });
    return 'playing';
  },

  pause() {
    if (this._provider === 'remote') {
      if (this._streamAudio) {
        this._streamAudio.pause();
      } else {
        this._audioManager.pause();
      }
    } else if (this._provider === 'synth' && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.pause();
    }
  },

  resume() {
    if (this._provider === 'remote') {
      if (this._streamAudio) {
        this._streamAudio.play();
      } else {
        this._audioManager.resume();
      }
    } else if (this._provider === 'synth' && typeof speechSynthesis !== 'undefined') {
      speechSynthesis.resume();
    }
  },

  stop() {
    this._onAudioEnd = null;
    this._streamAborted = true;
    this._remoteProvider.cancel();
    this._synthProvider.cancel();
    this._cleanupStream();
    this._audioManager.stop();
    this._provider = null;
  }
};
