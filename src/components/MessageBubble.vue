<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  role: { type: String, required: true }, // 'user' | 'assistant'
  content: { type: String, default: '' },
  pending: { type: Boolean, default: false },
  holdWait: { type: Boolean, default: false },
  ingesting: { type: Boolean, default: false },
  showCopy: { type: Boolean, default: false },
  showRetry: { type: Boolean, default: false },
  showStop: { type: Boolean, default: false },
})
const emit = defineEmits(['copy', 'retry', 'stop'])

const WAIT_LINES = [
  { after: 0, text: '我在听…' },
  { after: 3000, text: '让我想想…' },
  { after: 10000, text: '再等我一下…' },
  { after: 20000, text: '马上就好…' },
]

const waitLine = ref(WAIT_LINES[0].text)
let waitTimer = null
let startedAt = 0

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pickLine(elapsed) {
  let text = WAIT_LINES[0].text
  for (const row of WAIT_LINES) {
    if (elapsed >= row.after) text = row.text
  }
  return text
}

function stopWait() {
  if (waitTimer) {
    clearInterval(waitTimer)
    waitTimer = null
  }
}

function startWait() {
  stopWait()
  startedAt = Date.now()
  waitLine.value = WAIT_LINES[0].text
  if (prefersReducedMotion()) return
  waitTimer = setInterval(() => {
    waitLine.value = pickLine(Date.now() - startedAt)
  }, 400)
}

watch(
  () => props.pending && !props.holdWait,
  (on) => {
    if (on) startWait()
    else stopWait()
  },
  { immediate: true },
)

onBeforeUnmount(stopWait)
</script>

<template>
  <div v-if="!(pending && holdWait)" class="row" :class="[role, { ingesting }]">
    <div v-if="role === 'assistant'" class="ava" aria-hidden="true"></div>
    <div class="stack">
      <div class="bubble" :class="role">
        <span v-if="pending" class="wait" aria-live="polite">
          <span class="typing">
            <i></i><i></i><i></i>
          </span>
          <span :key="waitLine" class="wait-copy">{{ waitLine }}</span>
        </span>
        <template v-else>
          {{ content }}<span v-if="ingesting" class="caret" data-user-ingest aria-hidden="true"></span>
        </template>
      </div>
      <div v-if="!pending && content && (showCopy || showRetry || showStop)" class="acts">
        <button
          v-if="showStop"
          type="button"
          class="act"
          title="停止播放"
          aria-label="停止播放"
          @click="emit('stop')"
        >
          <Icon name="stop" :size="13" />
        </button>
        <button
          v-if="showRetry"
          type="button"
          class="act"
          title="重试这一句"
          aria-label="重试"
          @click="emit('retry')"
        >
          <Icon name="refresh" :size="13" />
        </button>
        <button
          v-if="showCopy"
          type="button"
          class="act"
          title="复制"
          aria-label="复制"
          @click="emit('copy')"
        >
          <Icon name="copy" :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  margin: 12px 0;
}
.row.user {
  justify-content: flex-end;
  animation: bubbleIn 0.28s ease-out;
}
.row.assistant {
  justify-content: flex-start;
}
.stack {
  max-width: 82%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row.user .stack {
  align-items: flex-end;
}
.row.assistant .stack {
  align-items: flex-start;
}
.ava {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.55), transparent 42%),
    var(--accent-grad);
  box-shadow: 0 0 0 1px rgba(255, 143, 180, 0.35);
  margin-bottom: 2px;
}
.bubble {
  padding: 11px 14px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.68;
  word-break: break-word;
  white-space: pre-wrap;
}
.row.user.ingesting .bubble {
  min-width: 48px;
  min-height: 40px;
}
.bubble.user {
  background: var(--user-bubble);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 8px 20px rgba(95, 38, 65, 0.18);
}
.bubble.assistant {
  background: var(--ai-bubble);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 5px;
}
.acts {
  display: flex;
  gap: 4px;
  opacity: 0.5;
  transition: opacity 0.18s;
}
.row:hover .acts,
.acts:focus-within {
  opacity: 1;
}
.act {
  width: 32px;
  height: 32px;
  border-radius: 9px;
  color: var(--text-dim);
  display: grid;
  place-items: center;
}
.act:hover {
  color: var(--text);
  background: var(--surface-2);
}
.wait {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.wait-copy {
  font-family: var(--font-display);
  font-size: 14px;
  font-style: italic;
  color: var(--text-dim);
  animation: copyIn 0.35s ease-out;
}
.caret {
  display: inline-block;
  width: 1.5px;
  height: 0.95em;
  margin-left: 2px;
  vertical-align: -0.1em;
  background: rgba(255, 255, 255, 0.85);
  animation: caretBlink 0.9s steps(1) infinite;
}
.typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 18px;
}
.typing i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  animation: blink 1.2s infinite ease-in-out;
}
.typing i:nth-child(2) {
  animation-delay: 0.2s;
}
.typing i:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
@keyframes bubbleIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes copyIn {
  from {
    opacity: 0.35;
  }
  to {
    opacity: 1;
  }
}
@keyframes caretBlink {
  50% {
    opacity: 0;
  }
}
@media (hover: none) {
  .acts {
    opacity: 1;
  }
  .act {
    width: 36px;
    height: 36px;
  }
}
@media (max-width: 880px) {
  .row {
    margin: 10px 0;
  }
  .stack {
    max-width: 88%;
  }
  .bubble {
    padding: 10px 13px;
    font-size: 14.5px;
    line-height: 1.65;
  }
}
@media (prefers-reduced-motion: reduce) {
  .row.user,
  .wait-copy,
  .caret {
    animation: none;
  }
  .typing i {
    animation: none;
    opacity: 0.7;
  }
}
</style>
