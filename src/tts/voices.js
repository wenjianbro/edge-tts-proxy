// 音色列表 — Edge TTS 中文神经网络语音
const VOICES = [
  { id: 'zh-CN-XiaoxiaoNeural',  name: '晓晓', gender: 'female', style: '活泼', recommend: true },
  { id: 'zh-CN-YunxiNeural',     name: '云希', gender: 'male',   style: '明亮', recommend: true },
  { id: 'zh-CN-XiaoyiNeural',    name: '晓依', gender: 'female', style: '轻快', recommend: false },
  { id: 'zh-CN-YunjianNeural',   name: '云健', gender: 'male',   style: '自然', recommend: false },
  { id: 'zh-CN-YunyangNeural',   name: '云扬', gender: 'male',   style: '专业', recommend: false },
  { id: 'zh-CN-XiaoxuanNeural',  name: '晓萱', gender: 'female', style: '优雅', recommend: false }
];

function getVoiceById(id) {
  return VOICES.find(v => v.id === id) || VOICES.find(v => v.recommend);
}

function getDefaultVoice() {
  return VOICES.find(v => v.recommend);
}
