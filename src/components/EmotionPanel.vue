<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import MessageBubble from './MessageBubble.vue'
import Icon from './Icon.vue'
import { sendEmotionChat, synthesizeTTS, clearEmotionChat } from '../api/index.js'
import { useVoiceOutput } from '../composables/useVoice.js'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
})

const voice = ref('甜美女声')
const voiceOut = useVoiceOutput()

const GREETING =
  '姐姐在呢。把心里的话跟我说说，我会认真听，也会好好接住你的情绪。'

const messages = ref([{ role: 'assistant', content: GREETING }])
const input = ref('')
const sending = ref(false)
const errorMsg = ref('')
const listRef = ref(null)

const QUICK_PROMPTS = [
  '今天好累，什么都不想干',
  '最近压力好大，有点焦虑',
  '工作上被批评了，好委屈',
  '好久没跟人好好说话了',
  '今天发生了一件开心的事！',
]

const PIPELINE_STEPS = [
  '正在读懂你的情绪…',
  '正在分析心理状态…',
  '正在挑选最合适的回应方式…',
  '姐姐在想怎么跟你说…',
]
const pipelineLine = ref(PIPELINE_STEPS[0])
let pipelineTimer = null

const hasChat = computed(() => messages.value.some((m) => m.role === 'user'))

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

function startPipelineLines() {
  let i = 0
  pipelineLine.value = PIPELINE_STEPS[0]
  pipelineTimer = setInterval(() => {
    i = (i + 1) % PIPELINE_STEPS.length
    pipelineLine.value = PIPELINE_STEPS[i]
  }, 2400)
}

function stopPipelineLines() {
  if (pipelineTimer) {
    clearInterval(pipelineTimer)
    pipelineTimer = null
  }
}

function pickPrompt(text) {
  if (sending.value) return
  input.value = text
}

async function send(text) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return
  input.value = ''
  errorMsg.value = ''
  messages.value.push({ role: 'user', content })
  messages.value.push({ role: 'assistant', content: '', pending: true })
  scrollToBottom()

  sending.value = true
  voiceOut.stop()
  startPipelineLines()
  const last = messages.value[messages.value.length - 1]
  try {
    const { reply } = await sendEmotionChat({
      query: content,
      sessionId: props.sessionId,
    })
    last.content = reply || '（姐姐一时不知道怎么说，你再说一次好吗？）'
    last.pending = false
    if (!voiceOut.muted.value && last.content) {
      const audioUrl = await synthesizeTTS({ text: last.content, voice: voice.value })
      voiceOut.speak(last.content, audioUrl)
    }
  } catch (err) {
    last.content = ''
    last.pending = false
    messages.value.pop()
    messages.value.pop()
    errorMsg.value = `回应失败：${err.message}`
  } finally {
    sending.value = false
    stopPipelineLines()
    scrollToBottom()
  }
}

async function reset() {
  if (sending.value) return
  voiceOut.stop()
  messages.value = [{ role: 'assistant', content: GREETING }]
  input.value = ''
  errorMsg.value = ''
  try {
    await clearEmotionChat({ sessionId: props.sessionId })
  } catch (err) {
    errorMsg.value = `清空后端历史失败：${err.message}`
  }
}

function onKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
  }
}

onBeforeUnmount(() => {
  stopPipelineLines()
  voiceOut.stop()
})
</script>

