<script setup>
import { ref, nextTick, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import MessageBubble from './MessageBubble.vue'
import VoiceCloneModal from './VoiceCloneModal.vue'
import Icon from './Icon.vue'
import { sendChatStream, synthesizeTTS, uploadChatHistory } from '../api/index.js'
import { useVoiceInput, useVoiceOutput } from '../composables/useVoice.js'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
  skillName: { type: String, default: '明日香' },
  active: { type: Boolean, default: true },
})
const emit = defineEmits(['speaking'])

function makeGreeting(name) {
  return `嗨，我是${name || '明日香'}。想聊点什么呀？打字或者点麦克风跟我说话都行。`
}

const messages = ref([{ role: 'assistant', content: makeGreeting('明日香') }])
const input = ref('')
const sending = ref(false)
const archiving = ref(false)
const confirmNew = ref(false)
const toast = ref('')
const listRef = ref(null)
const inputRef = ref(null)
const flyGlyphs = ref([])
const ingestGhost = ref(null)
let toastTimer = null
let flyToken = 0
let flyTimers = []

const FLY_STAGGER_MS = 200
const FLY_DURATION_MS = 520
const FLY_MAX_CHARS = 40

// 当前使用的克隆音色（Data/ 下的 *_voice_id.json 文件名）；null 用后端默认音色
const voice = ref('甜美女声')
const voiceCloned = ref(false)
const showClone = ref(false)

const voiceIn = useVoiceInput()
const voiceOut = useVoiceOutput()

const lastIndex = computed(() => messages.value.length - 1)
const voiceTag = computed(() => {
  if (!voiceCloned.value) return '默认音色'
  const raw = String(voice.value || '')
  const pretty = raw.replace(/_voice_id\.json$/i, '').replace(/\.json$/i, '')
  return pretty || '已克隆'
})

function showToast(msg) {
  toast.value = msg
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 2200)
}

function onCloned(result) {
  if (result?.voice) {
    voice.value = result.voice
    voiceCloned.value = true
  }
  showClone.value = false
}

watch(
  () => voiceOut.speaking.value,
  (v) => emit('speaking', v),
)

watch(
  () => props.skillName,
  (name) => {
    if (hasRealConversation()) return
    const first = messages.value[0]
    if (messages.value.length === 1 && first?.role === 'assistant') {
      first.content = makeGreeting(name)
    }
  },
)

watch(
  () => props.active,
  (on) => {
    if (!on) {
      voiceOut.stop()
      if (voiceIn.listening.value) voiceIn.stop()
      confirmNew.value = false
      abortFly()
    }
  },
)

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function splitGlyphs(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter('zh', { granularity: 'grapheme' }).segment(text)].map((s) => s.segment)
  }
  return Array.from(text)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function abortFly() {
  flyToken += 1
  flyGlyphs.value = []
  ingestGhost.value = null
  for (const t of flyTimers) window.clearTimeout(t)
  flyTimers = []
}

