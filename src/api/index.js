import { mockChat, mockListSkills, mockUploadSkill } from './mock.js'

const BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const FORCE_MOCK = import.meta.env.VITE_USE_MOCK === '1'

// 仅 VITE_USE_MOCK=1 时强制 mock；否则走真实后端（BASE 为空时经 vite 代理到 8000）。
const useMock = () => FORCE_MOCK

// 仅当后端“连不上”（网络层失败）时本会话回退 mock；后端单次业务报错不锁定，下次仍重试。
let chatBackendDown = false

// fetch 在网络不可达/连接被拒时抛 TypeError；HTTP 4xx/5xx 不会 reject。
// 据此区分“后端没起来”与“后端跑起来了但这次报错”。
function isNetworkError(e) {
  return e instanceof TypeError
}

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
    chatBackendDown = false // 后端可用，解除可能的回退状态
    return unwrapFlask(data, 'reply')
  } catch (e) {
    console.warn('[api] /api/chat 失败，回退到 mock：', e.message)
    if (isNetworkError(e)) chatBackendDown = true // 仅“连不上”才本会话锁定
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
    chatBackendDown = false // 后端有响应，解除可能的回退状态

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
    if (isNetworkError(e)) chatBackendDown = true // 仅“连不上”才本会话锁定，后端单次报错下次仍重试
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
 * 后端先落盘、清空短期记忆并返回 greeting；长期记忆在后台提炼。
 * @param {{ sessionId: string, chatHistory: Array<{role:string,content:string}> }} payload
 * @returns {Promise<{ code: number, archived?: boolean, greeting?: string }>}
 */
export async function uploadChatHistory({ sessionId, chatHistory }) {
  if (useMock()) return { code: 0, info: 'mock 已归档', archived: true, greeting: '' }
  const data = await postJSON('/api/upload', {
    session_id: sessionId,
    chat_history: chatHistory,
  })
  if (data?.code !== 0) throw new Error(data?.info || '归档失败')
  return data
}

/**
 * 列出当前用户人设。对齐 GET /api/skills?session_id=…
 * 未上传时后端会确保默认 skill/hh（角色层仍用 prompt/character.md）。
 */
export async function listSkills(sessionId) {
  if (useMock()) return mockListSkills()
  if (!sessionId) throw new Error('缺少 session_id')
  const res = await fetch(url(`/api/skills?session_id=${encodeURIComponent(sessionId)}`))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data?.code === 1) throw new Error(data.info || '获取人设失败')
  return Array.isArray(data) ? data : data?.skills || []
}

/**
 * 上传人设 skill.md，写入 skill/{sessionId}/skill.md。
 * @param {{ name?: string, description?: string, content: string, sessionId: string }} skill
 */
export async function uploadSkill(skill) {
  if (useMock()) return mockUploadSkill(skill)
  const data = await postJSON('/api/skills', {
    session_id: skill.sessionId,
    content: skill.content,
    name: skill.name,
    description: skill.description,
  })
  if (data?.code !== 0) throw new Error(data?.info || '上传人设失败')
  return data
}

/**
 * 上传整个文件夹给生产力 agent。对齐 entry/server.py：POST /agent/upload（multipart）。
 * @param {{ files: File[], sessionId: string }} payload
 * @returns {Promise<{ taskname: string, count: number }>} taskname 为文件夹顶层目录名
 */
export async function uploadTaskFolder({ files, sessionId }) {
  const form = new FormData()
  form.append('session_id', sessionId)
  for (const f of files) {
    form.append('files', f, f.name)
    form.append('paths', f.webkitRelativePath || f.name)
  }
  const res = await fetch(url('/agent/upload'), { method: 'POST', body: form })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (data?.code !== 0) throw new Error(data?.info || '上传失败')
  return { taskname: data.taskname, count: data.count }
}

/**
 * 运行生产力 agent。对齐 entry/server.py：POST /agent/simple，body { taskname, query, session_id }。
 * @param {{ taskName: string, query: string, sessionId: string }} payload
 * @returns {Promise<{ result: string }>}
 */
export async function runSimpleAgent({ taskName, query, sessionId }) {
  const data = await postJSON('/agent/simple', {
    taskname: taskName,
    query,
    session_id: sessionId,
  })
  if (data?.code !== 0) throw new Error(data?.info || '任务执行失败')
  return { result: data.info, download: data.download || null }
}

/**
 * 情绪陪伴对话。对齐 entry/server.py：POST /emotion/chat，body { query, session_id }。
 * @param {{ query: string, sessionId: string }} payload
 * @returns {Promise<{ reply: string }>}
 */
export async function sendEmotionChat({ query, sessionId }) {
  const data = await postJSON('/emotion/chat', {
    query,
    session_id: sessionId,
  })
  if (data?.code !== 0) throw new Error(data?.info || '情绪回应失败')
  return { reply: data.info ?? '' }
}

/** 清空生产力 Agent 后端多轮历史 */
export async function clearAgentChat({ sessionId }) {
  if (useMock()) return { code: 0 }
  const data = await postJSON('/agent/clear', { session_id: sessionId })
  if (data?.code !== 0) throw new Error(data?.info || '清空失败')
  return data
}

/** 清空情绪模块后端对话历史（与主聊天隔离） */
export async function clearEmotionChat({ sessionId }) {
  if (useMock()) return { code: 0 }
  const data = await postJSON('/emotion/clear', { session_id: sessionId })
  if (data?.code !== 0) throw new Error(data?.info || '清空失败')
  return data
}

/** 下载 agent 工作区里的文件 */
export function downloadAgentFile({ sessionId, taskName, filename }) {
  const q = new URLSearchParams({
    session_id: sessionId,
    taskname: taskName,
    filename,
  })
  window.open(url(`/agent/download?${q}`), '_blank')
}

export const apiInfo = {
  base: BASE || '(vite proxy → :8000)',
  isMock: useMock,
}
