// sec-ms-gec.js — Edge TTS Sec-MS-GEC v2 令牌生成
//
// 2026-10 微软封禁了 v1 握手（Sec-MS-GEC-Version=1-*），edge-tts 7.3.1 起
// 改用 v2 令牌：`<16hex>-<64hex>`（CS64 摘要 + 定制 SHA256 摘要）。
// 本模块是对 edge_tts/drm.py（7.3.1）generate_sec_ms_gec_v2 的逐行移植，
// 用 BigInt 复刻 Python 的任意精度整数语义，避免 32 位溢出差异。
//
// 参考：https://github.com/rany2/edge-tts/pull/492

export const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
export const SEC_MS_GEC_VERSION = '2-143.0.3650.75';

const U32_MASK = 0xFFFFFFFFn;

// FIPS 180-4 标准 SHA-256 初始向量
const SHA256_INITIAL = [
  0x6A09E667n, 0xBB67AE85n, 0x3C6EF372n, 0xA54FF53An,
  0x510E527Fn, 0x9B05688Cn, 0x1F83D9ABn, 0x5BE0CD19n,
];

// 定制 SHA-256 中间状态（v2 令牌专用）
const SHA256_STATE = [
  0xFD9FBEA2n, 0x91243CE7n, 0xBE499094n, 0xCD2E1E0An,
  0x6C006F49n, 0x04BD35ABn, 0xFEB0A7E4n, 0x03EFFBD2n,
];

const SHA256_SCHEDULE = [
  0xEB24BF9En, 0x1558691Fn, 0xA0C09EE2n, 0x0CFA32BAn,
  0xA622EE8Cn, 0xD1DD9491n, 0xC0DD25A0n, 0xF9E70AB6n,
  0xF0C31573n, 0x7058CE4En, 0x7188E606n, 0x00E5AB33n,
  0xD258B060n, 0x72766564n,
];

// FIPS 180-4 标准 SHA-256 轮常量
const SHA256_ROUND_CONSTANTS = [
  0x428A2F98n, 0x71374491n, 0xB5C0FBCFn, 0xE9B5DBA5n,
  0x3956C25Bn, 0x59F111F1n, 0x923F82A4n, 0xAB1C5ED5n,
  0xD807AA98n, 0x12835B01n, 0x243185BEn, 0x550C7DC3n,
  0x72BE5D74n, 0x80DEB1FEn, 0x9BDC06A7n, 0xC19BF174n,
  0xE49B69C1n, 0xEFBE4786n, 0x0FC19DC6n, 0x240CA1CCn,
  0x2DE92C6Fn, 0x4A7484AAn, 0x5CB0A9DCn, 0x76F988DAn,
  0x983E5152n, 0xA831C66Dn, 0xB00327C8n, 0xBF597FC7n,
  0xC6E00BF3n, 0xD5A79147n, 0x06CA6351n, 0x14292967n,
  0x27B70A85n, 0x2E1B2138n, 0x4D2C6DFCn, 0x53380D13n,
  0x650A7354n, 0x766A0ABBn, 0x81C2C92En, 0x92722C85n,
  0xA2BFE8A1n, 0xA81A664Bn, 0xC24B8B70n, 0xC76C51A3n,
  0xD192E819n, 0xD6990624n, 0xF40E3585n, 0x106AA070n,
  0x19A4C116n, 0x1E376C08n, 0x2748774Cn, 0x34B0BCB5n,
  0x391C0CB3n, 0x4ED8AA4An, 0x5B9CCA4Fn, 0x682E6FF3n,
  0x748F82EEn, 0x78A5636Fn, 0x84C87814n, 0x8CC70208n,
  0x90BEFFFAn, 0xA4506CEBn, 0xBEF9A3F7n, 0xC67178F2n,
];

const SHA256_ADJUSTMENT = 0xC9DC06A7n;
// 轮常量 K[14] 被替换为 SHA256_ADJUSTMENT
const SHA256_BLOCK_CONSTANTS = SHA256_ROUND_CONSTANTS.slice();
SHA256_BLOCK_CONSTANTS[14] = SHA256_ADJUSTMENT;

