<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { audioLevel } from '../composables/useVoice.js'
import Icon from './Icon.vue'

const props = defineProps({
  speaking: { type: Boolean, default: false },
  name: { type: String, default: '明日香' },
})

const stageRef = ref(null)
const status = ref('loading') // loading | ready | fallback
const switching = ref(false)
const modelIndex = ref(0)
let oml2d = null
let idleTimer = null
let loadGuard = null
let lipRaf = null
let mouthValue = 0

// 通用项：静音动作自带语音（避免和 TTS 抢声道）+ 预加载全部动作
const COMMON = { volume: 0, motionPreloadStrategy: 'ALL', stageStyle: { height: 500 } }

// 可切换的形象列表（均为 Cubism 模型，走 oh-my-live2d 自动注入的运行时）。
// path 为「数组」时表示同一角色的多套装扮，可用「换装」按钮在其间循环。
// 各模型坐标系不同，scale/position 为经验值，按需微调即可。
const MODELS = [
  {
    name: 'shizuku',
    path: 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/shizuku/shizuku.model.json',
    scale: 0.2,
    position: [0, 20],
    ...COMMON,
  },
  {
    // 同一角色 haru 的两套装扮 → 支持换装
    name: 'haru',
    path: [
      'https://cdn.jsdelivr.net/npm/live2d-widget-model-haru/01/assets/haru01.model.json',
      'https://cdn.jsdelivr.net/npm/live2d-widget-model-haru/02/assets/haru02.model.json',
    ],
    scale: 0.18,
    position: [0, 30],
    ...COMMON,
  },
  {
    name: 'koharu',
    path: 'https://cdn.jsdelivr.net/npm/live2d-widget-model-koharu/assets/koharu.model.json',
    scale: 0.15,
    position: [0, 30],
    ...COMMON,
  },
  {
    name: 'wanko',
    path: 'https://cdn.jsdelivr.net/npm/live2d-widget-model-wanko/assets/wanko.model.json',
    scale: 0.2,
    position: [0, 40],
    ...COMMON,
  },
  {
    name: 'tororo',
    path: 'https://cdn.jsdelivr.net/npm/live2d-widget-model-tororo/assets/tororo.model.json',
    scale: 0.15,
    position: [0, 30],
    ...COMMON,
  },
  {
    // Cubism4 模型，增加多样性
    name: 'haru-greeter',
    path: 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/haru_greeter_t03.model3.json',
    scale: 0.1,
    position: [0, 40],
    ...COMMON,
  },
]

// 当前形象是否有多套装扮（path 为数组且长度 > 1）
const hasClothes = computed(() => {
  const p = MODELS[modelIndex.value]?.path
  return Array.isArray(p) && p.length > 1
})

// 取底层 pixi 模型（oh-my-live2d 内部实例，运行时属性名稳定）
function getModel() {
  try {
    return oml2d?.models?.model ?? null
  } catch (_) {
    return null
  }
}

// 读出模型可用的动作组名（不同模型组名不同，动态发现更稳）
function getMotionGroups(model) {
  try {
    const groups = model?.internalModel?.motionManager?.motionGroups ?? {}
    return Object.keys(groups).filter(
      (g) => Array.isArray(groups[g]) && groups[g].length > 0,
    )
  } catch (_) {
    return []
  }
}

// 播一个随机动作；preferActive=true 时优先非 idle 的「有看头」动作
function playRandomMotion({ preferActive = true } = {}) {
  const model = getModel()
  if (!model) return
  const groups = getMotionGroups(model)
  if (!groups.length) return
  let pool = groups
  if (preferActive) {
    const active = groups.filter((g) => !/idle/i.test(g))
    if (active.length) pool = active
  }
  const group = pool[Math.floor(Math.random() * pool.length)]
  try {
    oml2d?.models?.playMotion?.(group)
  } catch (_) {
    try {
      model.motion(group)
    } catch (_) {
      /* noop */
    }
  }
}

function playRandomExpression() {
  const model = getModel()
  if (!model) return
  try {
    model.expression() // 不传参数 = 随机表情
  } catch (_) {
    /* noop */
  }
}

// 随机间隔的空闲循环：偶尔自己动一动、换个表情（不出声、不弹气泡）
function scheduleIdle() {
  clearTimeout(idleTimer)
  const delay = 6000 + Math.random() * 8000
  idleTimer = setTimeout(() => {
    if (status.value === 'ready' && !props.speaking) {
      playRandomMotion()
      if (Math.random() < 0.5) playRandomExpression()
    }
    scheduleIdle()
  }, delay)
}