function ingestCaretPoint() {
  const el = listRef.value?.querySelector('[data-user-ingest]')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

function afterFly(ms, fn) {
  const t = window.setTimeout(() => {
    flyTimers = flyTimers.filter((x) => x !== t)
    fn()
  }, ms)
  flyTimers.push(t)
}

async function flyIntoUserBubble(userMsg, full, token) {
  if (!userMsg) return
  if (prefersReducedMotion() || !full) {
    userMsg.content = full
    userMsg.ingesting = false
    return
  }

  const chars = splitGlyphs(full)
  const flyCount = Math.min(chars.length, FLY_MAX_CHARS)
  ingestGhost.value = full
  await nextTick()
  scrollToBottom()
  await nextTick()

  const origin = inputRef.value?.getBoundingClientRect()
  if (!origin) {
    userMsg.content = full
    userMsg.ingesting = false
    ingestGhost.value = null
    return
  }

  const startX = origin.left + Math.min(40, origin.width * 0.22)
  const startY = origin.top + origin.height * 0.5

  for (let i = 0; i < flyCount; i++) {
    if (token !== flyToken) return
    const ch = chars[i]
    const dest = ingestCaretPoint() || { x: startX + 8, y: startY - 88 }
    const dx = dest.x - startX
    const dy = dest.y - startY
    const id = `${token}-${i}`

    ingestGhost.value = chars.slice(i + 1).join('')

    if (ch.trim()) {
      flyGlyphs.value = [
        ...flyGlyphs.value,
        {
          id,
          ch,
          x: startX,
          y: startY,
          dx,
          dy,
          mx: dx * 0.48,
          my: dy * 0.42 - 36,
          duration: FLY_DURATION_MS,
        },
      ]
    }

    afterFly(FLY_DURATION_MS, () => {
      if (token !== flyToken) return
      userMsg.content = chars.slice(0, i + 1).join('')
      flyGlyphs.value = flyGlyphs.value.filter((g) => g.id !== id)
      scrollToBottom()
    })

    if (i < flyCount - 1) await sleep(FLY_STAGGER_MS)
  }

  await sleep(FLY_DURATION_MS)
  if (token !== flyToken) return
  userMsg.content = full
  userMsg.ingesting = false
  ingestGhost.value = null
  flyGlyphs.value = []
}

async function send(text, reuseUser = false) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return
  input.value = ''
  let userMsg = null
  if (!reuseUser) {
    userMsg = { role: 'user', content: '', ingesting: true }
    messages.value.push(userMsg)
    messages.value.push({ role: 'assistant', content: '', pending: true, holdWait: true })
  } else {
    const lastMsg = messages.value[messages.value.length - 1]
    if (lastMsg?.role === 'assistant') {
      lastMsg.content = ''
      lastMsg.pending = true
      lastMsg.holdWait = false
    } else {
      messages.value.push({ role: 'assistant', content: '', pending: true, holdWait: false })
    }
  }
  scrollToBottom()
  sending.value = true
  voiceOut.stop() // 清掉上一条回复可能还在排队/播放的音频
  const last = messages.value[messages.value.length - 1]
  abortFly()
  const token = flyToken
  const ingestP = userMsg
    ? flyIntoUserBubble(userMsg, content, token).then(() => {
        if (last.pending) last.holdWait = false
        scrollToBottom()
      })
    : Promise.resolve()
  try {
    // 流式：每收到一句就即时上屏 + 合成克隆音色入队顺序播放，大幅降低首音延迟
    await sendChatStream({
      text: content,
      sessionId: props.sessionId,
      onSentence: async (sentence) => {
        abortFly()
        if (userMsg) {
          userMsg.content = content
          userMsg.ingesting = false
        }
        last.holdWait = false
        last.content += sentence
        last.pending = false
        scrollToBottom()
        if (!voiceOut.muted.value) {
          const audioUrl = await synthesizeTTS({ text: sentence, voice: voice.value })
          voiceOut.enqueue(audioUrl, sentence)
        }
      },
    })
    if (!last.content) {
      abortFly()
      if (userMsg) {
        userMsg.content = content
        userMsg.ingesting = false
      }
      last.content = '（没有收到回复）'
      last.pending = false
      last.holdWait = false
    }
  } catch (e) {
    abortFly()
    if (userMsg) {
      userMsg.content = content
      userMsg.ingesting = false
    }
    last.content = last.content || '抱歉，刚刚走神了，再说一次好吗？'
    last.pending = false
    last.holdWait = false
  } finally {
    await ingestP
    sending.value = false
    scrollToBottom()
  }
}

// 当前窗口是否有真实对话（用户发过话），只有有内容才值得归档
function hasRealConversation() {
  return messages.value.some((m) => m.role === 'user')
}

// 开新对话：等后端开场白回来再切窗口；长期记忆在后台抽，不挡这一步
async function newConversation() {
  if (archiving.value || sending.value) return
  const hadChat = hasRealConversation()
  let greeting = makeGreeting(props.skillName)
  if (hadChat) {
    archiving.value = true
    confirmNew.value = false
    const history = messages.value
      .filter((m) => !m.pending && m.content)
      .map((m) => ({ role: m.role, content: m.content }))
    try {
      const res = await uploadChatHistory({ sessionId: props.sessionId, chatHistory: history })
      const fromApi = String(res?.greeting || '').trim()
      if (fromApi) greeting = fromApi
    } catch (e) {
      console.warn('[chat] 归档旧对话失败：', e.message)
    } finally {
      archiving.value = false
    }
  }
  voiceOut.stop()
  abortFly()
  if (voiceIn.listening.value) voiceIn.stop()
  messages.value = [{ role: 'assistant', content: greeting }]
  input.value = ''
  confirmNew.value = false
  scrollToBottom()
  if (hadChat) showToast('已开启新对话')
}

function requestNewConversation() {
  if (archiving.value || sending.value) return
  if (hasRealConversation()) {
    confirmNew.value = true
    return
  }
  newConversation()
}

function retryLast() {
  const lastUser = [...messages.value].reverse().find((m) => m.role === 'user')
  if (!lastUser?.content) return
  send(lastUser.content, true)
}

function stopSpeak() {
  voiceOut.stop()
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    showToast('已复制')
  } catch (_) {
    showToast('复制失败')
  }
}

function toggleMic() {
  if (!voiceIn.supported.value) return
  if (voiceIn.listening.value) {
    voiceIn.stop()
  } else {
    voiceOut.stop()
    voiceIn.start((finalText) => {
      if (finalText) send(finalText)
    })
  }
}

