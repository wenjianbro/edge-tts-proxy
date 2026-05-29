// EdgeTTSProvider — 通过 WebSocket 连接微软 Edge TTS 服务
class EdgeTTSProvider extends TTSProvider {
  constructor() {
    super();
    this.ws = null;
    this._cancelled = false;
    this._chunks = [];
  }

  static get WSEndpoint() {
    return 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';
  }

  static get TrustedClientToken() {
    return '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
  }

  // 生成 Sec-MS-GEC DRM 令牌 (与 Python edge-tts 库一致: WIN_EPOCH=11644473600)
  static async _generateSecMsGec() {
    const WIN_EPOCH_SEC = 11644473600n;           // seconds from 1601-01-01 to 1970-01-01
    const TICKS_PER_SEC = 10000000n;              // 100-nanosecond intervals per second
    const TICKS_PER_INTERVAL = 3000000000n;       // 300s * 10,000,000 ticks/s

    // Python: (unix_ts + WIN_EPOCH) * 10_000_000, rounded to 300s
    const unixSec = BigInt(Math.floor(Date.now() / 1000));
    const totalTicks = (unixSec + WIN_EPOCH_SEC) * TICKS_PER_SEC;
    const intervalTicks = (totalTicks / TICKS_PER_INTERVAL) * TICKS_PER_INTERVAL;
    const raw = `${intervalTicks}${EdgeTTSProvider.TrustedClientToken}`;

    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }

  static _generateUUID() {
    return crypto.randomUUID().replace(/-/g, '');
  }

  // RFC 2616 date string (matches Python edge-tts date_to_string)
  static _dateToString() {
    const d = new Date();
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n) => String(n).padStart(2, '0');
    return `${days[d.getUTCDay()]} ${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} GMT+0000 (Coordinated Universal Time)`;
  }

  // 构建 SSML
  static _buildSSML(text, voiceId, speed) {
    const ratePercent = Math.round((speed - 1) * 100);
    const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="zh-CN">`
      + `<voice name="${voiceId}">`
      + `<prosody rate="${rateStr}">`
      + text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      + `</prosody></voice></speak>`;
  }

  async synthesize(text, voiceId, speed) {
    this._cancelled = false;
    this._chunks = [];

    const secMsGec = await EdgeTTSProvider._generateSecMsGec();
    const connectionId = EdgeTTSProvider._generateUUID();

    const url = `${EdgeTTSProvider.WSEndpoint}?TrustedClientToken=${EdgeTTSProvider.TrustedClientToken}&ConnectionId=${connectionId}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-143.0.3650.75`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url);
      } catch (e) {
        reject(new Error('WebSocket 连接失败'));
        return;
      }

      this.ws.binaryType = 'arraybuffer';

      const timeout = setTimeout(() => {
        this._cleanup();
        reject(new Error('timeout'));
      }, CONSTANTS.REQUEST_TIMEOUT_MS);

      this.ws.onopen = () => {
        const timestamp = EdgeTTSProvider._dateToString();

        // 发送合成配置 (匹配 Python edge-tts 格式)
        const configMsg = `X-Timestamp:${timestamp}\r\n`
          + 'Content-Type:application/json; charset=utf-8\r\n'
          + 'Path:speech.config\r\n\r\n'
          + '{"context":{"synthesis":{"audio":{"metadataoptions":'
          + '{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},'
          + '"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n';
        this.ws.send(configMsg);

        // 发送 SSML (匹配 Python edge-tts 格式)
        const ssml = EdgeTTSProvider._buildSSML(text, voiceId, speed);
        const requestId = EdgeTTSProvider._generateUUID();
        const ssmlMsg = `X-RequestId:${requestId}\r\n`
          + 'Content-Type:application/ssml+xml\r\n'
          + `X-Timestamp:${timestamp}Z\r\n`
          + 'Path:ssml\r\n\r\n'
          + ssml;
        this.ws.send(ssmlMsg);
      };

      this.ws.onmessage = (event) => {
        if (this._cancelled) return;
        if (typeof event.data === 'string') {
          if (event.data.includes('turn.end')) {
            clearTimeout(timeout);
            this._cleanup();
            resolve({ audioChunks: this._chunks, contentType: 'audio/mpeg' });
          }
          return;
        }
        // 二进制消息格式: "Path:audio\r\nContent-Type:audio/mpeg\r\n\r\n[binary data]"
        const raw = new Uint8Array(event.data);
        const text = new TextDecoder().decode(raw.slice(0, 200));
        const headerEnd = text.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          this._chunks.push(raw.slice(headerEnd + 4));
        } else {
          this._chunks.push(raw);
        }
      };

      this.ws.onerror = (e) => {
        console.error('[tts:ws] onerror fired — connection failed. ReadyState:', this.ws?.readyState);
      };

      this.ws.onclose = (ev) => {
        clearTimeout(timeout);
        console.log('[tts:ws] onclose: code=' + ev.code + ' reason=' + ev.reason + ' wasClean=' + ev.wasClean + ' chunks=' + this._chunks.length);
        if (!this._cancelled && this._chunks.length === 0) {
          reject(new Error('WebSocket 连接被关闭 (code=' + ev.code + ')'));
        }
      };
    });
  }

  cancel() {
    this._cancelled = true;
    this._cleanup();
  }

  _cleanup() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
  }
}
