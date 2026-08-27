<script setup>
import { ref, watch, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const CHAPTERS = [
  { id: 'start', no: '01', title: '开始', nav: '开始' },
  { id: 'chat', no: '02', title: '陪伴', nav: '陪伴' },
  { id: 'memory', no: '03', title: '记住你', nav: '记忆' },
  { id: 'help', no: '04', title: '请她帮忙', nav: '能力' },
  { id: 'voice', no: '05', title: '音色与人设', nav: '音色' },
  { id: 'agent', no: '06', title: '生产力', nav: '生产力' },
  { id: 'emotion', no: '07', title: '情绪', nav: '情绪' },
  { id: 'faq', no: '08', title: '建议与问答', nav: '问答' },
]

const active = ref(0)
const bodyRef = ref(null)
const chapter = computed(() => CHAPTERS[active.value])
const isFirst = computed(() => active.value === 0)
const isLast = computed(() => active.value === CHAPTERS.length - 1)
let prevOverflow = ''

watch(
  () => props.open,
  (on) => {
    if (on) {
      active.value = 0
      prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      nextTick(() => bodyRef.value?.focus())
    } else {
      document.body.style.overflow = prevOverflow
    }
  },
)

watch(active, () => {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = 0
  })
})

function close() {
  emit('close')
}

function go(i) {
  if (i < 0 || i >= CHAPTERS.length) return
  active.value = i
}

