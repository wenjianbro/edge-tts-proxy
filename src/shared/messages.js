// 消息类型常量 — 所有跨组件通信使用这些常量
const MSG = {
  // Content Script → Service Worker
  SPEAK_REQUEST: 'tts:speak',
  PAUSE_REQUEST: 'tts:pause',
  RESUME_REQUEST: 'tts:resume',
  STOP_REQUEST: 'tts:stop',

  // Service Worker → Content Script
  STATE_CHANGE: 'tts:stateChange',

  // Service Worker ↔ Offscreen Document
  OFFS_INIT_WS: 'offs:initWS',
  OFFS_PLAY: 'offs:play',
  OFFS_PAUSE: 'offs:pause',
  OFFS_RESUME: 'offs:resume',
  OFFS_STOP: 'offs:stop',

  // Offscreen Document → Service Worker
  OFFS_STATE: 'offs:state',
  OFFS_AUDIO_READY: 'offs:audioReady',

  // Popup → Service Worker
  POPUP_GET_VOICES: 'popup:getVoices',
  POPUP_SAVE_SETTINGS: 'popup:saveSettings',
  POPUP_GET_SETTINGS: 'popup:getSettings'
};
