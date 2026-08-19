<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { uploadTaskFolder, runSimpleAgent, downloadAgentFile, clearAgentChat } from '../api/index.js'
import Icon from './Icon.vue'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
})

const files = ref([])
const taskName = ref('')
const query = ref('')
const uploading = ref(false)
const running = ref(false)
const messages = ref([]) // { role: 'user'|'assistant', content, download? }
const errorMsg = ref('')
const listRef = ref(null)

const FUN_LINES = [
  '正在翻阅你的文件…',
  '正在理解你的问题…',
  '正在梳理关键信息…',
  '正在把碎片拼成答案…',
  '正在认真思考中…',
  '马上就好，再等我一下…',
]
const funLine = ref(FUN_LINES[0])
let funTimer = null

const busy = computed(() => uploading.value || running.value)
const fileCount = computed(() => files.value.length)
const canRun = computed(
  () => !busy.value && taskName.value && query.value.trim(),
)
const hasChat = computed(() => messages.value.length > 0)

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

function startFunLines() {
  let i = 0
  funLine.value = FUN_LINES[0]
  funTimer = setInterval(() => {
    i = (i + 1) % FUN_LINES.length
    funLine.value = FUN_LINES[i]
  }, 2200)
}

function stopFunLines() {
  if (funTimer) {
    clearInterval(funTimer)
    funTimer = null
  }
}

async function onFolderPick(e) {
  const picked = Array.from(e.target.files || [])
  if (!picked.length) return
  files.value = picked
  messages.value = []
  errorMsg.value = ''

  uploading.value = true
  try {
    const { taskname, count } = await uploadTaskFolder({
      files: picked,
      sessionId: props.sessionId,
    })
    taskName.value = taskname
    if (!count) errorMsg.value = '文件夹是空的，换一个试试？'
  } catch (err) {
    errorMsg.value = `上传失败：${err.message}`
    taskName.value = ''
    files.value = []
  } finally {
    uploading.value = false
    e.target.value = ''
  }
}

async function run() {
  if (!canRun.value) return
  const text = query.value.trim()
  query.value = ''
  running.value = true
  errorMsg.value = ''
  messages.value.push({ role: 'user', content: text })
  scrollToBottom()
  startFunLines()
  try {
    const { result: r, download } = await runSimpleAgent({
      taskName: taskName.value,
      query: text,
      sessionId: props.sessionId,
    })
    messages.value.push({
      role: 'assistant',
      content: r || '（没有返回内容）',
      download: download || '',
    })
  } catch (err) {
    messages.value.pop()
    errorMsg.value = `执行失败：${err.message}`
  } finally {
    running.value = false
    stopFunLines()
    scrollToBottom()
  }
}

async function reset() {
  if (busy.value) return
  files.value = []
  taskName.value = ''
  query.value = ''
  messages.value = []
  errorMsg.value = ''
  try {
    await clearAgentChat({ sessionId: props.sessionId })
  } catch (err) {
    errorMsg.value = `清空后端历史失败：${err.message}`
  }
}

function downloadReport(filename) {
  if (!filename) return
  downloadAgentFile({
    sessionId: props.sessionId,
    taskName: taskName.value,
    filename,
  })
}

onBeforeUnmount(stopFunLines)
</script>

