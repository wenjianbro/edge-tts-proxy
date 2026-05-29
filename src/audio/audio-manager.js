// AudioManager — 管理 <audio> 播放、暂停、恢复、停止
class AudioManager {
  constructor() {
    this.audio = null;
    this._onEnd = null;
    this._onError = null;
  }

  // blobUrl: string — Blob URL 指向音频数据
  play(blobUrl) {
    this.stop();
    this.audio = new Audio(blobUrl);
    this.audio.onended = () => {
      if (this._onEnd) this._onEnd();
    };
    this.audio.onerror = (e) => {
      if (this._onError) this._onError(e);
    };
    return this.audio.play();
  }

  pause() {
    if (this.audio) this.audio.pause();
  }

  resume() {
    if (this.audio) return this.audio.play();
  }

  stop() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
      this.audio.load();
      this.audio = null;
    }
  }

  get paused() {
    return this.audio ? this.audio.paused : true;
  }

  get currentTime() {
    return this.audio ? this.audio.currentTime : 0;
  }

  onEnd(cb) { this._onEnd = cb; }
  onError(cb) { this._onError = cb; }
}
