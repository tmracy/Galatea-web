<script setup>
import { ref, nextTick, watch, onMounted } from 'vue'
import MessageBubble from './MessageBubble.vue'
import VoiceCloneModal from './VoiceCloneModal.vue'
import { sendChatStream, synthesizeTTS, uploadChatHistory } from '../api/index.js'
import { useVoiceInput, useVoiceOutput } from '../composables/useVoice.js'

const props = defineProps({
  sessionId: { type: String, default: 'web' },
})
const emit = defineEmits(['speaking'])

const GREETING = '嗨，我是张蕊。想聊点什么呀？打字或者点麦克风跟我说话都行。'
const messages = ref([{ role: 'assistant', content: GREETING }])
const input = ref('')
const sending = ref(false)
const archiving = ref(false)
const listRef = ref(null)

// 当前使用的克隆音色（Data/ 下的 *_voice_id.json 文件名）；null 用后端默认音色
const voice = ref('赵丽颖')
const showClone = ref(false)

const voiceIn = useVoiceInput()
const voiceOut = useVoiceOutput()

function onCloned(result) {
  if (result?.voice) voice.value = result.voice
  showClone.value = false
}

watch(
  () => voiceOut.speaking.value,
  (v) => emit('speaking', v),
)

function scrollToBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight
  })
}

async function send(text) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return
  input.value = ''
  messages.value.push({ role: 'user', content })
  messages.value.push({ role: 'assistant', content: '', pending: true })
  scrollToBottom()
  sending.value = true
  voiceOut.stop() // 清掉上一条回复可能还在排队/播放的音频
  const last = messages.value[messages.value.length - 1]
  try {
    // 流式：每收到一句就即时上屏 + 合成克隆音色入队顺序播放，大幅降低首音延迟
    await sendChatStream({
      text: content,
      sessionId: props.sessionId,
      onSentence: async (sentence) => {
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
      last.content = '（没有收到回复）'
      last.pending = false
    }
  } catch (e) {
    last.content = last.content || '抱歉，刚刚走神了，再说一次好吗？'
    last.pending = false
  } finally {
    sending.value = false
    scrollToBottom()
  }
}

// 当前窗口是否有真实对话（用户发过话），只有有内容才值得归档
function hasRealConversation() {
  return messages.value.some((m) => m.role === 'user')
}

// 开新对话：先把旧对话归档到后端（落盘 + 长期记忆），再清空开新窗口
async function newConversation() {
  if (archiving.value || sending.value) return
  if (hasRealConversation()) {
    archiving.value = true
    const history = messages.value
      .filter((m) => !m.pending && m.content)
      .map((m) => ({ role: m.role, content: m.content }))
    try {
      await uploadChatHistory({ sessionId: props.sessionId, chatHistory: history })
    } catch (e) {
      console.warn('[chat] 归档旧对话失败：', e.message)
    } finally {
      archiving.value = false
    }
  }
  voiceOut.stop()
  if (voiceIn.listening.value) voiceIn.stop()
  messages.value = [{ role: 'assistant', content: GREETING }]
  input.value = ''
  scrollToBottom()
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
</script>

<template>
  <div class="chat glass">
    <header class="chat-head">
      <div class="title">
        <span class="live"></span> 对话
        <span v-if="voice" class="voice-tag" title="当前克隆音色">🎧 已克隆</span>
      </div>
      <div class="head-actions">
        <button
          class="icon-btn"
          :title="archiving ? '正在归档旧对话…' : '开启新对话（旧对话会自动归档）'"
          :disabled="archiving || sending"
          @click="newConversation"
        >
          {{ archiving ? '⏳' : '🆕' }}
        </button>
        <button class="icon-btn" title="克隆音色（上传音频）" @click="showClone = true">🎤</button>
        <button
          class="icon-btn"
          :title="voiceOut.muted.value ? '取消静音' : '静音语音播报'"
          @click="voiceOut.toggleMute()"
        >
          {{ voiceOut.muted.value ? '🔇' : '🔊' }}
        </button>
      </div>
    </header>

    <VoiceCloneModal
      v-if="showClone"
      :session-id="sessionId"
      @close="showClone = false"
      @cloned="onCloned"
    />

    <div ref="listRef" class="list">
      <MessageBubble
        v-for="(m, i) in messages"
        :key="i"
        :role="m.role"
        :content="m.content"
        :pending="m.pending"
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
        @click="toggleMic"
      >
        🎙️
      </button>
      <input
        v-model="input"
        type="text"
        placeholder="说点什么…（回车发送）"
        @keydown.enter="onEnter"
      />
      <button class="send" :disabled="sending || !input.trim()" @click="send()">发送</button>
    </div>
  </div>
</template>

<style scoped>
.chat {
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
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}
.live {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #7be0a4;
  box-shadow: 0 0 8px #7be0a4;
}
.voice-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
  background: rgba(255, 143, 177, 0.14);
  padding: 2px 8px;
  border-radius: 999px;
}
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  font-size: 17px;
  width: 34px;
  height: 34px;
  border-radius: 9px;
  opacity: 0.85;
  transition: background 0.18s, opacity 0.18s;
}
.icon-btn:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}
.icon-btn:disabled {
  opacity: 0.4;
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
.composer input {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  padding: 0 14px;
  font-size: 15px;
  outline: none;
}
.composer input:focus {
  border-color: var(--accent-2);
}
.mic {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 19px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  transition: all 0.2s;
}
.mic:hover {
  background: rgba(255, 255, 255, 0.12);
}
.mic.active {
  background: var(--accent-grad);
  border-color: transparent;
  animation: pulse 1.2s infinite;
}
.mic.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.send {
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  background: var(--accent-grad);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  transition: opacity 0.2s, transform 0.1s;
}
.send:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.send:not(:disabled):active {
  transform: scale(0.96);
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
    box-shadow: 0 0 0 0 rgba(255, 143, 177, 0.5);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(255, 143, 177, 0);
  }
}
</style>