<template>
  <div class="emotion">
    <div class="ambient" aria-hidden="true">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
      <span class="blob b3"></span>
    </div>

    <div class="inner">
      <header class="head">
        <div class="title">
          <span class="badge"><Icon name="heart" :size="18" /></span>
          <div>
            <h2>情绪陪伴</h2>
            <p>深度情绪识别 · 策略化回应</p>
          </div>
        </div>
        <button
          class="mute-btn"
          :title="voiceOut.muted.value ? '取消静音' : '静音语音播报'"
          :aria-label="voiceOut.muted.value ? '取消静音' : '静音'"
          @click="voiceOut.toggleMute()"
        >
          <Icon :name="voiceOut.muted.value ? 'mute' : 'volume'" :size="16" />
        </button>
      </header>

      <div class="pipeline">
        <div class="pipe-item">
          <span class="dot"></span>
          <span>心理画像</span>
        </div>
        <span class="pipe-arrow">→</span>
        <div class="pipe-item">
          <span class="dot d2"></span>
          <span>策略优选</span>
        </div>
        <span class="pipe-arrow">→</span>
        <div class="pipe-item">
          <span class="dot d3"></span>
          <span>温柔回应</span>
        </div>
      </div>

      <div ref="listRef" class="chat">
        <MessageBubble
          v-for="(m, i) in messages"
          :key="i"
          :role="m.role"
          :content="m.content"
          :pending="m.pending"
        />
      </div>

      <div v-if="sending" class="thinking">
        <span class="pulse"></span>
        <span class="fun">{{ pipelineLine }}</span>
      </div>

      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

      <div v-if="!hasChat" class="chips">
        <span class="chips-label">试试这些：</span>
        <button
          v-for="p in QUICK_PROMPTS"
          :key="p"
          class="chip"
          :disabled="sending"
          @click="pickPrompt(p)"
        >
          {{ p }}
        </button>
      </div>

      <div class="composer">
        <textarea
          v-model="input"
          class="query"
          rows="2"
          :disabled="sending"
          placeholder="说说此刻的心情…（Enter 发送，Shift+Enter 换行）"
          @keydown="onKeydown"
        />
        <div class="actions">
          <button class="run" :disabled="sending || !input.trim()" @click="send()">
            {{ sending ? '倾听中…' : '倾诉' }}
          </button>
          <button class="ghost" :disabled="sending" @click="reset">清空</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emotion {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
}
.ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(52px);
  opacity: 0.45;
}
.blob.b1 {
  width: 280px;
  height: 280px;
  left: -60px;
  top: 10%;
  background: radial-gradient(circle, rgba(255, 143, 180, 0.6), transparent 70%);
  animation: drift 12s ease-in-out infinite;
}
.blob.b2 {
  width: 220px;
  height: 220px;
  right: -40px;
  top: 35%;
  background: radial-gradient(circle, rgba(201, 168, 255, 0.5), transparent 70%);
  animation: drift 14s ease-in-out infinite reverse;
}
.blob.b3 {
  width: 200px;
  height: 200px;
  left: 30%;
  bottom: -50px;
  background: radial-gradient(circle, rgba(255, 143, 180, 0.32), transparent 70%);
  animation: drift 16s ease-in-out infinite 2s;
}
@keyframes drift {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(12px, -16px) scale(1.06);
  }
}

.inner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 22px;
  padding-top: 52px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.head .title {
  display: flex;
  gap: 12px;
  align-items: center;
}
.mute-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  background: var(--panel);
  border: 1px solid var(--border);
  transition: background 0.18s, color 0.18s;
}
.mute-btn:hover {
  background: var(--panel-strong);
}
.badge {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ff8fb4 0%, #f06b9b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 8px 28px rgba(240, 107, 155, 0.35);
}
.head h2 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
}
.head p {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 2px;
}

.pipeline {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(255, 143, 180, 0.08);
  border: 1px solid rgba(255, 143, 180, 0.22);
}
.pipe-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  letter-spacing: 0.02em;
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff8fb4;
  box-shadow: 0 0 8px rgba(255, 143, 180, 0.8);
}
.dot.d2 {
  background: #ffc4ae;
  box-shadow: 0 0 8px rgba(255, 143, 180, 0.7);
}
.dot.d3 {
  background: #c9a8ff;
  box-shadow: 0 0 8px rgba(201, 168, 255, 0.7);
}
.pipe-arrow {
  font-size: 10px;
  color: var(--text-faint);
  opacity: 0.7;
}

.chat {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  padding: 4px 2px;
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.12);
  border: 1px solid var(--border);
}

.thinking {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255, 143, 180, 0.08);
  border: 1px solid rgba(255, 143, 180, 0.22);
}
.pulse {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse 1.4s ease-in-out infinite;
}
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.35);
    opacity: 1;
  }
}
.fun {
  font-size: 13px;
  color: var(--text-dim);
}

.error {
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--danger);
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

.chips {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.chips-label {
  font-size: 12px;
  color: var(--text-faint);
  width: 100%;
}
.chip {
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-dim);
  background: var(--panel);
  border: 1px solid var(--border);
  transition: border-color 0.18s, color 0.18s, background 0.18s;
}
.chip:hover:not(:disabled) {
  color: var(--text);
  border-color: rgba(255, 143, 180, 0.5);
  background: rgba(255, 143, 180, 0.1);
}
.chip:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.composer {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.query {
  width: 100%;
  resize: none;
  min-height: 56px;
  max-height: 120px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
  outline: none;
}
.query:focus {
  border-color: rgba(255, 143, 180, 0.6);
  box-shadow: 0 0 0 3px rgba(255, 143, 180, 0.12);
}
.query:disabled {
  opacity: 0.6;
}

.actions {
  display: flex;
  gap: 10px;
}
.run {
  flex: 1;
  padding: 12px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #ff8fb4 0%, #f06b9b 55%, #c9a8ff 100%);
  box-shadow: 0 8px 24px rgba(240, 107, 155, 0.32);
  transition: opacity 0.18s, transform 0.1s;
}
.run:active:not(:disabled) {
  transform: scale(0.98);
}
.run:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.ghost {
  padding: 12px 18px;
  border-radius: 999px;
  font-size: 14px;
  color: var(--text-dim);
  border: 1px solid var(--border);
}
.ghost:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
