// UIController — 连接状态机、选中检测、浮动按钮和 TTS 合成
const UIController = {
  _currentState: STATE.IDLE,
  _selectedText: '',
  _errorCode: null,
  _currentSettings: null,

  init() {
    FloatingButton.create();
    TTSSynthesizer.init();

    // 加载设置
    this._loadSettings();

    // 鼠标抬起时检测选中
    document.addEventListener('mouseup', () => {
      setTimeout(() => this._onSelection(), 50);
    });

    // 点击按钮
    FloatingButton.getButton().addEventListener('click', (e) => {
      e.stopPropagation();
      this._onButtonClick();
    });

    // 点击关闭按钮
    FloatingButton.getCloseButton().addEventListener('click', (e) => {
      e.stopPropagation();
      this._onStop();
    });

    // 点击页面其他位置关闭按钮（仅 ready 和 error 状态）
    document.addEventListener('mousedown', (e) => {
      const host = FloatingButton.getHost();
      if (host && !host.contains(e.target)) {
        if (this._currentState === STATE.READY || this._currentState === STATE.ERROR) {
          this._transition('clickClose');
        }
      }
    });
  },

  _loadSettings() {
    chrome.runtime.sendMessage({ type: MSG.POPUP_GET_SETTINGS }, (res) => {
      this._currentSettings = { voiceId: CONSTANTS.DEFAULT_VOICE_ID, speed: CONSTANTS.DEFAULT_SPEED };
      if (res) this._currentSettings = res;
    });
  },

  _fetchSettings() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: MSG.POPUP_GET_SETTINGS }, (res) => {
        resolve(res || { voiceId: CONSTANTS.DEFAULT_VOICE_ID, speed: CONSTANTS.DEFAULT_SPEED });
      });
    });
  },

  _onSelection() {
    const sel = SelectionDetector.getSelection();
    if (!sel) {
      if (this._currentState === STATE.READY) {
        this._transition('deselectText');
      }
      return;
    }

    // 校验文本长度
    const validation = SelectionDetector.validateText(sel.text);
    if (validation === 'empty') return;
    if (validation === 'too_long') {
      this._selectedText = sel.text;
      FloatingButton.position(sel.rect);
      this._setState(STATE.ERROR, 'text_too_long');
      return;
    }

    if (!SelectionDetector.hasChanged(sel.text)) return;

    this._selectedText = sel.text;
    FloatingButton.position(sel.rect);
    this._transition('selectText');
  },

  _onButtonClick() {
    switch (this._currentState) {
    case STATE.READY:
    case STATE.ERROR:
      this._transition('clickPlay');
      this._startSynthesis();
      break;
    case STATE.PLAYING:
      this._transition('clickPause');
      TTSSynthesizer.pause();
      break;
    case STATE.PAUSED:
      this._transition('clickResume');
      TTSSynthesizer.resume();
      break;
    }
  },

  _onStop() {
    if (this._currentState === STATE.PLAYING || this._currentState === STATE.PAUSED || this._currentState === STATE.ERROR) {
      TTSSynthesizer.stop();
      this._transition('clickClose');
    }
  },

  async _startSynthesis() {
    const settings = await this._fetchSettings();
    TTSSynthesizer._onAudioEnd = () => {
      this._transition('audioEnd');
    };
    try {
      const result = await TTSSynthesizer.speak(this._selectedText, settings.voiceId, settings.speed);
      if (result === 'playing') {
        this._transition('audioStart');
      }
    } catch (e) {
      console.error('[tts] Synthesis failed:', e.message);
      const errorCode = this._mapError(e.message);
      this._errorCode = errorCode;
      this._transition('error');
    }
  },

  _mapError(msg) {
    if (msg.includes('timeout')) return 'timeout';
    if (msg.includes('连接')) return 'network';
    if (msg.includes('not_supported')) return 'not_supported';
    return 'server';
  },

  _transition(event) {
    const next = transition(this._currentState, event);
    if (!next) return;
    this._currentState = next;
    this._setState(next, this._errorCode);
    if (next === STATE.IDLE) this._errorCode = null;
  },

  _setState(state, errorCode) {
    FloatingButton.setState(state, errorCode);
  }
};