function onKey(e) {
  if (!props.open) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    go(active.value + 1)
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    go(active.value - 1)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = prevOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="guide-fade">
      <div
        v-if="open"
        class="veil"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guide-title"
        @click.self="close"
      >
        <div class="book glass">
          <aside class="spine">
            <p class="eyebrow">试用版 · Chrome / Edge</p>
            <h2 id="guide-title">使用指南</h2>
            <p class="lede">把声音还给她之后，这样与她相处。</p>
            <nav class="toc" aria-label="章节">
              <button
                v-for="(c, i) in CHAPTERS"
                :key="c.id"
                type="button"
                :class="{ on: i === active }"
                @click="go(i)"
              >
                <span class="num">{{ c.no }}</span>
                <span>{{ c.nav }}</span>
              </button>
            </nav>
          </aside>

          <div class="leaf">
            <header class="leaf-head">
              <span class="kicker">{{ chapter.no }} · {{ chapter.title }}</span>
              <button class="x" type="button" aria-label="关闭指南" @click="close">
                <Icon name="close" :size="16" />
              </button>
            </header>

            <article ref="bodyRef" class="prose" tabindex="-1">
              <template v-if="chapter.id === 'start'">
                <h3>Galatea</h3>
                <p class="intro">
                  一款语音 AI 伴侣。你可以和角色聊天，她会尽量记住你说过的事；也可以请她查天气、找吃的、查网上的最新信息，或帮忙整理文件夹里的材料，也可以专门找她聊心情。
                </p>
                <p class="whisper">当前为试用版。推荐使用 Chrome 或 Edge。</p>

                <h4>登录</h4>
                <p>打开页面后，先进入登录 / 注册。</p>
                <ul>
                  <li><strong>账号</strong>：自己起一个即可（字母、数字、下划线或连字符，2～32 位），例如 <em>user01</em></li>
                  <li><strong>密码</strong>：自己设定；注册时需输入两次</li>
                </ul>
                <p>每个账号的对话和记忆是分开的。关掉标签页后需要重新登录，记忆仍在账号里。左侧栏底部可以退出。</p>

                <h4>页面怎么看</h4>
                <ul class="layout">
                  <li><strong>左边</strong>：人设（角色）和退出</li>
                  <li><strong>中间</strong>：三种模式——陪伴 / 生产力 / 情绪</li>
                  <li><strong>右边</strong>：对话框（打字、语音、新对话、音色）</li>
                </ul>
                <p>日常聊天用「陪伴」+ 右侧对话框即可。中间会显示角色形象，她说话时嘴型会跟着动。</p>
              </template>

              <template v-else-if="chapter.id === 'chat'">
                <h3>陪伴聊天</h3>
                <p class="intro">默认角色是「明日香」，一位偏姐姐感的陪伴角色。</p>
                <h4>怎么说话</h4>
                <ul>
                  <li>在右侧输入框打字，回车或点「发送」</li>
                  <li>或点 <strong>🎙️</strong> 用语音说，再说一次或再点一下结束；识别出的文字会自动发出</li>
                  <li>回复会逐句出现，并朗读出来</li>
                  <li>不想听声音：点右上角 <strong>🔊</strong>，变成 <strong>🔇</strong> 即静音</li>
                </ul>
                <p>请等她说完再发下一句。试用版暂不支持打断（她说话时插话，不会立刻停下）。</p>
                <p>语音输入请允许浏览器使用麦克风。Safari / Firefox 可能无法语音识别，请改用打字。</p>
              </template>

              <template v-else-if="chapter.id === 'memory'">
                <h3>想让她记住你</h3>
                <p class="intro">直接说清楚即可。聊完后，记得把这一轮交给长期记忆。</p>
                <div class="says">
                  <span>「我叫小明，在做产品设计」</span>
                  <span>「我住上海」</span>
                  <span>「周末喜欢去公园散步」</span>
                </div>
                <p>
                  聊完后，点右上角 <strong>🆕</strong>（开启新对话）。系统会把刚才的对话归档进长期记忆，然后开一个新窗口。
                </p>
                <p class="note">只关网页、不点新对话，她下次可能记不全。</p>
                <p>之后可以问：「我叫什么」「我住哪」，检查她记没记住。</p>
              </template>

              <template v-else-if="chapter.id === 'help'">
                <h3>也可以让她帮忙查</h3>
                <p class="intro">直接用口语说即可。天气、菜谱走专用能力；新闻、公开资料会联网查询。</p>
                <div class="says">
                  <span>「北京明天天气怎么样」</span>
                  <span>「晚上想吃面，有什么简单做法」</span>
                  <span>「中午午饭花了 35 块，帮我记一下」</span>
                  <span>「最近有什么科技新闻」</span>
                </div>
                <p>闲聊和问「你记不记得我」一般不会去网上搜。</p>
                <p class="whisper">回复可能需要几秒到十几秒，属正常现象。</p>
              </template>

              <template v-else-if="chapter.id === 'voice'">
                <h3>克隆音色</h3>
                <p>点右上角 <strong>🎤</strong>：</p>
                <ol>
                  <li>上传一段参考音频（mp3 / m4a / wav / aac）</li>
                  <li>确认克隆</li>
                  <li>成功后会出现「已克隆」，之后用这个声音朗读</li>
                </ol>
                <h4>更换人设</h4>
                <p>左侧可以看到当前角色。若你有一份角色说明文件（<em>skill.md</em>），可点「上传」选用。</p>
                <p>没有自定义文件时，用默认的明日香即可。</p>
              </template>

              <template v-else-if="chapter.id === 'agent'">
                <h3>生产力</h3>
                <p class="intro">整理文件夹里的材料。这条通道和陪伴聊天是分开的。</p>
                <p>中间切到 <strong>生产力</strong>：</p>
                <ol>
                  <li>选择一个文件夹上传（作为要处理的材料）</li>
                  <li>用一句话说清任务，例如：「根据这些笔记写一份会议纪要」</li>
                  <li>完成后如有生成文件，可在回复里下载</li>
                </ol>
                <p class="note">请勿上传机密或含隐私的文件。</p>
              </template>

              <template v-else-if="chapter.id === 'emotion'">
                <h3>情绪陪伴</h3>
                <p class="intro">专门用来聊心情。也可以点页面上的快捷句子。</p>
                <p>这条通道和日常陪伴是分开的，不会把情绪倾诉写进长期记忆。</p>
                <p>姓名、住址、爱好等请在「陪伴」里说，并在结束后点 <strong>🆕</strong> 归档。</p>
              </template>

              <template v-else-if="chapter.id === 'faq'">
                <h3>使用建议</h3>
                <ul>
                  <li>想让她记住的事：说清楚 + 聊完点 新对话</li>
                  <li>语音输入请用 Chrome / Edge，并允许麦克风</li>
                  <li>请勿发送密码、证件号、银行卡等敏感信息</li>
                  <li>试用阶段偶发记错或答慢，可再问一次，或先归档再开新对话</li>
                </ul>
                <h4>常见问题</h4>
                <dl class="faq">
                  <div>
                    <dt>页面能开，但她完全不记得我？</dt>
                    <dd>请确认已登录；聊完后要点右上角新对话进行归档。</dd>
                  </div>
                  <div>
                    <dt>麦克风没反应？</dt>
                    <dd>换 Chrome 或 Edge，允许麦克风权限；也可以直接打字。</dd>
                  </div>
                  <div>
                    <dt>说了名字，下一句还是不知道？</dt>
                    <dd>同一窗口里她通常还记得。若开了新窗口仍不知道，说明上一轮没有成功归档，请再聊一次并点新对话。</dd>
                  </div>
                  <div>
                    <dt>问了新闻，她却像没上网？</dt>
                    <dd>请把问题说具体一些（时间、事件、产品名）。天气请直接问某地天气；问记忆时她不会去网上搜。</dd>
                  </div>
                  <div>
                    <dt>人物形象不显示？</dt>
                    <dd>刷新页面；需要能访问网络以加载形象资源。</dd>
                  </div>
                </dl>
                <p class="whisper end">试用愉快。遇到问题请说明：用的浏览器、是否已登录，以及大概在哪一步卡住。</p>
              </template>
            </article>

            <footer class="leaf-foot">
              <button type="button" class="nav-btn" :disabled="isFirst" @click="go(active - 1)">
                上一章
              </button>
              <button v-if="!isLast" type="button" class="nav-btn primary" @click="go(active + 1)">
                下一章 · {{ CHAPTERS[active + 1].nav }}
              </button>
              <button v-else type="button" class="nav-btn primary" @click="close">
                去见她
              </button>
            </footer>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.veil {
  position: fixed;
  inset: 0;
  z-index: 70;
  display: grid;
  place-items: center;
  padding: 24px 16px;
  background:
    radial-gradient(720px 420px at 78% 8%, rgba(201, 168, 255, 0.22), transparent 60%),
    radial-gradient(640px 380px at 12% 92%, rgba(255, 143, 180, 0.2), transparent 58%),
    rgba(10, 6, 12, 0.62);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.book {
  width: min(920px, 100%);
  height: min(640px, calc(100vh - 48px));
  display: grid;
  grid-template-columns: 232px 1fr;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(165deg, rgba(36, 22, 40, 0.92), rgba(22, 14, 28, 0.94));
}

.spine {
  padding: 28px 22px 22px;
  border-right: 1px solid var(--border);
  background:
    radial-gradient(180px 140px at 20% 0%, rgba(255, 143, 180, 0.16), transparent 70%),
    rgba(255, 255, 255, 0.03);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.eyebrow {
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 600;
}
.spine h2 {
  font-family: var(--font-display);
  font-size: 34px;
  font-weight: 600;
  margin: 8px 0 6px;
  letter-spacing: 0.02em;
}
.lede {
  font-family: 'Noto Serif SC', serif;
  font-size: 13px;
  color: var(--text-dim);
  line-height: 1.65;
  margin-bottom: 22px;
}
.toc {
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
  min-height: 0;
}
.toc button {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 11px;
  text-align: left;
  font-size: 13px;
  color: var(--text-dim);
  transition: background 0.18s, color 0.18s;
}
.toc button:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}
.toc button.on {
  background: rgba(255, 143, 180, 0.16);
  color: #fff;
  box-shadow: inset 0 0 0 1px rgba(255, 143, 180, 0.28);
}
.num {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--accent);
  width: 1.6em;
}

.leaf {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}
.leaf-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px 0;
}
.kicker {
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent-2);
}
.x {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  border: 1px solid transparent;
}
.x:hover {
  color: var(--text);
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--border);
}

