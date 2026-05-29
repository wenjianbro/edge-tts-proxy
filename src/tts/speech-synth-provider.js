// SpeechSynthesisProvider — 浏览器内置 TTS 降级方案
class SpeechSynthesisProvider extends TTSProvider {
  constructor() {
    super();
    this._utterance = null;
  }

  synthesize(text, voiceId, speed) {
    return new Promise((resolve, reject) => {
      if (typeof speechSynthesis === 'undefined') {
        reject(new Error('not_supported'));
        return;
      }

      const voices = speechSynthesis.getVoices();
      if (!voices.length) {
        reject(new Error('not_supported'));
        return;
      }

      // 优先匹配 voiceId 对应的语音
      const voiceDef = VOICES.find(v => v.id === voiceId);
      const targetGender = voiceDef ? voiceDef.gender : 'female';

      // 1. 精确匹配: 语音名包含 voiceId 的关键部分
      const voiceNamePart = voiceId.split('-').pop().replace('Neural', '');
      let zhVoice = voices.find(v =>
        v.lang.startsWith('zh') && v.name.includes(voiceNamePart)
      );

      // 2. 性别匹配: 找中文语音中匹配性别的
      if (!zhVoice && targetGender) {
        zhVoice = voices.find(v =>
          v.lang.startsWith('zh') && v.name.toLowerCase().includes(targetGender)
        );
      }

      // 3. 回退: 任意中文语音
      if (!zhVoice) {
        zhVoice = voices.find(v => v.lang.startsWith('zh'));
      }

      // 4. 最终回退
      if (!zhVoice) {
        zhVoice = voices[0];
      }

      if (!zhVoice) {
        reject(new Error('not_supported'));
        return;
      }

      this._utterance = new SpeechSynthesisUtterance(text);
      this._utterance.voice = zhVoice;
      this._utterance.rate = speed;
      this._utterance.lang = 'zh-CN';

      // SpeechSynthesis 不产生可捕获的音频数据
      // 返回空 chunks，播放由浏览器直接处理
      this._utterance.onend = () => {
        resolve({ audioChunks: [], contentType: 'internal/speech-synthesis', utterance: this._utterance });
      };

      this._utterance.onerror = (e) => {
        reject(new Error('speech_synthesis_error: ' + e.error));
      };

      speechSynthesis.speak(this._utterance);
    });
  }

  cancel() {
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
    this._utterance = null;
  }

  // 检查 SpeechSynthesis 是否可用
  static isAvailable() {
    return typeof speechSynthesis !== 'undefined';
  }
}