// 点击舞台 = 主动「戳」她，做个动作 + 偶尔换表情
function onStageClick() {
  if (status.value !== 'ready') return
  playRandomMotion()
  if (Math.random() < 0.6) playRandomExpression()
}

// ---- lipSync：把 TTS 实时响度写进模型的嘴巴参数 ----
function setMouth(v) {
  const core = getModel()?.internalModel?.coreModel
  if (!core) return
  try {
    if (typeof core.setParameterValueById === 'function') {
      core.setParameterValueById('ParamMouthOpenY', v) // Cubism4
    } else if (typeof core.setParamFloat === 'function') {
      core.setParamFloat('PARAM_MOUTH_OPEN_Y', v) // Cubism2
    }
  } catch (_) {
    /* noop */
  }
}

function lipLoop() {
  const target = props.speaking ? audioLevel.value || 0 : 0
  mouthValue += (target - mouthValue) * 0.45 // 平滑，避免抖动
  // 说话或余量未收完时才接管嘴巴，否则把控制权还给模型自身动作
  if (props.speaking || mouthValue > 0.02) {
    setMouth(Math.max(0, Math.min(1, mouthValue)))
  }
  lipRaf = requestAnimationFrame(lipLoop)
}

// 换形象：在 MODELS 之间循环切换
async function switchModel() {
  if (switching.value || status.value !== 'ready') return
  switching.value = true
  try {
    await oml2d?.loadNextModel?.()
    modelIndex.value = oml2d?.modelIndex ?? modelIndex.value
  } catch (e) {
    console.warn('[live2d] 切换形象失败：', e)
  } finally {
    switching.value = false
  }
}

// 换装：在当前角色的多套装扮之间循环切换
async function switchClothes() {
  if (switching.value || status.value !== 'ready' || !hasClothes.value) return
  switching.value = true
  try {
    await oml2d?.loadNextModelClothes?.()
  } catch (e) {
    console.warn('[live2d] 换装失败：', e)
  } finally {
    switching.value = false
  }
}

onMounted(async () => {
  try {
    const { loadOml2d } = await import('oh-my-live2d')
    oml2d = loadOml2d({
      parentElement: stageRef.value,
      sayHello: false,
      mobileDisplay: true,
      menus: { disable: true },
      statusBar: { disable: true },
      primaryColor: '#ff8fb4',
      tips: { idleTips: { message: [] }, welcomeTips: { message: {} } }, // 关掉空闲/欢迎气泡
      models: MODELS,
    })

    oml2d.onLoad?.((s) => {
      if (s === 'success') {
        status.value = 'ready'
        modelIndex.value = oml2d?.modelIndex ?? 0
        clearTimeout(loadGuard)
        setTimeout(() => playRandomMotion(), 800) // 出场先做个动作打招呼
        scheduleIdle()
      } else if (s === 'fail') {
        status.value = 'fallback'
      }
    })

    lipRaf = requestAnimationFrame(lipLoop)

    // 兜底：onLoad 迟迟不回时（CDN 慢/被墙），8s 后切静态头像
    loadGuard = setTimeout(() => {
      if (status.value === 'loading') status.value = 'fallback'
    }, 8000)
  } catch (e) {
    console.warn('[live2d] 加载失败，使用静态头像兜底：', e)
    status.value = 'fallback'
  }
})

onBeforeUnmount(() => {
  clearTimeout(idleTimer)
  clearTimeout(loadGuard)
  if (lipRaf) cancelAnimationFrame(lipRaf)
  try {
    oml2d?.destroy?.()
  } catch (_) {
    /* noop */
  }
})

// AI 说话时，立刻做个反应动作 + 表情，像在认真回应你
watch(
  () => props.speaking,
  (v) => {
    if (status.value !== 'ready') return
    if (v) {
      playRandomMotion()
      playRandomExpression()
    }
  },
)
</script>

