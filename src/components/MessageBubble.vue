<script setup>
import Icon from './Icon.vue'

defineProps({
  role: { type: String, required: true }, // 'user' | 'assistant'
  content: { type: String, default: '' },
  pending: { type: Boolean, default: false },
  showCopy: { type: Boolean, default: false },
  showRetry: { type: Boolean, default: false },
  showStop: { type: Boolean, default: false },
})
const emit = defineEmits(['copy', 'retry', 'stop'])
</script>

<template>
  <div class="row" :class="role">
    <div v-if="role === 'assistant'" class="ava" aria-hidden="true"></div>
    <div class="stack">
      <div class="bubble" :class="role">
        <span v-if="pending" class="typing">
          <i></i><i></i><i></i>
        </span>
        <template v-else>{{ content }}</template>
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
  margin: 10px 0;
}
.row.user {
  justify-content: flex-end;
}
.row.assistant {
  justify-content: flex-start;
}
.stack {
  max-width: 78%;
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
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  background:
    radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.55), transparent 42%),
    var(--accent-grad);
  box-shadow: 0 0 0 1px rgba(255, 143, 180, 0.35);
  margin-bottom: 2px;
}
.bubble {
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.62;
  word-break: break-word;
  white-space: pre-wrap;
}
.bubble.user {
  background: var(--user-bubble);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 8px 20px rgba(240, 107, 155, 0.28);
}
.bubble.assistant {
  background: var(--ai-bubble);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 5px;
}
.acts {
  display: flex;
  gap: 2px;
  opacity: 0.45;
  transition: opacity 0.18s;
}
.row:hover .acts,
.acts:focus-within {
  opacity: 1;
}
.act {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  color: var(--text-dim);
  display: grid;
  place-items: center;
}
.act:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
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
  background: var(--gold);
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
@media (hover: none) {
  .acts {
    opacity: 0.85;
  }
}
</style>
