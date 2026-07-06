import { mockChat, mockListSkills, mockUploadSkill } from './mock.js'

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

// 仅 VITE_USE_MOCK=1 时强制 mock；否则走真实后端（BASE 为空时经 vite 代理到 8000）。
const useMock = () => FORCE_MOCK

// chat 接口失败后本会话内回退 mock（skills 等接口单独处理）。
let chatBackendDown = false

function url(path) {
  // 配置了 BASE 用绝对地址；否则用相对 /api（配合 vite 代理 → Flask :8000）。
  return BASE ? `${BASE}${path}` : path
}

async function postJSON(path, body) {
  const res = await fetch(url(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** 解析 Flask 统一响应：{ code: 0, reply } 成功；{ code: 1, info } 失败 */
function unwrapFlask(data, valueKey = 'reply') {
  if (data?.code === 0) {
    return { reply: data[valueKey] ?? '', audioUrl: data.audioUrl ?? null }
  }
  throw new Error(data?.info || '接口返回错误')
}

/**
 * 发送一条用户消息，返回 { reply, audioUrl }。
 * 对齐 Galatea entry/server.py：POST /api/chat，body { query, id }。
 * @param {{ text: string, sessionId: string }} payload
 */
export async function sendChat({ text, sessionId }) {
  if (useMock() || chatBackendDown) return mockChat(text)
  try {
    const data = await postJSON('/api/chat', {
      query: text,
      id: sessionId,
    })
    return unwrapFlask(data, 'reply')
  } catch (e) {
    console.warn('[api] /api/chat 失败，回退到 mock：', e.message)
    chatBackendDown = true
    return mockChat(text)
  }
}

/**
 * 流式发送一条用户消息（SSE）。后端逐句推送，onSentence 每句回调一次。
 * 对齐 entry/server.py：POST /api/chat/stream，body { query, id }，事件 data:{sentence|done|error}。
 * 返回 { reply }（完整文本）。后端不可用时回退 mock。
 * @param {{ text: string, sessionId: string, onSentence?: (s: string) => any }} payload
 */
export async function sendChatStream({ text, sessionId, onSentence }) {
  if (useMock() || chatBackendDown) {
    const r = await mockChat(text)
    if (r.reply && onSentence) await onSentence(r.reply)
    return { reply: r.reply }
  }
  let full = ''
  try {
    const res = await fetch(url('/api/chat/stream'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: text, id: sessionId }),
    })
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      let idx
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx).trim()
        buf = buf.slice(idx + 2)
        if (!raw.startsWith('data:')) continue
        const evt = JSON.parse(raw.slice(5).trim())
        if (evt.sentence) {
          full += evt.sentence
          if (onSentence) await onSentence(evt.sentence)
        } else if (evt.error) {
          throw new Error(evt.error)
        } else if (evt.done) {
          full = evt.reply ?? full
        }
      }
    }
    return { reply: full }
  } catch (e) {
    console.warn('[api] /api/chat/stream 失败，回退到 mock：', e.message)
    chatBackendDown = true
    const r = await mockChat(text)
    if (r.reply && onSentence) await onSentence(r.reply)
    return { reply: r.reply }
  }
}

/**
 * 上传一段录音做 ASR，返回 { text }。后端不可用时返回 null（由调用方走浏览器识别兜底）。
 */
export async function transcribe(blob, sessionId) {
  if (useMock()) return null
  try {
    const form = new FormData()
    form.append('audio', blob, 'voice.webm')
    form.append('session_id', sessionId)
    const res = await fetch(url('/api/asr'), { method: 'POST', body: form })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] /api/asr 失败，回退浏览器识别：', e.message)
    return null
  }
}

/**
 * 文本转语音（克隆音色）。对齐 Galatea entry/server.py：POST /api/tts。
 * 成功返回可直接播放的 data URL；失败/mock 返回 null（调用方用浏览器 TTS 兜底）。
 */
export async function synthesizeTTS({ text, voice }) {
  if (useMock() || !text) return null
  try {
    const data = await postJSON('/api/tts', { text, voice })
    if (data?.code === 0 && data.audioBase64) {
      return `data:${data.mime || 'audio/wav'};base64,${data.audioBase64}`
    }
    throw new Error(data?.info || 'TTS 返回错误')
  } catch (e) {
    console.warn('[api] /api/tts 失败，回退浏览器朗读：', e.message)
    return null
  }
}

/** 检查 session_id 是否已被占用（后端权威校验） */
export async function checkSessionId(sessionId) {
  if (useMock()) return { code: 0, exists: false }
  const data = await postJSON('/api/auth/check', { session_id: sessionId })
  if (data?.code !== 0) throw new Error(data?.info || '检查失败')
  return data
}

/** 注册新用户 */
export async function registerSession({ sessionId, password }) {
  if (useMock()) return { code: 0, session_id: sessionId }
  const data = await postJSON('/api/auth/register', {
    session_id: sessionId,
    password,
  })
  if (data?.code !== 0) throw new Error(data?.info || '注册失败')
  return data
}

/** 登录 */
export async function loginSession({ sessionId, password }) {
  if (useMock()) return { code: 0, session_id: sessionId }
  const res = await fetch(url('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, password }),
  })
  const data = await res.json()
  if (data?.code !== 0) throw new Error(data?.info || '登录失败')
  return data
}

/**
 * 上传参考音频，克隆音色。对齐 entry/server.py：POST /api/clone（multipart）。
 */
export async function cloneVoice(file, sessionId) {
  if (useMock()) {
    return new Promise((resolve) =>
      setTimeout(() => resolve({ code: 0, voiceId: 'mock', voice: `${sessionId}_voice_id.json`, mock: true }), 600),
    )
  }
  const form = new FormData()
  form.append('audio', file, file.name)
  form.append('session_id', sessionId)
  const res = await fetch(url('/api/clone'), { method: 'POST', body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data?.code !== 0) throw new Error(data?.info || '克隆失败')
  return data
}

/**
 * 归档当前对话窗口（开新对话/退出时调用）。
 * 对齐 entry/server.py：POST /api/upload，body { session_id, chat_history }。
 * 后端会落盘 + 提炼长期记忆 + 清空短期记忆。
 * @param {{ sessionId: string, chatHistory: Array<{role:string,content:string}> }} payload
 */
export async function uploadChatHistory({ sessionId, chatHistory }) {
  if (useMock()) return { code: 0, info: 'mock 已归档', archived: true }
  const data = await postJSON('/api/upload', {
    session_id: sessionId,
    chat_history: chatHistory,
  })
  if (data?.code !== 0) throw new Error(data?.info || '归档失败')
  return data
}

export async function listSkills() {
  if (useMock()) return mockListSkills()
  try {
    const res = await fetch(url('/api/skills'))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  } catch (e) {
    console.warn('[api] /api/skills 失败，回退到 mock：', e.message)
    return mockListSkills()
  }
}

/**
 * 上传一个 skill。skill = { name, description, content, sessionId }
 */
export async function uploadSkill(skill) {
  if (useMock()) return mockUploadSkill(skill)
  try {
    return await postJSON('/api/skills', skill)
  } catch (e) {
    console.warn('[api] 上传 skill 失败，回退到 mock：', e.message)
    return mockUploadSkill(skill)
  }
}

export const apiInfo = {
  base: BASE || '(vite proxy → :8000)',
  isMock: useMock,
}
