// TTSProvider 基类 — 统一接口，方便切换 TTS 后端
class TTSProvider {
  // text: string, voiceId: string, speed: number
  // 返回: Promise<{ audioChunks: Uint8Array[], contentType: string }>
  async synthesize(text, voiceId, speed) {
    throw new Error('Not implemented');
  }

  // 取消当前合成
  cancel() {
    throw new Error('Not implemented');
  }
}
