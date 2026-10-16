#!/usr/bin/env node
// Edge TTS 代理定时探活脚本
// 真实 POST /synthesize 合成一句，验证返回有效 MP3。
// 连续重试失败后以非零码退出，供 GitHub Actions 判定失败并告警。

const PROXY_URL = process.env.PROXY_URL || 'https://edge-tts-proxy-b7rh.onrender.com';
const MAX_ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 60000; // 单次 60s，覆盖 Render 免费层冷启动（~30s）
const RETRY_DELAY_MS = 20000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probeOnce() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
  try {
    const resp = await fetch(`${PROXY_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '探活测试', voiceId: 'zh-CN-XiaoxiaoNeural', speed: 1.0 }),
      signal: controller.signal,
    });
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const contentType = resp.headers.get('content-type') || '';
    // MP3 判定：非空音频体 + audio/mpeg 头，或 MPEG 帧同步字（0xFF Ex）
    const isMp3 = bytes.length > 100
      && (contentType.includes('audio/mpeg')
        || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0));
    if (resp.status === 200 && isMp3) {
      return { ok: true, detail: `${bytes.length} bytes MP3` };
    }
    const snippet = new TextDecoder().decode(bytes.slice(0, 200));
    return { ok: false, detail: `HTTP ${resp.status}, ${bytes.length}B, body="${snippet}"` };
  } catch (err) {
    return { ok: false, detail: `${err.name}: ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const r = await probeOnce();
    if (r.ok) {
      console.log(`[probe] OK（第 ${i}/${MAX_ATTEMPTS} 次）— ${r.detail}`);
      process.exit(0);
    }
    console.error(`[probe] 第 ${i}/${MAX_ATTEMPTS} 次失败 — ${r.detail}`);
    if (i < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  console.error('[probe] 连续多次失败，判定代理故障');
  process.exit(1);
}

main();