.prose {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 18px 28px 8px;
  outline: none;
}
.prose h3 {
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 600;
  margin-bottom: 10px;
}
.prose h4 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  margin: 22px 0 8px;
  color: var(--gold);
}
.prose p,
.prose li,
.prose dd {
  font-size: 14.5px;
  line-height: 1.75;
  color: var(--text-dim);
}
.prose p + p,
.prose ul + p,
.prose ol + p {
  margin-top: 10px;
}
.intro {
  font-family: 'Noto Serif SC', serif;
  font-size: 15.5px !important;
  color: var(--text) !important;
  line-height: 1.8 !important;
}
.whisper {
  font-size: 13px !important;
  color: var(--text-faint) !important;
  font-style: italic;
}
.whisper.end {
  margin-top: 22px;
}
.note {
  padding: 10px 14px;
  border-radius: 12px;
  background: rgba(255, 212, 168, 0.08);
  border: 1px solid rgba(255, 212, 168, 0.22);
  color: var(--gold) !important;
}
.prose ul,
.prose ol {
  margin: 8px 0 0 1.15em;
  display: grid;
  gap: 6px;
}
.prose strong {
  color: var(--text);
  font-weight: 600;
}
.prose em {
  font-style: italic;
  color: var(--accent);
}

.says {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 12px;
}
.says span {
  font-family: 'Noto Serif SC', serif;
  font-size: 13.5px;
  font-style: italic;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 143, 180, 0.12);
  border: 1px solid rgba(255, 196, 214, 0.28);
  color: var(--text);
}

