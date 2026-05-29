// 状态机 — 纯函数，无副作用
// idle → ready → loading → playing ⇄ paused
//                  ↓
//                error → idle

const STATE = {
  IDLE: 'idle',
  READY: 'ready',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  ERROR: 'error'
};

const VALID_TRANSITIONS = {
  [STATE.IDLE]:    [STATE.READY],
  [STATE.READY]:   [STATE.IDLE, STATE.LOADING],
  [STATE.LOADING]: [STATE.PLAYING, STATE.ERROR],
  [STATE.PLAYING]: [STATE.PAUSED, STATE.IDLE, STATE.ERROR],
  [STATE.PAUSED]:  [STATE.PLAYING, STATE.IDLE, STATE.ERROR],
  [STATE.ERROR]:   [STATE.READY, STATE.IDLE]
};

function canTransition(from, to) {
  return VALID_TRANSITIONS[from] && VALID_TRANSITIONS[from].includes(to);
}

function transition(currentState, event) {
  const map = {
    selectText:    { from: [STATE.IDLE, STATE.READY, STATE.ERROR], to: STATE.READY },
    deselectText:  { from: [STATE.READY], to: STATE.IDLE },
    clickPlay:     { from: [STATE.READY, STATE.ERROR], to: STATE.LOADING },
    audioStart:    { from: [STATE.LOADING], to: STATE.PLAYING },
    clickPause:    { from: [STATE.PLAYING], to: STATE.PAUSED },
    clickResume:   { from: [STATE.PAUSED], to: STATE.PLAYING },
    audioEnd:      { from: [STATE.PLAYING, STATE.PAUSED], to: STATE.IDLE },
    error:         { from: [STATE.LOADING, STATE.PLAYING, STATE.PAUSED], to: STATE.ERROR },
    clickClose:    { from: [STATE.ERROR, STATE.READY, STATE.PLAYING, STATE.PAUSED], to: STATE.IDLE },
    clickRetry:    { from: [STATE.ERROR], to: STATE.LOADING }
  };

  const rule = map[event];
  if (!rule) return null;
  if (!rule.from.includes(currentState)) return null;
  return rule.to;
}
