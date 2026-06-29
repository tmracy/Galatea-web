<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  speaking: { type: Boolean, default: false },
  name: { type: String, default: '张蕊' },
})

const stageRef = ref(null)
const status = ref('loading') // loading | ready | fallback
let oml2d = null

// 公开样本模型（Cubism2，体积小、加载稳定）。换模型只需改 path。
const MODEL_PATH =
  'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json'

onMounted(async () => {
  try {
    const { loadOml2d } = await import('oh-my-live2d')
    oml2d = loadOml2d({
      parentElement: stageRef.value,
      sayHello: false,
      mobileDisplay: true,
      menus: { disable: true },
      statusBar: { disable: true },
      primaryColor: '#ff8fb1',
      tips: { idleTips: { interval: 20000, message: ['在的，姐姐一直都在～'] } },
      models: [
        {
          path: MODEL_PATH,
          scale: 0.16,
          position: [0, 30],
          stageStyle: { height: 460 },
        },
      ],
    })
    status.value = 'ready'
  } catch (e) {
    console.warn('[live2d] 加载失败，使用静态头像兜底：', e)
    status.value = 'fallback'
  }
})

onBeforeUnmount(() => {
  try {
    oml2d?.destroy?.()
  } catch (_) {
    /* noop */
  }
})

// AI 说话时，让 Live2D 做个动作（若可用）。
watch(
  () => props.speaking,
  (v) => {
    if (status.value === 'ready' && v) {
      try {
        oml2d?.tipsMessage?.('嗯～', 1500, 5)
      } catch (_) {
        /* noop */
      }
    }
  },
)
</script>

<template>
  <div class="stage">
    <div ref="stageRef" class="live2d-host" :class="{ hidden: status === 'fallback' }"></div>

    <!-- 兜底：纯 CSS 头像，加载失败/离线时显示，仍随说话状态律动 -->
    <div v-if="status !== 'ready'" class="avatar" :class="{ talking: speaking }">
      <div class="halo"></div>
      <div class="orb">
        <span class="initial">{{ name.slice(0, 1) }}</span>
      </div>
      <div v-if="speaking" class="rings">
        <span></span><span></span><span></span>
      </div>
    </div>

    <div class="nameplate glass">
      <span class="dot" :class="{ on: speaking }"></span>
      {{ name }}
      <small>{{ speaking ? '说话中…' : '在线' }}</small>
    </div>

    <div v-if="status === 'loading'" class="hint">形象加载中…</div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.live2d-host {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.live2d-host.hidden {
  display: none;
}

/* 兜底头像 */
.avatar {
  position: relative;
  width: 230px;
  height: 230px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.halo {
  position: absolute;
  inset: -30px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(255, 143, 177, 0.35), transparent 65%);
  filter: blur(8px);
  animation: breathe 4s ease-in-out infinite;
}
.orb {
  position: relative;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: var(--accent-grad);
  box-shadow: 0 20px 60px rgba(167, 139, 250, 0.45), inset 0 4px 20px rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: breathe 4s ease-in-out infinite;
}
.initial {
  font-size: 76px;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
.avatar.talking .orb {
  animation: breathe 1.1s ease-in-out infinite;
}
.rings {
  position: absolute;
  inset: 0;
}
.rings span {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 170px;
  height: 170px;
  border: 2px solid rgba(255, 143, 177, 0.5);
  border-radius: 50%;
  animation: ripple 1.6s ease-out infinite;
}
.rings span:nth-child(2) {
  animation-delay: 0.5s;
}
.rings span:nth-child(3) {
  animation-delay: 1s;
}

.nameplate {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.nameplate small {
  color: var(--text-dim);
  font-weight: 400;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-faint);
}
.dot.on {
  background: #7be0a4;
  box-shadow: 0 0 8px #7be0a4;
}

.hint {
  position: absolute;
  bottom: 64px;
  color: var(--text-faint);
  font-size: 13px;
}

@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
}
@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
</style>