const SHA256_SIGMA0_ADJUSTMENT = 0x059C0B80n;
const SHA256_SIGMA1_ADJUSTMENT = 0x000B92C0n;

const CS64_COEFFICIENTS = [
  [0xE82E91B1n, 0xB32700D0n],
  [0x44DE24C6n, 0x88DFF51Dn],
  [0x3BEB65BCn, 0x29514038n],
  [0xC89C5933n, 0xB328CBDFn],
  [0x8D1EC211n, 0xD405B4D5n],
  [0x314EF5D5n, 0x26E55F3Cn],
  [0xE92491B1n, 0x607801C6n],
  [0xF0A5B9D5n, 0x82B2C1FBn],
  [0x06064CF3n, 0xFA51A3DAn],
  [0xDA79FA60n, 0x207CC464n],
  [0xBED20560n, 0x3C3C74F3n],
  [0x89F9C9F8n, 0xD2D14B61n],
  [0x35FA38C6n, 0xBB04A2C1n],
  [0xCB49E3C6n, 0xC5626167n],
];

const CS64_FACTOR = 0x82893933n;
const CS64_ADJUSTMENT0 = 0xF2F90B1An;
const CS64_ADJUSTMENT1 = 0x0B1A0000n;

function rol16(value) {
  value &= U32_MASK;
  return ((value << 16n) | (value >> 16n)) & U32_MASK;
}

function rotr(value, n) {
  const bn = BigInt(n);
  return ((value >> bn) | ((value & U32_MASK) << (32n - bn))) & U32_MASK;
}

function sigma0(value) {
  return (
    (value >> 7n) ^ (value << 25n) ^ (value >> 18n) ^ (value << 14n) ^ (value >> 3n)
  ) & U32_MASK;
}

function sigma1(value) {
  return (
    (value >> 17n) ^ (value << 15n) ^ (value >> 19n) ^ (value << 13n) ^ (value >> 10n)
  ) & U32_MASK;
}

function expandSha256Schedule(words, firstWord) {
  for (let index = firstWord; index < 64; index++) {
    const x = words[index - 2];
    const y = words[index - 15];
    const s1 = sigma1(x);
    const s0 = sigma0(y);
    words.push((s1 + words[index - 7] + s0 + words[index - 16]) & U32_MASK);
  }
  return words;
}

// 标准 SHA-256 压缩轮；firstRound=14 时使用替换了 K[14] 的常量表
function sha256Rounds(state, words, firstRound) {
  let a = state[0], b = state[1], c = state[2], d = state[3];
  let e = state[4], f = state[5], g = state[6], h = state[7];
  const constants = firstRound === 14 ? SHA256_BLOCK_CONSTANTS : SHA256_ROUND_CONSTANTS;
  for (let i = firstRound; i < 64; i++) {
    const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
    const ch = g ^ (e & (f ^ g));
    const temp1 = (h + s1 + ch + constants[i] + words[i]) & U32_MASK;
    const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
    const maj = (a & b) | (c & (a | b));
    const temp2 = (s0 + maj) & U32_MASK;
    h = g; g = f; f = e; e = (d + temp1) & U32_MASK;
    d = c; c = b; b = a; a = (temp1 + temp2) & U32_MASK;
  }
  return [a, b, c, d, e, f, g, h];
}

