// RemoteTTSProvider — 通过代理服务器调用 Edge TTS
class RemoteTTSProvider extends TTSProvider {
  constructor(endpoint) {
    super();
    this._endpoint = endpoint || CONSTANTS.REMOTE_TTS_ENDPOINT;
    this._abortController = null;
  }

  setEndpoint(url) {
    this._endpoint = url;
  }

  async synthesize(text, voiceId, speed) {
    this._abortController = new AbortController();

    const resp = await fetch(`${this._endpoint}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId, speed }),
      signal: this._abortController.signal,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(err.error || 'remote synthesis failed');
    }

    const audioBuffer = await resp.arrayBuffer();
    return {
      audioChunks: [new Uint8Array(audioBuffer)],
      contentType: resp.headers.get('Content-Type') || 'audio/mpeg',
    };
  }

  // 流式合成：每收到一个音频分片就调用 onChunk(chunk)
  async synthesizeStream(text, voiceId, speed, onChunk) {
    this._abortController = new AbortController();

    const resp = await fetch(`${this._endpoint}/synthesize-stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceId, speed }),
      signal: this._abortController.signal,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
      throw new Error(err.error || 'stream synthesis failed');
    }

    const reader = resp.body.getReader();
    let buffer = new Uint8Array(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const newBuf = new Uint8Array(buffer.length + value.length);
        newBuf.set(buffer, 0);
        newBuf.set(value, buffer.length);
        buffer = newBuf;

        while (buffer.length >= 4) {
          const chunkLen = (buffer[0] << 24) | (buffer[1] << 16) | (buffer[2] << 8) | buffer[3];
          if (buffer.length < 4 + chunkLen) break;
          onChunk(buffer.slice(4, 4 + chunkLen));
          buffer = buffer.slice(4 + chunkLen);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  cancel() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
  }
}