<template>
  <div class="stage" :class="{ talking: speaking }" @click="onStageClick">
    <!-- 柔光浮动背景：填补空白、即使 Live2D 没加载也有动效 -->
    <div class="ambient" aria-hidden="true">
      <span class="blob b1"></span>
      <span class="blob b2"></span>
      <span class="blob b3"></span>
      <span class="spark s1"></span>
      <span class="spark s2"></span>
      <span class="spark s3"></span>
      <span class="spark s4"></span>
    </div>

    <div ref="stageRef" class="live2d-host" :class="{ hidden: status === 'fallback' }"></div>

    <!-- 形象/装扮切换（点击它们不触发舞台的「戳一下」） -->
    <div v-if="status === 'ready'" class="stage-actions">
      <button
        class="switch-btn glass"
        :disabled="switching"
        title="换一个形象"
        @click.stop="switchModel"
      >
        <Icon name="refresh" :size="13" />
        {{ switching ? '切换中…' : '换形象' }}
      </button>
      <button
        v-if="hasClothes"
        class="switch-btn glass"
        :disabled="switching"
        title="换一套装扮（同一角色）"
        @click.stop="switchClothes"
      >
        <Icon name="shirt" :size="13" />
        换装
      </button>
    </div>

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
    <div v-else-if="status === 'ready'" class="poke-hint">戳一下我</div>
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
  cursor: pointer;
}

/* 柔光浮动背景 */
.ambient {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
}
.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(42px);
  opacity: 0.55;
  will-change: transform;
}
.blob.b1 {
  width: 280px;
  height: 280px;
  left: -40px;
  top: 6%;
  background: radial-gradient(circle, rgba(255, 143, 180, 0.55), transparent 70%);
  animation: float1 14s ease-in-out infinite;
}
.blob.b2 {
  width: 240px;
  height: 240px;
  right: -30px;
  top: 28%;
  background: radial-gradient(circle, rgba(201, 168, 255, 0.5), transparent 70%);
  animation: float2 18s ease-in-out infinite;
}
.blob.b3 {
  width: 200px;
  height: 200px;
  left: 30%;
  bottom: -20px;
  background: radial-gradient(circle, rgba(255, 190, 210, 0.38), transparent 70%);
  animation: float3 16s ease-in-out infinite;
}
.stage.talking .blob {
  opacity: 0.8;
  filter: blur(36px);
}

/* 上浮的小光点 */
.spark {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 8px rgba(255, 143, 180, 0.9);
  opacity: 0;
  animation: rise 7s linear infinite;
}
.spark.s1 { left: 18%; animation-delay: 0s; }
.spark.s2 { left: 40%; animation-delay: 1.8s; }
.spark.s3 { left: 63%; animation-delay: 3.4s; }
.spark.s4 { left: 82%; animation-delay: 5s; }

.live2d-host {
  position: absolute;
  inset: 0;
  z-index: 1;
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
  z-index: 1;
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
  background: radial-gradient(circle, rgba(255, 143, 180, 0.35), transparent 65%);
  filter: blur(8px);
  animation: breathe 4s ease-in-out infinite;
}
.orb {
  position: relative;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  background: var(--accent-grad);
  box-shadow: 0 20px 60px rgba(255, 143, 180, 0.35), inset 0 4px 20px rgba(255, 255, 255, 0.35);
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
  border: 2px solid rgba(255, 143, 180, 0.5);
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
  z-index: 2;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 16px;
  border-radius: 999px;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.nameplate small {
  font-family: var(--font-ui);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-dim);
  font-weight: 500;
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
  z-index: 2;
  bottom: 64px;
  color: var(--text-faint);
  font-size: 13px;
}

.stage-actions {
  position: absolute;
  z-index: 3;
  top: 14px;
  right: 14px;
  display: flex;
  gap: 8px;
}
.switch-btn {
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  border: 1px solid var(--border);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: opacity 0.18s, transform 0.1s, background 0.18s;
}
.switch-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.switch-btn:active {
  transform: scale(0.95);
}
.switch-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.poke-hint {
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  pointer-events: none;
  animation: hintPulse 3s ease-in-out infinite;
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

@keyframes float1 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(40px, 30px); }
}
@keyframes float2 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-36px, 26px); }
}
@keyframes float3 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(24px, -34px); }
}
@keyframes rise {
  0% { transform: translateY(110%) scale(0.6); opacity: 0; }
  15% { opacity: 0.9; }
  85% { opacity: 0.9; }
  100% { transform: translateY(-20%) scale(1); opacity: 0; }
}
@keyframes hintPulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .blob,
  .spark,
  .poke-hint,
  .halo,
  .orb {
    animation: none;
  }
}
</style>
