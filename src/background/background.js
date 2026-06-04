// Service Worker — 设置管理
importScripts(
  '../shared/constants.js',
  '../shared/messages.js'
);

const DEFAULT_SETTINGS = {
  voiceId: CONSTANTS.DEFAULT_VOICE_ID,
  speed: CONSTANTS.DEFAULT_SPEED
};

let currentSettings = { ...DEFAULT_SETTINGS };

// 初始化：加载设置
chrome.storage.sync.get(['voiceId', 'speed'], (items) => {
  if (items.voiceId) currentSettings.voiceId = items.voiceId;
  if (items.speed) currentSettings.speed = items.speed;
});

// 消息路由
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {

  // Popup → 保存设置
  case MSG.POPUP_SAVE_SETTINGS:
    if (msg.voiceId) currentSettings.voiceId = msg.voiceId;
    if (msg.speed) currentSettings.speed = msg.speed;
    chrome.storage.sync.set({ voiceId: currentSettings.voiceId, speed: currentSettings.speed });
    break;

  // Content Script → 获取当前设置
  case MSG.POPUP_GET_SETTINGS:
    sendResponse({ voiceId: currentSettings.voiceId, speed: currentSettings.speed });
    return true; // 保持消息通道打开以异步响应
  }
});