<template>
  <div class="agent">
    <div class="ambient" aria-hidden="true">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
    </div>

    <div class="inner" :class="{ 'has-chat': hasChat }">
      <header class="head">
        <div class="title">
          <span class="badge"><Icon name="zap" :size="18" /></span>
          <div>
            <h2>生产力助手</h2>
            <p>上传文件夹后可多轮追问，同一会话会记住上下文。</p>
          </div>
        </div>
      </header>

      <label class="drop" :class="{ active: fileCount }">
        <input
          type="file"
          webkitdirectory
          directory
          multiple
          :disabled="busy"
          @change="onFolderPick"
        />
        <div class="drop-body">
          <span class="drop-icon"><Icon name="folder" :size="26" /></span>
          <template v-if="uploading">
            <strong>正在上传文件夹…</strong>
          </template>
          <template v-else-if="taskName">
            <strong>{{ taskName }}</strong>
            <small>{{ fileCount }} 个文件已就绪 · 点击可重新选择</small>
          </template>
          <template v-else>
            <strong>点击选择文件夹</strong>
            <small>会把整个文件夹交给助手分析</small>
          </template>
        </div>
      </label>

      <div v-if="hasChat" ref="listRef" class="chat">
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="bubble"
          :class="m.role"
        >
          <div class="bubble-body">{{ m.content }}</div>
          <button
            v-if="m.download"
            class="dl-btn"
            @click="downloadReport(m.download)"
          >
            <Icon name="download" :size="13" />
            下载 {{ m.download }}
          </button>
        </div>
      </div>

      <textarea
        v-model="query"
        class="query"
        rows="3"
        :disabled="busy"
        :placeholder="
          hasChat
            ? '继续追问，例如：第二节再写深入一点'
            : '例如：帮我总结这些报告的核心结论'
        "
        @keydown.enter.exact.prevent="run"
      ></textarea>

      <div class="actions">
        <button class="run" :disabled="!canRun" @click="run">
          {{ running ? '分析中…' : hasChat ? '继续对话' : '开始分析' }}
        </button>
        <button class="ghost" :disabled="busy" @click="reset">清空</button>
      </div>

      <div v-if="running" class="thinking">
        <span class="spinner"></span>
        <span class="fun">{{ funLine }}</span>
      </div>

      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>
    </div>
  </div>
</template>

<style scoped>
.agent {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  align-items: stretch;
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
  filter: blur(48px);
  opacity: 0.4;
}
.blob.b1 {
  width: 260px;
  height: 260px;
  left: -40px;
  top: -30px;
  background: radial-gradient(circle, rgba(201, 168, 255, 0.55), transparent 70%);
}
.blob.b2 {
  width: 240px;
  height: 240px;
  right: -30px;
  bottom: -20px;
  background: radial-gradient(circle, rgba(255, 143, 180, 0.45), transparent 70%);
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
  gap: 16px;
  min-height: 0;
  overflow-y: auto;
}
.inner.has-chat {
  overflow: hidden;
}

.head,
.drop,
.query,
.actions,
.thinking,
.error {
  flex-shrink: 0;
}

.head .title {
  display: flex;
  gap: 12px;
  align-items: center;
}
.badge {
  width: 42px;
  height: 42px;
  flex: 0 0 42px;
  border-radius: 12px;
  background: var(--accent-grad);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: var(--shadow);
}
.head h2 {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
}
.head p {
  font-size: 13px;
  color: var(--text-dim);
  margin-top: 2px;
}

.drop {
  position: relative;
  display: block;
  border: 1.5px dashed var(--border);
  border-radius: var(--radius);
  background: var(--panel);
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}
.drop:hover {
  border-color: var(--accent);
  background: var(--panel-strong);
}
.drop.active {
  border-color: var(--accent-2);
  border-style: solid;
}
.drop input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.drop input:disabled {
  cursor: not-allowed;
}
.drop-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  text-align: center;
}
.drop-icon {
  color: var(--gold);
  margin-bottom: 4px;
}
.drop-body strong {
  font-size: 14px;
  color: var(--text);
}
.drop-body small {
  font-size: 12px;
  color: var(--text-faint);
}

.chat {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 2px;
}
.bubble {
  max-width: 92%;
  padding: 10px 12px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.bubble.user {
  align-self: flex-end;
  background: var(--accent-grad);
  color: #fff;
}
.bubble.assistant {
  align-self: flex-start;
  background: var(--panel);
  border: 1px solid var(--border);
  color: var(--text);
}
.bubble-body {
  white-space: pre-wrap;
}
.dl-btn {
  margin-top: 8px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--accent-grad);
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.query {
  width: 100%;
  resize: vertical;
  min-height: 74px;
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
  border-color: var(--accent);
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
  background: var(--accent-grad);
  box-shadow: var(--shadow);
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
}

.thinking {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid var(--border);
}
.spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--gold);
  animation: spin 0.8s linear infinite;
}
.fun {
  font-size: 13px;
  color: var(--text-dim);
}

.error {
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--danger);
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
