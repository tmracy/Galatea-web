import { ref, computed } from 'vue'
import { loginSession, registerSession } from '../api/index.js'

const STORAGE_KEY = 'galatea_session'

const sessionId = ref('')
const loggedIn = ref(false)

function loadFromStorage() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    if (data?.sessionId) {
      sessionId.value = data.sessionId
      loggedIn.value = true
    }
  } catch (_) {
    /* noop */
  }
}

loadFromStorage()

export function useAuth() {
  const isLoggedIn = computed(() => loggedIn.value)
  const currentSessionId = computed(() => sessionId.value)

  function persist(id) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: id }))
  }

  async function login(id, password) {
    await loginSession({ sessionId: id, password })
    sessionId.value = id
    loggedIn.value = true
    persist(id)
  }

  async function register(id, password) {
    await registerSession({ sessionId: id, password })
    sessionId.value = id
    loggedIn.value = true
    persist(id)
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionId.value = ''
    loggedIn.value = false
  }

  return {
    isLoggedIn,
    currentSessionId,
    login,
    register,
    logout,
  }
}
