<script setup>
defineProps({
  role: { type: String, required: true }, // 'user' | 'assistant'
  content: { type: String, default: '' },
  pending: { type: Boolean, default: false },
})
</script>

<template>
  <div class="row" :class="role">
    <div class="bubble" :class="role">
      <span v-if="pending" class="typing">
        <i></i><i></i><i></i>
      </span>
      <template v-else>{{ content }}</template>
    </div>
  </div>
</template>

<style scoped>
.row {
  display: flex;
  margin: 10px 0;
}
.row.user {
  justify-content: flex-end;
}
.row.assistant {
  justify-content: flex-start;
}
.bubble {
  max-width: 78%;
  padding: 11px 15px;
  border-radius: 16px;
  font-size: 15px;
  line-height: 1.55;
  word-break: break-word;
  white-space: pre-wrap;
}
.bubble.user {
  background: var(--user-bubble);
  color: #fff;
  border-bottom-right-radius: 5px;
  box-shadow: 0 6px 18px rgba(240, 107, 155, 0.35);
}
.bubble.assistant {
  background: var(--ai-bubble);
  border: 1px solid var(--border);
  color: var(--text);
  border-bottom-left-radius: 5px;
}
.typing {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  height: 18px;
}
.typing i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-dim);
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
</style>