.faq {
  display: grid;
  gap: 12px;
  margin-top: 8px;
}
.faq dt {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 4px;
}
.faq dd {
  padding-left: 0;
}

.leaf-foot {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 22px 18px;
  border-top: 1px solid rgba(255, 196, 214, 0.14);
}
.nav-btn {
  height: 38px;
  padding: 0 16px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-dim);
  border: 1px solid var(--border);
  background: rgba(255, 255, 255, 0.04);
}
.nav-btn:hover:not(:disabled) {
  color: var(--text);
  background: rgba(255, 255, 255, 0.1);
}
.nav-btn:disabled {
  opacity: 0.35;
  cursor: default;
}
.nav-btn.primary {
  color: #fff;
  border: none;
  background: var(--accent-grad);
  box-shadow: 0 6px 18px rgba(255, 143, 180, 0.32);
}

.guide-fade-enter-active,
.guide-fade-leave-active {
  transition: opacity 0.28s ease;
}
.guide-fade-enter-active .book,
.guide-fade-leave-active .book {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.28s ease;
}
.guide-fade-enter-from,
.guide-fade-leave-to {
  opacity: 0;
}
.guide-fade-enter-from .book {
  transform: translateY(16px) scale(0.98);
  opacity: 0;
}
.guide-fade-leave-to .book {
  transform: translateY(8px) scale(0.99);
  opacity: 0;
}

@media (max-width: 760px) {
  .book {
    grid-template-columns: 1fr;
    height: min(720px, calc(100vh - 24px));
  }
  .spine {
    border-right: none;
    border-bottom: 1px solid var(--border);
    padding: 16px 16px 10px;
  }
  .spine h2 {
    font-size: 24px;
  }
  .lede {
    display: none;
  }
  .toc {
    flex-direction: row;
    overflow-x: auto;
    gap: 6px;
  }
  .toc button {
    flex-shrink: 0;
    padding: 6px 10px;
  }
  .toc button .num {
    display: none;
  }
  .prose {
    padding: 12px 18px;
  }
  .prose h3 {
    font-size: 24px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guide-fade-enter-active,
  .guide-fade-leave-active,
  .guide-fade-enter-active .book,
  .guide-fade-leave-active .book {
    transition: none;
  }
}
</style>
