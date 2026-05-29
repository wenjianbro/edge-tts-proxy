// FloatingButton — 炭灰极简风格 (Shadow DOM 隔离)
const FloatingButton = {
  _host: null,
  _root: null,
  _wrapper: null,
  _button: null,
  _closeBtn: null,
  _label: null,
  _state: STATE.IDLE,
  _errorMsg: '',

  SVG_PLAY: '<svg viewBox="0 0 16 16" width="14" height="14" fill="white"><polygon points="4,2 4,14 13,8"/></svg>',
  SVG_PAUSE: '<svg viewBox="0 0 16 16" width="14" height="14" fill="white"><rect x="3" y="2" width="4" height="12" rx="0.8"/><rect x="9" y="2" width="4" height="12" rx="0.8"/></svg>',
  SVG_RETRY: '<svg viewBox="0 0 16 16" width="14" height="14" fill="white"><path d="M8 3a5 5 0 104.5 3h-1.3A3.7 3.7 0 118 4.3V6l2.5-2L8 2v1z"/></svg>',
  SVG_SPEAK: '<svg viewBox="0 0 16 16" width="14" height="14" fill="white"><path d="M2 6v4h2.5l3 3V3L4.5 6H2zm8.5 2.5a2.5 2.5 0 00-1.5-2.3v4.6a2.5 2.5 0 001.5-2.3z"/></svg>',
  SVG_CLOSE: '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="white" stroke-width="1.8" stroke-linecap="round"/></svg>',

  create() {
    this._host = document.createElement('div');
    this._host.id = 'tts-floating-btn-host';
    this._root = this._host.attachShadow({ mode: 'open' });

    this._root.innerHTML = `
      <style>
        :host { all: initial; position: fixed; z-index: 2147483647; display: none; }
        .wrapper { display: flex; align-items: center; gap: 6px; }
        .btn {
          display: flex; align-items: center; gap: 7px;
          height: 36px; padding: 0 16px; border: none; outline: none;
          background: #2D2D2D; color: white;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 13px; font-weight: 500; cursor: pointer;
          border-radius: 20px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          white-space: nowrap; user-select: none;
          transition: background 0.15s;
        }
        .btn:hover { background: #3D3D3D; }
        .btn:active { background: #1A1A1A; }
        .btn.error { background: #E85D5D; }
        .btn.error:hover { background: #D14A4A; }
        .btn.loading { cursor: wait; opacity: 0.9; }
        .close-btn {
          display: none; align-items: center; justify-content: center;
          width: 24px; height: 24px; border: none; outline: none; cursor: pointer;
          background: #2D2D2D; border-radius: 50%;
          box-shadow: 0 4px 16px rgba(0,0,0,0.18);
          transition: background 0.15s;
        }
        .close-btn:hover { background: #E85D5D; }
        .close-btn.visible { display: flex; }
        .spinner {
          width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.25);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
      <div class="wrapper">
        <button class="btn" title="朗读">
          ${FloatingButton.SVG_SPEAK}
          <span class="label"></span>
        </button>
        <button class="close-btn" title="停止">${FloatingButton.SVG_CLOSE}</button>
      </div>
    `;

    this._wrapper = this._root.querySelector('.wrapper');
    this._button = this._root.querySelector('.btn');
    this._closeBtn = this._root.querySelector('.close-btn');
    this._label = this._root.querySelector('.label');
    document.body.appendChild(this._host);
  },

  position(rect) {
    if (!this._host) return;
    const btnWidth = 130;
    const btnHeight = 40;
    const gap = 8;

    let left = rect.right + gap;
    let top = rect.bottom + gap;

    if (left + btnWidth > window.innerWidth) {
      left = rect.left - btnWidth - gap;
    }
    if (left < 0) left = gap;

    if (top + btnHeight > window.innerHeight) {
      top = rect.top - btnHeight - gap;
    }
    if (top < 0) top = gap;

    this._host.style.left = left + 'px';
    this._host.style.top = top + 'px';
  },

  show() {
    if (this._host) this._host.style.display = 'block';
  },

  hide() {
    if (this._host) this._host.style.display = 'none';
  },

  setState(state, errorCode) {
    this._state = state;
    const btn = this._button;
    if (!btn) return;

    btn.className = 'btn';
    btn.disabled = false;
    this._closeBtn.classList.remove('visible');

    switch (state) {
    case STATE.READY:
      btn.innerHTML = FloatingButton.SVG_SPEAK + '<span class="label">朗读</span>';
      btn.title = '朗读';
      this.show();
      break;

    case STATE.LOADING:
      btn.innerHTML = '<span class="spinner"></span><span class="label">连接中...</span>';
      btn.classList.add('loading');
      btn.title = '';
      this.show();
      break;

    case STATE.PLAYING:
      btn.innerHTML = FloatingButton.SVG_PAUSE + '<span class="label">暂停</span>';
      btn.title = '暂停';
      this._closeBtn.classList.add('visible');
      this.show();
      break;

    case STATE.PAUSED:
      btn.innerHTML = FloatingButton.SVG_PLAY + '<span class="label">继续</span>';
      btn.title = '继续';
      this._closeBtn.classList.add('visible');
      this.show();
      break;

    case STATE.ERROR:
      btn.classList.add('error');
      btn.innerHTML = FloatingButton.SVG_RETRY;
      btn.title = '重试';
      switch (errorCode) {
      case 'network':        this._errorMsg = '网络连接失败，请检查网络后重试'; break;
      case 'timeout':        this._errorMsg = '请求超时，请重试'; break;
      case 'server':         this._errorMsg = '语音服务暂不可用，请稍后重试'; break;
      case 'text_too_long':  this._errorMsg = '文本过长，请减少选中内容'; break;
      case 'not_supported':  this._errorMsg = '浏览器不支持语音播放'; break;
      default:               this._errorMsg = '未知错误';
      }
      btn.innerHTML = FloatingButton.SVG_RETRY + '<span class="label">' + this._errorMsg + '</span>';
      this._closeBtn.classList.add('visible');
      this.show();
      break;

    case STATE.IDLE:
    default:
      this.hide();
      break;
    }
  },

  getButton() { return this._button; },
  getCloseButton() { return this._closeBtn; },
  getHost() { return this._host; },

  destroy() {
    if (this._host) {
      this._host.remove();
      this._host = null;
      this._root = null;
      this._button = null;
    }
  }
};