function onEnter(e) {
  if (e.isComposing) return
  send()
}

onMounted(scrollToBottom)
onBeforeUnmount(abortFly)
</script>

<template>
  <div class="chat glass">
    <header class="chat-head">
      <div class="title">
        <span class="live" :class="{ on: voiceOut.speaking.value }"></span>
        {{ skillName || '对话' }}
        <span class="voice-tag" :title="voiceCloned ? '当前克隆音色' : '尚未克隆，使用默认音色'">
          <Icon name="headphones" :size="12" />
          {{ voiceTag }}
        </span>
      </div>
      <div class="head-actions">
        <button
          class="icon-btn"
          :title="archiving ? '正在生成新开场…' : '开启新对话（旧对话会自动归档）'"
          :aria-label="archiving ? '正在开启新对话' : '新对话'"
          :disabled="archiving || sending"
          @click="requestNewConversation"
        >
          <Icon :name="archiving ? 'loader' : 'new'" :size="16" />
        </button>
        <button class="icon-btn" title="克隆音色（上传音频）" aria-label="克隆音色" @click="showClone = true">
          <Icon name="mic" :size="16" />
        </button>
        <button
          class="icon-btn"
          :title="voiceOut.muted.value ? '取消静音' : '静音语音播报'"
          :aria-label="voiceOut.muted.value ? '取消静音' : '静音'"
          @click="voiceOut.toggleMute()"
        >
          <Icon :name="voiceOut.muted.value ? 'mute' : 'volume'" :size="16" />
        </button>
      </div>
    </header>

    <VoiceCloneModal
      v-if="showClone"
      :session-id="sessionId"
      @close="showClone = false"
      @cloned="onCloned"
    />

    <div v-if="confirmNew" class="confirm">
      <span>上一轮会记住，确定开新的吗？</span>
      <button type="button" class="ghost" @click="confirmNew = false">取消</button>
      <button type="button" class="ok" :disabled="archiving" @click="newConversation">确定</button>
    </div>

    <div ref="listRef" class="list">
      <MessageBubble
        v-for="(m, i) in messages"
        :key="i"
        :role="m.role"
        :content="m.content"
        :pending="m.pending"
        :hold-wait="m.holdWait"
        :ingesting="m.ingesting"
        :show-copy="!!m.content && !m.pending && !m.ingesting"
        :show-retry="m.role === 'assistant' && i === lastIndex && !m.pending && !!m.content && hasRealConversation() && !sending"
        :show-stop="m.role === 'assistant' && i === lastIndex && voiceOut.speaking.value"
        @copy="copyText(m.content)"
        @retry="retryLast"
        @stop="stopSpeak"
      />
    </div>

    <div v-if="voiceIn.listening.value" class="listening">
      <span class="wave"><i></i><i></i><i></i><i></i><i></i></span>
      正在听… {{ voiceIn.partial.value }}
    </div>

    <div class="composer">
      <button
        class="mic"
        :class="{ active: voiceIn.listening.value, disabled: !voiceIn.supported.value }"
        :title="voiceIn.supported.value ? '按一下开始/结束语音输入' : '当前浏览器不支持语音识别，请用文本输入'"
        :aria-label="voiceIn.listening.value ? '停止语音输入' : '开始语音输入'"
        @click="toggleMic"
      >
        <Icon name="mic" :size="18" />
      </button>
      <div class="composer-field">
        <input
          ref="inputRef"
          v-model="input"
          type="text"
          placeholder="说点什么…（回车发送）"
          :disabled="ingestGhost != null"
          @keydown.enter="onEnter"
        />
        <span v-if="ingestGhost != null" class="ingest-ghost">{{ ingestGhost }}</span>
      </div>
      <button class="send" :disabled="sending || !input.trim()" @click="send()">发送</button>
    </div>

    <div v-if="toast" class="toast">{{ toast }}</div>
  </div>
  <Teleport to="body">
    <div v-if="flyGlyphs.length" class="galatea-glyph-layer" aria-hidden="true">
      <span
        v-for="g in flyGlyphs"
        :key="g.id"
        class="galatea-fly-glyph"
        :style="{
          left: g.x + 'px',
          top: g.y + 'px',
          '--dx': g.dx + 'px',
          '--dy': g.dy + 'px',
          '--mx': g.mx + 'px',
          '--my': g.my + 'px',
          '--dur': g.duration + 'ms',
        }"
      >{{ g.ch }}</span>
    </div>
  </Teleport>
</template>

