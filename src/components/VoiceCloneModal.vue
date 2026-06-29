<script setup>
import { ref } from 'vue'
import { cloneVoice } from '../api/index.js'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
})
const emit = defineEmits(['close', 'cloned'])

const file = ref(null)
const fileName = ref('')
const previewUrl = ref('')
const cloning = ref(false)
const error = ref('')
const fileInput = ref(null)

const ACCEPT = '.mp3,.m4a,.wav,.aac,audio/*'

function pick() {
  fileInput.value?.click()
}

function onFile(e) {
  error.value = ''
  const f = e.target.files?.[0]
  if (!f) return
  if (!/\.(mp3|m4a|wav|aac)$/i.test(f.name)) {
    error.value = '请选择 mp3 / m4a / wav / aac 音频文件'
    return
  }
  file.value = f
  fileName.value = f.name
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = URL.createObjectURL(f)
}

function onDrop(e) {
  const f = e.dataTransfer.files?.[0]
  if (f) onFile({ target: { files: [f] } })
}

async function submit() {
  if (!file.value || cloning.value) return
  cloning.value = true
  error.value = ''
  try {
    const result = await cloneVoice(file.value, props.sessionId)
    emit('cloned', result)
  } catch (e) {
    error.value = '克隆失败：' + e.message
  } finally {
    cloning.value = false
  }
}

function close() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  emit('close')
}
</script>

<template>
  <div class="overlay" @click.self="close">
    <div class="modal glass">
      <header class="modal-head">
        <h3>克隆音色</h3>
        <button class="x" @click="close">✕</button>
      </header>

      <p class="hint">上传一段清晰的人声音频（建议 10~30 秒、无背景噪音），克隆后 AI 会用这个声音说话。</p>

      <div
        class="drop"
        :class="{ filled: !!file }"
        @click="pick"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <input
          ref="fileInput"
          type="file"
          :accept="ACCEPT"
          hidden
          @change="onFile"
        />
        <template v-if="!file">
          <div class="drop-icon">🎤</div>
          <p>点击选择，或把音频拖到这里</p>
          <small>支持 mp3 / m4a / wav / aac</small>
        </template>
        <template v-else>
          <div class="drop-icon">🎧</div>
          <p class="fname">{{ fileName }}</p>
          <small>点击可重新选择</small>
        </template>
      </div>

      <audio v-if="previewUrl" :src="previewUrl" controls class="preview" />

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="ghost" @click="close">取消</button>
        <button class="primary" :disabled="!file || cloning" @click="submit">
          {{ cloning ? '克隆中…（约需十几秒）' : '开始克隆' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.modal {
  width: 100%;
  max-width: 420px;
  border-radius: var(--radius);
  padding: 20px;
  box-shadow: var(--shadow);
}
.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.modal-head h3 {
  font-size: 17px;
}
.x {
  font-size: 16px;
  opacity: 0.7;
  width: 28px;
  height: 28px;
  border-radius: 8px;
}
.x:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}
.hint {
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.5;
  margin-bottom: 14px;
}
.drop {
  border: 1.5px dashed var(--border);
  border-radius: 14px;
  padding: 28px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
}
.drop:hover {
  border-color: var(--accent-2);
  background: rgba(167, 139, 250, 0.06);
}
.drop.filled {
  border-color: var(--accent);
  background: rgba(255, 143, 177, 0.08);
}
.drop-icon {
  font-size: 34px;
  margin-bottom: 8px;
}
.drop p {
  font-size: 14px;
  margin-bottom: 4px;
}
.drop .fname {
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}
.drop small {
  font-size: 12px;
  color: var(--text-faint);
}
.preview {
  width: 100%;
  margin-top: 14px;
  height: 36px;
}
.error {
  margin-top: 12px;
  font-size: 12px;
  color: var(--danger);
  background: rgba(255, 107, 107, 0.1);
  padding: 8px 10px;
  border-radius: 8px;
}
.actions {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}
.actions button {
  flex: 1;
  height: 40px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.ghost {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid var(--border);
  color: var(--text);
}
.ghost:hover {
  background: rgba(255, 255, 255, 0.14);
}
.primary {
  background: var(--accent-grad);
  color: #fff;
}
.primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
