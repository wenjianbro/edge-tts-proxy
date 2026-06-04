# Changelog

## v2.0.2 (2026-06-04) — GitHub only，未提交商店

### Bug 修复
- proxy: WebSocket 提前关闭时正确处理（有数据→resolve，无数据→reject）
- proxy: 流式合成提前关闭不再错误触发浏览器降级

### 代码清理
- 删除 `_diagTest()` — 每次页面加载时对 proxy 和 Bing 的无用诊断请求
- 删除 `AudioManager.play()` 等 5 个从未调用的方法
- 删除 `messages.js` 中 11 个死消息常量（offscreen 残留 + 未实现的请求）
- 删除 `POPUP_GET_VOICES` no-op handler
- 删除 `OFFS_TIMEOUT_MS` 未用常量
- Popup footer 版本号修正

### 待下次商店提交
- 以上修复已就绪，攒到有功能改动时一并提交
