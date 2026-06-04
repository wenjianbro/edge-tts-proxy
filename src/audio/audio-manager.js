// AudioManager — 轻量 wrapper，仅用于流式播放外的 fallback 场景
class AudioManager {
  constructor() {
    this.audio = null;
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
}