<style scoped>
.chat {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  height: 100%;
  border-radius: var(--radius);
  overflow: hidden;
}
.chat-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border);
}
.title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 8px;
}
.live {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-faint);
}
.live.on {
  background: #7be0a4;
  box-shadow: 0 0 8px #7be0a4;
}
.voice-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--gold);
  background: rgba(255, 143, 180, 0.12);
  padding: 2px 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  opacity: 0.85;
  color: var(--text-dim);
  display: grid;
  place-items: center;
  transition: background 0.18s, opacity 0.18s, color 0.18s;
}
.icon-btn:hover {
  opacity: 1;
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
}
.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.confirm {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--text-dim);
  background: rgba(255, 143, 180, 0.08);
  border-bottom: 1px solid var(--border);
}
.confirm span {
  flex: 1;
}
.confirm .ghost,
.confirm .ok {
  height: 28px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
}
.confirm .ghost {
  color: var(--text-dim);
  border: 1px solid var(--border);
}
.confirm .ok {
  color: #fff;
  background: var(--accent-grad);
}
.confirm .ok:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 16px 18px;
  overscroll-behavior: contain;
}

.listening {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  font-size: 13px;
  color: var(--accent);
  border-top: 1px solid var(--border);
}
.wave {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}
.wave i {
  width: 3px;
  background: var(--accent);
  border-radius: 2px;
  animation: eq 1s infinite ease-in-out;
}
.wave i:nth-child(1) { height: 6px; animation-delay: 0s; }
.wave i:nth-child(2) { height: 14px; animation-delay: 0.15s; }
.wave i:nth-child(3) { height: 9px; animation-delay: 0.3s; }
.wave i:nth-child(4) { height: 16px; animation-delay: 0.45s; }
.wave i:nth-child(5) { height: 7px; animation-delay: 0.6s; }

.composer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
  background: rgba(0, 0, 0, 0.12);
}
.composer-field {
  flex: 1;
  position: relative;
  min-width: 0;
}
.composer input {
  width: 100%;
  height: var(--control-h);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
}
.composer-field:has(.ingest-ghost) input {
  color: transparent;
  caret-color: transparent;
}
.composer-field:has(.ingest-ghost) input::placeholder {
  color: transparent;
}
.ingest-ghost {
  position: absolute;
  left: 14px;
  right: 14px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  font-size: 14px;
  color: var(--text);
  pointer-events: none;
  overflow: hidden;
  white-space: pre;
}
.composer input:focus {
  border-color: var(--gold);
  box-shadow: 0 0 0 3px rgba(255, 143, 180, 0.14);
}
.mic {
  width: var(--control-h);
  height: var(--control-h);
  border-radius: var(--radius-sm);
  display: grid;
  place-items: center;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  transition: all 0.2s;
}
.mic:hover {
  background: rgba(255, 255, 255, 0.12);
}
.mic.active {
  color: #fff;
  background: var(--accent-grad);
  border-color: transparent;
  animation: pulse 1.2s infinite;
}
.mic.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.send {
  height: var(--control-h);
  padding: 0 18px;
  border-radius: var(--radius-sm);
  background: var(--accent-grad);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 0.04em;
  transition: opacity 0.2s, transform 0.1s;
}
.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.send:not(:disabled):active {
  transform: scale(0.96);
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 6;
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  background: rgba(22, 14, 28, 0.88);
  border: 1px solid var(--border);
  backdrop-filter: blur(12px);
  pointer-events: none;
}

@keyframes eq {
  0%,
  100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}
@keyframes pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(255, 143, 180, 0.5);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(255, 143, 180, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mic.active,
  .wave i {
    animation: none;
  }
}
</style>

<style>
.galatea-glyph-layer {
  position: fixed;
  inset: 0;
  z-index: 55;
  pointer-events: none;
  overflow: hidden;
}
.galatea-fly-glyph {
  position: absolute;
  font-family: 'Noto Serif SC', 'Songti SC', serif;
  font-size: 20px;
  font-weight: 600;
  line-height: 1;
  color: #fff8fb;
  white-space: nowrap;
  text-shadow:
    0 0 10px rgba(255, 143, 180, 0.95),
    0 4px 14px rgba(80, 20, 60, 0.45);
  animation: galateaGlyphFly var(--dur, 520ms) cubic-bezier(0.22, 0.78, 0.28, 1) both;
  will-change: transform, opacity;
}
@keyframes galateaGlyphFly {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.82);
  }
  12% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.16);
  }
  55% {
    opacity: 1;
    transform: translate(calc(-50% + var(--mx)), calc(-50% + var(--my))) scale(1.04);
  }
  88% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.72);
  }
}
@media (prefers-reduced-motion: reduce) {
  .galatea-fly-glyph {
    animation: none;
    opacity: 0;
  }
}
</style>