// 由盐的前 7 字节推导定制初始状态
function sha256Init(data7) {
  const words = new Array(14).fill(0n);
  words.push(
    (BigInt(data7[0]) << 16n) | (BigInt(data7[1]) << 8n) | BigInt(data7[2])
  );
  words.push(
    (BigInt(data7[3]) << 24n) |
    (BigInt(data7[4]) << 16n) |
    (BigInt(data7[5]) << 8n) |
    BigInt(data7[6])
  );
  for (let index = 16; index < 30; index++) {
    let value = SHA256_SCHEDULE[index - 16];
    value +=
      index === 16
        ? sigma1(words[index - 2]) ^ SHA256_SIGMA1_ADJUSTMENT
        : sigma1(words[index - 2]);
    if (index - 7 >= 14) value += words[index - 7];
    if (index - 15 >= 14) {
      value +=
        index === 29
          ? sigma0(words[index - 15]) ^ SHA256_SIGMA0_ADJUSTMENT
          : sigma0(words[index - 15]);
    }
    words.push(value & U32_MASK);
  }
  words.push(
    (sigma1(words[28]) +
      words[23] +
      sigma0(words[15]) +
      words[14] +
      SHA256_ADJUSTMENT -
      SHA256_ROUND_CONSTANTS[14]) &
      U32_MASK
  );
  expandSha256Schedule(words, 31);
  const working = sha256Rounds(SHA256_STATE, words, 14);
  const result = [];
  for (let i = 0; i < 8; i++) {
    result.push((SHA256_INITIAL[i] + working[i]) & U32_MASK);
  }
  return result;
}

// 定制 SHA-256 摘要
function sha256Digest(data) {
  const length = 57 + data.length;
  const dataTailLen = data.length - 7;
  const zeros = ((55 - length) % 64 + 64) % 64;
  const padded = new Uint8Array(dataTailLen + 1 + zeros + 8);
  padded.set(data.subarray(7));
  padded[dataTailLen] = 0x80;

  const bitLen = BigInt(length) * 8n;
  const dv = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  dv.setBigUint64(dataTailLen + 1 + zeros, bitLen, false);

  let state = sha256Init(data.subarray(0, 7));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 64; i += 4) {
      let w = BigInt(padded[offset + i]);
      w = (w << 8n) | BigInt(padded[offset + i + 1]);
      w = (w << 8n) | BigInt(padded[offset + i + 2]);
      w = (w << 8n) | BigInt(padded[offset + i + 3]);
      words.push(w);
    }
    expandSha256Schedule(words, 16);
    const working = sha256Rounds(state, words, 0);
    const newState = [];
    for (let i = 0; i < 8; i++) {
      newState.push((state[i] + working[i]) & U32_MASK);
    }
    state = newState;
  }

  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = Number((state[i] >> 24n) & 0xFFn);
    out[i * 4 + 1] = Number((state[i] >> 16n) & 0xFFn);
    out[i * 4 + 2] = Number((state[i] >> 8n) & 0xFFn);
    out[i * 4 + 3] = Number(state[i] & 0xFFn);
  }
  return out;
}

function le32(bytes, offset) {
  return (
    BigInt(bytes[offset]) |
    (BigInt(bytes[offset + 1]) << 8n) |
    (BigInt(bytes[offset + 2]) << 16n) |
    (BigInt(bytes[offset + 3]) << 24n)
  );
}

// 将 data 按小端拆分为 32 位字，零填充到偶数个
function wordsLe4Even(data) {
  const padLen = (4 - (data.length % 4)) % 4;
  const padded = new Uint8Array(data.length + padLen);
  padded.set(data);
  const words = [];
  for (let i = 0; i < padded.length; i += 4) {
    let w = BigInt(padded[i]);
    w |= BigInt(padded[i + 1]) << 8n;
    w |= BigInt(padded[i + 2]) << 16n;
    w |= BigInt(padded[i + 3]) << 24n;
    words.push(w);
  }
  if (words.length % 2) words.push(0n);
  return words;
}

