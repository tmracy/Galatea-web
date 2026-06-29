<script setup>
import { ref } from 'vue'
import { useAuth } from '../composables/useAuth.js'
import { checkSessionId } from '../api/index.js'

const emit = defineEmits(['success'])

const mode = ref('login') // login | register
const sessionId = ref('')
const password = ref('')
const password2 = ref('')
const loading = ref(false)
const error = ref('')

const { login, register } = useAuth()

const SESSION_HINT = '字母、数字、下划线、连字符，2~32 位'

async function submit() {
  error.value = ''
  const id = sessionId.value.trim()
  const pwd = password.value

  if (!id || !pwd) {
    error.value = '请填写 session_id 和密码'
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
        error.value = '该 session_id 已被占用，请换一个'
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
  <div class="gate">
    <div class="card glass">
      <div class="logo">G</div>
      <h1>Galatea</h1>
      <p class="sub">语音 AI 伴侣 · 请先登录或注册</p>

      <div class="tabs">
        <button :class="{ active: mode === 'login' }" @click="switchMode('login')">登录</button>
        <button :class="{ active: mode === 'register' }" @click="switchMode('register')">注册</button>
      </div>

      <form class="form" @submit.prevent="submit">
        <label>
          <span>Session ID</span>
          <input
            v-model="sessionId"
            type="text"
            placeholder="你的唯一用户名，如 alice_01"
            autocomplete="username"
          />
          <small>{{ SESSION_HINT }}</small>
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

      <p class="note">
        session_id 用于区分用户与记忆数据；重复校验由服务端完成，请勿与他人共用。
      </p>
    </div>
  </div>
</template>

<style scoped>
.gate {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.card {
  width: 100%;
  max-width: 400px;
  padding: 32px 28px;
  border-radius: var(--radius);
  text-align: center;
}
.logo {
  width: 52px;
  height: 52px;
  margin: 0 auto 12px;
  border-radius: 14px;
  background: var(--accent-grad);
  display: grid;
  place-items: center;
  font-size: 26px;
  font-weight: 800;
  color: #fff;
}
h1 {
  font-size: 22px;
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
  font-weight: 600;
  font-size: 15px;
  margin-top: 4px;
}
.submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.note {
  margin-top: 18px;
  font-size: 11px;
  color: var(--text-faint);
  line-height: 1.5;
}
</style>
