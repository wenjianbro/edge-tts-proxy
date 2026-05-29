// Content Script 入口
(function() {
  // 跳过受限页面
  if (!location.protocol.startsWith('http')) return;

  // 等待 DOM 就绪
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UIController.init());
  } else {
    UIController.init();
  }
})();
