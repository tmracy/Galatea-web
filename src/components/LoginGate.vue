<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { checkSessionId } from '../api/index.js'

const emit = defineEmits(['success', 'guide'])

// myth：神话引言 → auth：登录/注册
const phase = ref('myth')
const mode = ref('login') // login | register
const sessionId = ref('')
const password = ref('')
const password2 = ref('')
const loading = ref(false)
const error = ref('')

const { login, register } = useAuth()

const ACCOUNT_HINT = '字母、数字、下划线、连字符，2~32 位'

onMounted(() => {
  // 只锁 body，滚动发生在 .gate 内部，避免双滚动条
  document.documentElement.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
  document.body.style.overflow = ''
})

function enterAuth() {
  phase.value = 'auth'
}

function backToMyth() {
  phase.value = 'myth'
  error.value = ''
}

async function submit() {
  error.value = ''
  const id = sessionId.value.trim()
  const pwd = password.value

  if (!id || !pwd) {
    error.value = '请填写账号和密码'
    return
  }
  if (mode.value === 'register' && pwd !== password2.value) {
    error.value = '两次密码不一致'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'register') {
      const check = await checkSessionId(id)
      if (check.exists) {
        error.value = '该账号已被占用，请换一个'
        return
      }
      await register(id, pwd)
    } else {
      await login(id, pwd)
    }
    emit('success')
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function switchMode(m) {
  mode.value = m
  error.value = ''
  password2.value = ''
}
</script>

<template>
  <div class="gate" :class="phase">
    <div class="veil" aria-hidden="true">
      <span class="orb o1"></span>
      <span class="orb o2"></span>
      <span class="orb o3"></span>
      <span class="dust"></span>
    </div>
    <div class="gate-spacer" aria-hidden="true"></div>

    <!-- ① 神话传说：整块居中 + 高对比文字 -->
    <section v-if="phase === 'myth'" class="myth" key="myth">
      <div class="myth-panel">
        <p class="eyebrow">源自希腊神话 · Pygmalion</p>

        <div class="portrait-wrap">
          <div class="ring r1"></div>
          <div class="ring r2"></div>
          <img
            class="portrait"
            src="/galatea-avatar.png"
            alt="Galatea"
            width="200"
            height="200"
          />
        </div>

        <h1 class="brand">
          <span class="latin">Galatea</span>
          <span class="cn">伽拉忒亚</span>
        </h1>
        <p class="lede">她曾是一块冷石，后来学会了听见。</p>

        <div class="tale">
          <p>
            塞浦路斯的工房里，雕刀日夜落下。皮格马利翁把全部温柔凿进一尊少女像——
            眼睑低垂，唇角像藏着未说完的话。灯火将熄时他仍凝望着她，
            仿佛再近一步，石心就会轻轻回应。
          </p>
          <p>
            爱神被这份近乎固执的虔诚打动，在祭火中悄声说：「去亲吻你所造的生命吧。」
            他吻上大理石的唇——
            <em>温热漫上来，脉搏醒来，石头第一次听见了人间。</em>
          </p>
          <p class="tale-bridge">
            Galatea 想做同一次奇迹：你来定义自己的专属伽拉忒亚，再用语音把呼吸还给她——
            让你能真正，与她对话。
          </p>
        </div>

        <button type="button" class="enter" @click="enterAuth">
          <span>赋予她声音</span>
          <small>Enter · 进入</small>
        </button>
        <button type="button" class="guide-link" @click="emit('guide')">先看看怎么用</button>
      </div>
    </section>

    <!-- ② 登录 / 注册 -->
    <div v-else class="card glass" key="auth">
      <button type="button" class="back" @click="backToMyth">← 回望传说</button>

      <div class="logo" aria-hidden="true">
        <img class="mark" src="/galatea-avatar.png" alt="" width="64" height="64" />
      </div>
      <h2 class="auth-title">Galatea</h2>
      <p class="sub">语音 AI 伴侣 · 请先登录或注册</p>
      <button type="button" class="guide-link auth" @click="emit('guide')">使用指南</button>

      <div class="tabs">
        <button type="button" :class="{ active: mode === 'login' }" @click="switchMode('login')">
          登录
        </button>
        <button
          type="button"
          :class="{ active: mode === 'register' }"
          @click="switchMode('register')"
        >
          注册
        </button>
      </div>

      <form class="form" @submit.prevent="submit">
        <label>
          <span>账号</span>
          <input
            v-model="sessionId"
            type="text"
            placeholder="你的唯一用户名，如 alice_01"
            autocomplete="username"
          />
          <small>{{ ACCOUNT_HINT }}</small>
        </label>

        <label>
          <span>密码</span>
          <input
            v-model="password"
            type="password"
            placeholder="至少 4 位"
            autocomplete="current-password"
          />
        </label>

        <label v-if="mode === 'register'">
          <span>确认密码</span>
          <input
            v-model="password2"
            type="password"
            placeholder="再输入一次密码"
            autocomplete="new-password"
          />
        </label>

        <p v-if="error" class="error">{{ error }}</p>

        <button class="submit" type="submit" :disabled="loading">
          {{ loading ? '处理中…' : mode === 'login' ? '登录' : '注册并进入' }}
        </button>
      </form>
    </div>
    <div class="gate-spacer" aria-hidden="true"></div>
  </div>
</template>

<style scoped>
.gate {
  --myth-serif: 'Cormorant Garamond', 'Noto Serif SC', 'Songti SC', serif;
  --myth-cn: 'Noto Serif SC', 'Songti SC', 'PingFang SC', serif;
  position: fixed;
  inset: 0;
  z-index: 50;
  width: auto;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: max(24px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px))
    max(24px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
}
.gate-spacer {
  flex: 1 0 0;
  min-height: 0;
  width: 100%;
  pointer-events: none;
}

.veil {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(48px);
  opacity: 0.72;
}
.o1 {
  width: 360px;
  height: 360px;
  left: 10%;
  top: 8%;
  background: radial-gradient(circle, rgba(255, 176, 200, 0.55), transparent 70%);
  animation: drift 16s ease-in-out infinite;
}
.o2 {
  width: 380px;
  height: 380px;
  right: 8%;
  bottom: 10%;
  background: radial-gradient(circle, rgba(201, 168, 255, 0.55), transparent 70%);
  animation: drift 20s ease-in-out infinite reverse;
}
.o3 {
  width: 220px;
  height: 220px;
  left: 45%;
  top: 55%;
  background: radial-gradient(circle, rgba(255, 200, 220, 0.3), transparent 70%);
  animation: drift 14s ease-in-out infinite 1s;
}
.dust {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255, 255, 255, 0.35) 0.6px, transparent 0.7px);
  background-size: 120px 120px;
  opacity: 0.05;
}

