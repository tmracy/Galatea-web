import { ref } from 'vue'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null

/**
 * 语音输入：优先用浏览器 Web Speech API（Chrome/Edge 支持中文识别，无需后端）。
 * 不支持时 supported=false，由调用方提示用户改用文本输入或接入后端 ASR。
 */
export function useVoiceInput() {
  const listening = ref(false)
  const partial = ref('')
  const supported = ref(!!SpeechRecognition)
  let recognition = null

  function start(onFinal) {
    if (!supported.value) return
    if (listening.value) return
    recognition = new SpeechRecognition()
    recognition.lang = 'zh-CN'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) final += t
        else interim += t
      }
      partial.value = interim || final
      if (final) onFinal?.(final.trim())
    }
    recognition.onerror = () => {
      listening.value = false
    }
    recognition.onend = () => {
      listening.value = false
      partial.value = ''
    }

    listening.value = true
    partial.value = ''
    recognition.start()
  }

  function stop() {
    if (recognition && listening.value) recognition.stop()
  }

  return { listening, partial, supported, start, stop }
}

/**
 * 语音输出：后端返回 audioUrl 时直接播放；否则用浏览器 SpeechSynthesis 朗读（兜底）。
 */
export function useVoiceOutput() {
  const speaking = ref(false)
  const muted = ref(false)
  let currentAudio = null

  function toggleMute() {
    muted.value = !muted.value
    if (muted.value) stop()
  }

  function stop() {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    speaking.value = false
  }

  function speak(text, audioUrl) {
    if (muted.value) return
    stop()
    if (audioUrl) {
      currentAudio = new Audio(audioUrl)
      speaking.value = true
      currentAudio.onended = () => (speaking.value = false)
      currentAudio.onerror = () => (speaking.value = false)
      currentAudio.play().catch(() => (speaking.value = false))
      return
    }
    if (window.speechSynthesis && text) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = 1
      u.pitch = 1.05
      u.onend = () => (speaking.value = false)
      u.onerror = () => (speaking.value = false)
      speaking.value = true
      window.speechSynthesis.speak(u)
    }
  }

  return { speaking, muted, toggleMute, speak, stop }
}
