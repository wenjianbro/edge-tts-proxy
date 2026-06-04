// Edge TTS 代理服务器
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '15555', 10);
const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const WSS_BASE = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
const CHROMIUM_FULL_VERSION = '143.0.3650.75';

const EDGE_HEADERS = {
  'Origin': 'https://www.bing.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0',
  'Pragma': 'no-cache',
  'Cache-Control': 'no-cache',
};

function generateSecMsGec() {
  const WIN_EPOCH_SEC = 11644473600;
  const TICKS_PER_SEC = 10000000;
  const TICKS_PER_INTERVAL = 3000000000;
  const unixSec = Math.floor(Date.now() / 1000);
  const totalTicks = (unixSec + WIN_EPOCH_SEC) * TICKS_PER_SEC;
  const intervalTicks = Math.floor(totalTicks / TICKS_PER_INTERVAL) * TICKS_PER_INTERVAL;
  return createHash('sha256').update(`${intervalTicks}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase();
}

function dateToString() {
  const d = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildSSML(text, voiceId, speed) {
  const ratePercent = Math.round((speed - 1) * 100);
  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN"><voice name="${voiceId}"><prosody rate="${rateStr}">${escapeXml(text)}</prosody></voice></speak>`;
}

function extractAudio(data) {
  const raw = new Uint8Array(data);
  const headerLen = (raw[0] << 8) | raw[1];
  const audioStart = 2 + headerLen;
  return audioStart < raw.length ? raw.slice(audioStart) : null;
}

// ---- 全量合成（popup 试听用） ----
function synthesize(text, voiceId, speed) {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGec();
    const connectionId = randomUUID().replace(/-/g, '');
    const params = new URLSearchParams({
      TrustedClientToken: TRUSTED_CLIENT_TOKEN,
      ConnectionId: connectionId,
      'Sec-MS-GEC': secMsGec,
      'Sec-MS-GEC-Version': `1-${CHROMIUM_FULL_VERSION}`,
    });

    const ws = new WebSocket(`${WSS_BASE}?${params.toString()}`, { headers: EDGE_HEADERS });
    const chunks = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; ws.close(); reject(new Error('timeout')); }
    }, 15000);

    ws.on('open', () => {
      const ts = dateToString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}})}\r\n`);
      const ssml = buildSSML(text, voiceId, speed);
      const rid = randomUUID().replace(/-/g, '');
      ws.send(`X-RequestId:${rid}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (resolved) return;
      if (!isBinary) {
        if (data.toString().includes('turn.end')) {
          clearTimeout(timeout); resolved = true; ws.close();
          console.log(`[proxy] done: ${chunks.length} chunks, ${chunks.reduce((s,c) => s + c.length, 0)} bytes`);
          resolve(chunks);
        }
        return;
      }
      const audio = extractAudio(data);
      if (audio) chunks.push(audio);
    });

    ws.on('error', (err) => {
      if (!resolved) { clearTimeout(timeout); resolved = true; reject(new Error(`handshake:${err.message}`)); }
    });

    ws.on('close', (code) => {
      if (!resolved) {
        clearTimeout(timeout); resolved = true;
        if (chunks.length > 0) { resolve(chunks); } else { reject(new Error(`closed:${code}`)); }
      }
    });
  });
}