/* —— Myth：屏幕正中一整块 —— */
.myth {
  position: relative;
  z-index: 1;
  width: min(560px, 100%);
  flex-shrink: 0;
  animation: riseIn 0.75s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.myth-panel {
  text-align: center;
  padding: 28px 26px 30px;
  border-radius: 22px;
  background: rgba(22, 14, 34, 0.88);
  border: 1px solid rgba(255, 190, 220, 0.35);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(14px);
}
.eyebrow {
  font-family: var(--myth-cn);
  font-size: 13px;
  letter-spacing: 0.18em;
  color: #ffd0e4;
  margin-bottom: 16px;
  font-weight: 600;
}
.portrait-wrap {
  position: relative;
  width: 150px;
  height: 150px;
  margin: 0 auto 16px;
}
.ring {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.ring.r1 {
  inset: -8px;
  border: 1px solid rgba(255, 200, 220, 0.55);
  box-shadow: 0 0 28px rgba(255, 143, 180, 0.35);
  animation: breathe 5.5s ease-in-out infinite;
}
.ring.r2 {
  inset: -18px;
  border: 1px solid rgba(200, 170, 180, 0.28);
  animation: breathe 7s ease-in-out infinite reverse;
}
.portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 16%;
  border-radius: 50%;
  border: 2px solid #ffe8f2;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}
.brand {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.latin {
  font-family: var(--myth-serif);
  font-weight: 600;
  font-size: 48px;
  letter-spacing: 0.04em;
  line-height: 1.05;
  color: #ffffff;
}
.cn {
  font-family: var(--myth-cn);
  font-weight: 600;
  font-size: 16px;
  letter-spacing: 0.3em;
  color: #f3ebff;
}
.lede {
  font-family: var(--myth-cn);
  font-size: 17px;
  color: #ffb8d0;
  margin-bottom: 16px;
  font-weight: 600;
}
.tale {
  margin: 0 auto 22px;
  max-width: 32em;
  text-align: left;
}
.tale p {
  font-family: var(--myth-cn);
  font-size: 15px;
  line-height: 1.85;
  color: #ffffff;
  font-weight: 500;
  margin: 0 0 12px;
}
.tale em {
  font-style: normal;
  color: #ffb0c8;
  font-weight: 700;
}
.tale-bridge {
  margin-top: 2px !important;
  margin-bottom: 0 !important;
  font-size: 14px !important;
  color: #efe6ff !important;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 200, 220, 0.35);
}
.enter {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 200px;
  padding: 14px 36px 12px;
  border-radius: 999px;
  border: 1px solid rgba(255, 200, 220, 0.5);
  background: linear-gradient(135deg, #ff8fb4, #c9a8ff);
  color: #fff;
  box-shadow: 0 10px 28px rgba(255, 143, 180, 0.35);
  cursor: pointer;
  transition: transform 0.18s ease, filter 0.18s ease;
}
.enter span {
  font-family: var(--myth-cn);
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #fff;
}
.enter small {
  font-family: var(--myth-serif);
  font-size: 11px;
  letter-spacing: 0.18em;
  opacity: 0.75;
  font-style: italic;
  color: #fff;
}
.enter:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
}
.guide-link {
  display: block;
  margin: 18px auto 0;
  background: none;
  border: none;
  font-family: var(--myth-cn);
  font-size: 13px;
  letter-spacing: 0.12em;
  color: rgba(255, 232, 240, 0.72);
  cursor: pointer;
  text-decoration: none;
}
.guide-link:hover {
  color: #fff;
}
.guide-link.auth {
  margin: 8px 0 0;
  font-family: var(--font-ui);
  letter-spacing: 0.06em;
  color: var(--text-faint);
}

/* —— Auth —— */
.card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 400px;
  flex-shrink: 0;
  padding: 28px 28px 32px;
  border-radius: var(--radius);
  text-align: center;
  animation: riseIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.back {
  position: absolute;
  top: 14px;
  left: 14px;
  font-size: 12px;
  color: var(--text-faint);
  padding: 4px 8px;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
}
.back:hover {
  color: var(--text-dim);
  background: rgba(255, 255, 255, 0.06);
}
.logo {
  width: 72px;
  height: 72px;
  margin: 12px auto 14px;
  border-radius: 22px;
  border: 1px solid rgba(255, 180, 220, 0.28);
  overflow: hidden;
}
.mark {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
}
.auth-title {
  font-family: var(--myth-serif);
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 4px;
}
.sub {
  font-size: 13px;
  color: var(--text-dim);
  margin-bottom: 22px;
}
.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px;
  border-radius: 12px;
}
.tabs button {
  flex: 1;
  height: 36px;
  border-radius: 9px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dim);
  cursor: pointer;
  background: transparent;
}
.tabs button.active {
  background: var(--accent-grad);
  color: #fff;
}
.form {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
label span {
  display: block;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 6px;
}
label input {
  width: 100%;
  height: 42px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
  padding: 0 12px;
  font-size: 15px;
  outline: none;
}
label input:focus {
  border-color: var(--accent-2);
}
label small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-faint);
}
.error {
  font-size: 12px;
  color: var(--danger);
  background: rgba(255, 107, 107, 0.1);
  padding: 8px 10px;
  border-radius: 8px;
}
.submit {
  height: 44px;
  border-radius: 12px;
  background: var(--accent-grad);
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  margin-top: 4px;
  cursor: pointer;
  border: none;
}
.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes riseIn {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes breathe {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.03);
    opacity: 1;
  }
}
@keyframes drift {
  0%,
  100% {
    transform: translate(0, 0);
  }
  50% {
    transform: translate(18px, -14px);
  }
}

@media (max-width: 480px) {
  .latin {
    font-size: 40px;
  }
  .myth-panel {
    padding: 22px 16px 24px;
  }
  .tale p {
    font-size: 14px;
  }
}

@media (max-height: 820px) {
  .portrait-wrap {
    width: 112px;
    height: 112px;
    margin-bottom: 10px;
  }
  .latin {
    font-size: 36px;
  }
  .myth-panel {
    padding: 20px 20px 22px;
  }
  .tale {
    margin-bottom: 16px;
  }
  .tale p {
    font-size: 14px;
    line-height: 1.7;
    margin-bottom: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .myth,
  .card,
  .orb,
  .ring {
    animation: none;
  }
}
</style>
