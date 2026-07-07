<script setup>
import { ref, computed, onBeforeUnmount } from 'vue'
import { uploadTaskFolder, runSimpleAgent, downloadAgentFile } from '../api/index.js'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
})

const files = ref([]) // 选中的文件夹内所有文件（File[]）
const taskName = ref('') // 文件夹顶层目录名，作为后端 taskname
const query = ref('')
const uploading = ref(false)
const running = ref(false)
const result = ref('')
const downloadFile = ref('')
const errorMsg = ref('')

// 运行时轮播的“有意思”的分析文案
const FUN_LINES = [
  '正在翻阅你的文件…',
  '正在理解你的问题…',
  '正在梳理关键信息…',
  '正在把碎片拼成答案…',
  '正在认真思考中…',
  '正在下笔整理结论…',
  '马上就好，再等我一下…',
]
const funLine = ref(FUN_LINES[0])
let funTimer = null

const busy = computed(() => uploading.value || running.value)
const fileCount = computed(() => files.value.length)
const canRun = computed(
  () => !busy.value && taskName.value && query.value.trim(),
)

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
  result.value = ''
  downloadFile.value = ''
  errorMsg.value = ''

  // 先上传文件夹到后端 Data/{session_id}/{文件夹名}/
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
    e.target.value = '' // 允许重复选同一文件夹
  }
}

async function run() {
  if (!canRun.value) return
  running.value = true
  result.value = ''
  downloadFile.value = ''
  errorMsg.value = ''
  startFunLines()
  try {
    const { result: r, download } = await runSimpleAgent({
      taskName: taskName.value,
      query: query.value.trim(),
      sessionId: props.sessionId,
    })
    result.value = r || '（没有返回内容）'
    downloadFile.value = download || ''
  } catch (err) {
    errorMsg.value = `执行失败：${err.message}`
  } finally {
    running.value = false
    stopFunLines()
  }
}

function reset() {
  files.value = []
  taskName.value = ''
  query.value = ''
  result.value = ''
  downloadFile.value = ''
  errorMsg.value = ''
}

function downloadReport() {
  if (!downloadFile.value) return
  downloadAgentFile({
    sessionId: props.sessionId,
    taskName: taskName.value,
    filename: downloadFile.value,
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

    <div class="inner" :class="{ 'has-result': !!result }">
      <header class="head">
        <div class="title">
          <span class="badge">⚡</span>
          <div>
            <h2>生产力助手</h2>
            <p>上传一个文件夹，告诉我你想让我做什么。</p>
          </div>
        </div>
      </header>

      <!-- 上传文件夹 -->
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
          <span class="drop-icon">📁</span>
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

      <!-- 任务输入 -->
      <textarea
        v-model="query"
        class="query"
        rows="3"
        :disabled="busy"
        placeholder="例如：帮我总结这些报告的核心结论，并指出重复的部分"
      ></textarea>

      <div class="actions">
        <button class="run" :disabled="!canRun" @click="run">
          {{ running ? '分析中…' : '开始分析' }}
        </button>
        <button class="ghost" :disabled="busy" @click="reset">清空</button>
      </div>

      <!-- 运行中的趣味文案 -->
      <div v-if="running" class="thinking">
        <span class="spinner"></span>
        <span class="fun">{{ funLine }}</span>
      </div>

      <!-- 错误 -->
      <div v-if="errorMsg" class="error">{{ errorMsg }}</div>

      <!-- 结果：占满剩余高度，内容在内部滚动 -->
      <div v-if="result" class="result">
        <div class="result-head">
          <span>分析结果</span>
          <button v-if="downloadFile" class="dl-btn" @click="downloadReport">
            ↓ 下载 {{ downloadFile }}
          </button>
        </div>
        <div class="result-body">{{ result }}</div>
      </div>
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
  background: radial-gradient(circle, rgba(167, 139, 250, 0.6), transparent 70%);
}
.blob.b2 {
  width: 240px;
  height: 240px;
  right: -30px;
  bottom: -20px;
  background: radial-gradient(circle, rgba(255, 143, 177, 0.5), transparent 70%);
}

.inner {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  padding: 22px;
  padding-top: 52px; /* 给左上角「陪伴/生产力」切换留空 */
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  overflow-y: auto;
}
.inner.has-result {
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
  font-size: 20px;
  box-shadow: var(--shadow);
}
.head h2 {
  font-size: 18px;
  font-weight: 700;
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
  font-size: 28px;
}
.drop-body strong {
  font-size: 14px;
  color: var(--text);
}
.drop-body small {
  font-size: 12px;
  color: var(--text-faint);
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
  transition: opacity 0.18s, transform 0.1s;
}
.run:active {
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
  border-top-color: var(--accent);
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

.result {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  border: 1px solid var(--border);
  background: var(--panel);
  overflow: hidden;
}
.result-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-dim);
  border-bottom: 1px solid var(--border);
  background: var(--panel-strong);
}
.dl-btn {
  flex-shrink: 0;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  background: var(--accent-grad);
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dl-btn:hover {
  opacity: 0.9;
}
.result-body {
  flex: 1 1 0;
  min-height: 0;
  padding: 14px 14px 28px;
  overflow-y: auto;
  overflow-x: hidden;
  font-size: 14px;
  line-height: 1.65;
  color: var(--text);
  white-space: pre-wrap;
  word-break: break-word;
  -webkit-overflow-scrolling: touch;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