// CS64 摘要，返回 [word0, word1]
function cs64Digest(data, digest) {
  let keyA = le32(digest, 0) | 1n;
  let keyB = le32(digest, 4) | 1n;
  const factors = [
    (keyA * CS64_FACTOR) & U32_MASK,
    (keyB * CS64_FACTOR) & U32_MASK,
  ];

  const terms = [];
  const offsets = [];
  for (let i = 0; i < CS64_COEFFICIENTS.length; i++) {
    terms.push((CS64_COEFFICIENTS[i][0] * factors[i % 2]) & U32_MASK);
    offsets.push(CS64_COEFFICIENTS[i][1]);
  }

  const dataWithZero = new Uint8Array(data.length + 1);
  dataWithZero[0] = 0;
  dataWithZero.set(data, 1);
  const words = wordsLe4Even(dataWithZero);
  for (let index = 0; index < words.length; index++) {
    const word = words[index];
    const even = index % 2 === 0;
    let term = word * (even ? keyA : keyB);
    let offset = rol16(word) * (even ? 0xEF0569FBn : 0xC31713DBn);
    if (index === 0) {
      term += CS64_ADJUSTMENT0 * factors[0];
      offset += CS64_ADJUSTMENT1;
    }
    terms.push(term & U32_MASK);
    offsets.push(offset & U32_MASK);
  }

  let swapAcc = 0n;
  let swapLast = 0n;
  let state = 0n;
  let acc = 0n;
  for (let index = 0; index < terms.length; index += 2) {
    const x = terms[index];
    const y = terms[index + 1];

    let t = rol16((offsets[index] + x) & U32_MASK);
    let q = (t * 0x76F50F34n) & U32_MASK;
    swapAcc = (swapAcc + ((rol16(q) * 0xC3EFEA97n + q) & U32_MASK)) & U32_MASK;

    t = rol16((offsets[index + 1] + y) & U32_MASK);
    q = (t * 0x1881CE3Cn) & U32_MASK;
    swapLast = (rol16(q) * 0x35BD1EC9n + q) & U32_MASK;
    swapAcc = (swapAcc + swapLast) & U32_MASK;

    state = (state * keyA + x) & U32_MASK;
    state = (rol16(state) * 0xCF98B111n) & U32_MASK;
    state = (rol16(state) * 0x87085B9Fn) & U32_MASK;
    state = (rol16(state) * 0x12CEB96Dn) & U32_MASK;
    state = (rol16(state) * 0x257E1D83n) & U32_MASK;
    acc += state;

    let tt = (state * keyB + y) & U32_MASK;
    tt = (rol16(tt) * 0xA27416F5n) & U32_MASK;
    tt = (rol16(tt) * 0xD38396FFn) & U32_MASK;
    state = (rol16((rol16(tt) * 0x7C932B89n) & U32_MASK) * 0xBFA49F69n) & U32_MASK;
    acc = (acc + state) & U32_MASK;
  }

  return [swapLast ^ state, swapAcc ^ acc];
}

function u32LeHex(value) {
  const bytes = [
    value & 0xFFn,
    (value >> 8n) & 0xFFn,
    (value >> 16n) & 0xFFn,
    (value >> 24n) & 0xFFn,
  ];
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function tokenHash(data) {
  const digest = sha256Digest(data);
  const [w0, w1] = cs64Digest(data, digest);
  const cs64Hex = (u32LeHex(w0) + u32LeHex(w1)).toUpperCase();
  const shaHex = Array.from(digest, (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return { cs64Hex, shaHex };
}

const WIN_EPOCH = 11644473600;

// 生成 v2 Sec-MS-GEC 令牌。unixTimestampSeconds 缺省时取当前时间。
export function generateSecMsGecV2(unixTimestampSeconds) {
  let ticks =
    unixTimestampSeconds === undefined || unixTimestampSeconds === null
      ? Date.now() / 1000
      : Number(unixTimestampSeconds);

  ticks += WIN_EPOCH;
  ticks -= ticks % 300;
  ticks = Math.floor(ticks);

  const ticksScaled = BigInt(ticks) * 10000000n;
  const strToHash = ticksScaled.toString() + TRUSTED_CLIENT_TOKEN;
  const data = new TextEncoder().encode(strToHash);
  const { cs64Hex, shaHex } = tokenHash(data);
  return `${cs64Hex}-${shaHex}`;
}

// 与 server.js 旧接口同名，便于替换
export function generateSecMsGec() {
  return generateSecMsGecV2();
}
