import { ref } from 'vue'

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null

// 当前 TTS 音频的实时响度（0~1），供 Live2D 做嘴型同步（lipSync）。模块级共享，跨组件可读。
export const audioLevel = ref(0)

let _audioCtx = null
let _lipRaf = null

// 给正在播放的 <audio> 接一个分析器，逐帧把响度写进 audioLevel
function startLipSync(audioEl) {
  stopLipSync()
  try {
    _audioCtx =
      _audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    const source = _audioCtx.createMediaElementSource(audioEl)
    const analyser = _audioCtx.createAnalyser()
    analyser.fftSize = 512
    source.connect(analyser)
    analyser.connect(_audioCtx.destination) // 必须接回扬声器，否则没声音
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) {
        const d = (buf[i] - 128) / 128
        sum += d * d
      }
      const rms = Math.sqrt(sum / buf.length)
      audioLevel.value = Math.min(1, rms * 3.5) // 放大一点，张嘴更明显
      _lipRaf = requestAnimationFrame(tick)
    }
    tick()
  } catch (_) {
    // 分析器是可选增强，失败不影响音频播放
    audioLevel.value = 0
  }
}

function stopLipSync() {
  if (_lipRaf) cancelAnimationFrame(_lipRaf)
  _lipRaf = null
  audioLevel.value = 0
}

/**
 * 语音输入：优先用浏览器 Web Speech API（Chrome/Edge 支持中文识别，无需后端）。
 * 不支持时 supported=false，由调用方提示用户改用文本输入或接入后端 ASR。
 */
export function useVoiceInput() {
  const listening = ref(false)
  const partial = ref('')
  const supported = ref(!!SpeechRecognition)
  let recognition = null
  let gotFinal = false // 本轮是否已拿到最终结果，避免 onresult 与 onend 重复回调

  // 彻底销毁旧的识别实例：摘掉回调再 abort，防止残留对象把 listening 卡住
  function _teardown() {
    if (recognition) {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      try {
        recognition.abort()
      } catch (_) {}
      recognition = null
    }
  }

  function start(onFinal) {
    if (!supported.value) return
    // 无论 listening 当前状态如何，先强制清理，保证可重复开始（修复卡在“正在听”）
    _teardown()
    gotFinal = false
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
      if (final && !gotFinal) {
        gotFinal = true
        const text = final.trim()
        stop() // 拿到结果立刻结束本轮，避免继续把 AI 播报声录进来
        onFinal?.(text)
      }
    }
    recognition.onerror = () => {
      listening.value = false
      partial.value = ''
    }
    recognition.onend = () => {
      listening.value = false
      partial.value = ''
    }

    listening.value = true
    partial.value = ''
    try {
      recognition.start()
    } catch (_) {
      // start 抛异常（多为上一轮未完全释放）：复位状态，用户可再次点击
      listening.value = false
      _teardown()
    }
  }

  function stop() {
    listening.value = false // 先复位 UI，杜绝卡在“正在听”
    partial.value = ''
    if (recognition) {
      try {
        recognition.stop()
      } catch (_) {}
    }
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
  let queue = []
  let playing = false

  function toggleMute() {
    muted.value = !muted.value
    if (muted.value) stop()
  }

  function stop() {
    queue = []
    playing = false
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
    stopLipSync()
    speaking.value = false
  }

  function _playNext() {
    if (!queue.length) {
      playing = false
      speaking.value = false
      stopLipSync()
      return
    }
    playing = true
    const url = queue.shift()
    currentAudio = new Audio(url)
    speaking.value = true
    startLipSync(currentAudio)
    currentAudio.onended = () => {
      stopLipSync()
      _playNext()
    }
    currentAudio.onerror = () => {
      stopLipSync()
      _playNext()
    }
    currentAudio.play().catch(() => {
      stopLipSync()
      _playNext()
    })
  }

  /**
   * 逐句排队播放：流式场景每合成好一句音频就入队，按顺序播放不重叠。
   * 传入 audioUrl 走克隆音色；无 audioUrl 时用浏览器 TTS 兜底（其原生队列保证顺序）。
   */
  function enqueue(audioUrl, text) {
    if (muted.value) return
    if (audioUrl) {
      queue.push(audioUrl)
      if (!playing) _playNext()
    } else if (window.speechSynthesis && text) {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'zh-CN'
      u.rate = 1
      u.pitch = 1.05
      speaking.value = true
      u.onend = () => {
        if (!window.speechSynthesis.speaking) speaking.value = false
      }
      window.speechSynthesis.speak(u)
    }
  }

  function speak(text, audioUrl) {
    if (muted.value) return
    stop()
    if (audioUrl) {
      currentAudio = new Audio(audioUrl)
      speaking.value = true
      startLipSync(currentAudio)
      currentAudio.onended = () => {
        stopLipSync()
        speaking.value = false
      }
      currentAudio.onerror = () => {
        stopLipSync()
        speaking.value = false
      }
      currentAudio.play().catch(() => {
        stopLipSync()
        speaking.value = false
      })
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

  return { speaking, muted, toggleMute, speak, enqueue, stop }
}
