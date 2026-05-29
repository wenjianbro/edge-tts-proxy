// SelectionDetector — 检测用户文本选中，校验有效性
const SelectionDetector = {
  _lastText: '',

  // 获取当前有效选中文本；无效时返回 null
  getSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return null;

    const text = sel.toString().trim();
    if (text.length < CONSTANTS.TEXT_MIN_LENGTH) return null;

    // 跳过 chrome:// 等受限页面
    if (!location.protocol.startsWith('http')) return null;

    return {
      text: text,
      rect: sel.getRangeAt(0).getBoundingClientRect(),
      range: sel.getRangeAt(0)
    };
  },

  // 校验文本长度
  validateText(text) {
    if (!text || text.trim().length < CONSTANTS.TEXT_MIN_LENGTH) return 'empty';
    if (text.length > CONSTANTS.TEXT_MAX_LENGTH) return 'too_long';
    return 'valid';
  },

  // 检测选中是否变化
  hasChanged(text) {
    if (text === this._lastText) return false;
    this._lastText = text;
    return true;
  }
};