// ---- 流式合成（content script 朗读用） ----
function synthesizeStream(text, voiceId, speed, onChunk) {
  return new Promise((resolve, reject) => {
    const secMsGec = generateSecMsGec();
    const connectionId = randomUUID().replace(/-/g, '');
    const params = new URLSearchParams({
      TrustedClientToken: TRUSTED_CLIENT_TOKEN,
      ConnectionId: connectionId,
      'Sec-MS-GEC': secMsGec,
      'Sec-MS-GEC-Version': `1-${CHROMIUM_FULL_VERSION}`,
    });

    const ws = new WebSocket(`${WSS_BASE}?${params.toString()}`, { headers: EDGE_HEADERS });
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) { resolved = true; ws.close(); reject(new Error('timeout')); }
    }, 15000);

    ws.on('open', () => {
      const ts = dateToString();
      ws.send(`X-Timestamp:${ts}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify({context:{synthesis:{audio:{metadataoptions:{sentenceBoundaryEnabled:"false",wordBoundaryEnabled:"false"},outputFormat:"audio-24khz-48kbitrate-mono-mp3"}}}})}\r\n`);
      const ssml = buildSSML(text, voiceId, speed);
      const rid = randomUUID().replace(/-/g, '');
      ws.send(`X-RequestId:${rid}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${ts}Z\r\nPath:ssml\r\n\r\n${ssml}`);
    });

    ws.on('message', (data, isBinary) => {
      if (resolved) return;
      if (!isBinary) {
        if (data.toString().includes('turn.end')) {
          clearTimeout(timeout); resolved = true; ws.close();
          console.log('[proxy:stream] done');
          resolve();
        }
        return;
      }
      const audio = extractAudio(data);
      if (audio) onChunk(audio);
    });

    ws.on('error', (err) => {
      if (!resolved) { clearTimeout(timeout); resolved = true; reject(new Error(`handshake:${err.message}`)); }
    });

    ws.on('close', (code) => {
      if (!resolved) {
        clearTimeout(timeout); resolved = true; resolve(); // 已推送的 chunk 有效，优雅关闭
      }
    });
  });
}

// ---- HTTP Server ----
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200); res.end('OK'); return; }

  // ---- 全量合成 ----
  if (req.method === 'POST' && req.url === '/synthesize') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { text, voiceId, speed } = JSON.parse(body);
        if (!text?.length) { res.writeHead(400); res.end(JSON.stringify({error:'Missing text'})); return; }
        if (text.length > 5000) { res.writeHead(400); res.end(JSON.stringify({error:'Too long'})); return; }

        const chunks = await synthesize(text, voiceId || 'zh-CN-XiaoxiaoNeural', speed || 1.0);
        const totalLen = chunks.reduce((s, c) => s + c.length, 0);
        const audio = Buffer.alloc(totalLen);
        let offset = 0;
        for (const chunk of chunks) { audio.set(chunk, offset); offset += chunk.length; }

        res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
        res.end(audio);
      } catch (e) {
        console.error('[proxy] synthesize error:', e.message);
        if (!res.headersSent) {
          res.writeHead(500); res.end(JSON.stringify({error:e.message}));
        } else {
          res.end();
        }
      }
    });
    return;
  }

  // ---- 流式合成 ----
  if (req.method === 'POST' && req.url === '/synthesize-stream') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const { text, voiceId, speed } = JSON.parse(body);
        if (!text?.length) { res.writeHead(400); res.end(JSON.stringify({error:'Missing text'})); return; }
        if (text.length > 5000) { res.writeHead(400); res.end(JSON.stringify({error:'Too long'})); return; }

        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff',
        });

        let chunkCount = 0;
        await synthesizeStream(
          text,
          voiceId || 'zh-CN-XiaoxiaoNeural',
          speed || 1.0,
          (chunk) => {
            const lenBuf = Buffer.alloc(4);
            lenBuf.writeUInt32BE(chunk.length, 0);
            res.write(lenBuf);
            res.write(Buffer.from(chunk));
            chunkCount++;
          }
        );

        console.log(`[proxy:stream] sent ${chunkCount} chunks`);
        res.end();
      } catch (e) {
        console.error('[proxy] stream error:', e.message);
        if (!res.headersSent) {
          res.writeHead(500); res.end(JSON.stringify({error:e.message}));
        } else {
          res.end();
        }
      }
    });
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({error:'Not found'}));
});

server.listen(PORT, () => console.log(`TTS proxy running on port ${PORT}`));
