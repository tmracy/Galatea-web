<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import SkillSidebar from './components/SkillSidebar.vue'
import Live2DStage from './components/Live2DStage.vue'
import AgentPanel from './components/AgentPanel.vue'
import EmotionPanel from './components/EmotionPanel.vue'
import LifePanel from './components/LifePanel.vue'
import ChatPanel from './components/ChatPanel.vue'
import LoginGate from './components/LoginGate.vue'
import UserGuide from './components/UserGuide.vue'
import Icon from './components/Icon.vue'
import { useAuth } from './composables/useAuth.js'
import { getLifeReply } from './api/index.js'
import { skillDisplayName } from './utils/skillName.js'

const GUIDE_KEY = 'galatea_guide_seen'

const speaking = ref(false)
const activeSkill = ref({ id: 'hh', name: '明日香' })
const middleMode = ref('companion') // companion | life | agent | emotion
const guideOpen = ref(false)
const mobileView = ref('companion') // role | companion | life | agent | emotion

const { isLoggedIn, currentSessionId, logout } = useAuth()
const inboxReply = ref('')

watch(isLoggedIn, (on) => {
  if (on && !localStorage.getItem(GUIDE_KEY)) guideOpen.value = true
}, { immediate: true })

watch(
  () => [isLoggedIn.value, currentSessionId.value],
  async ([on, id]) => {
    if (!on || !id) {
      inboxReply.value = ''
      return
    }
    try {
      const data = await getLifeReply({ sessionId: id })
      inboxReply.value = data?.reply || ''
    } catch (_) {
      inboxReply.value = ''
    }
  },
  { immediate: true },
)

function openGuide() {
  guideOpen.value = true
}

function closeGuide() {
  guideOpen.value = false
  localStorage.setItem(GUIDE_KEY, '1')
}

const displaySkillName = computed(() => skillDisplayName(activeSkill.value))

// 用户 session_id（记忆/数据隔离）；与 Skill 人设 id 分开
const sessionId = computed(() => currentSessionId.value)

function onActivate(skill) {
  activeSkill.value = skill
  // 不再用 skill.id 覆盖用户 session_id
}

function setMobileView(view) {
  mobileView.value = view
  middleMode.value =
    view === 'life'
      ? 'life'
      : view === 'agent'
        ? 'agent'
        : view === 'emotion'
          ? 'emotion'
          : 'companion'
  if (view === 'role') {
    nextTick(() => window.dispatchEvent(new Event('resize')))
  }
}

// Live2D 不能用 display:none，切回陪伴时触发 resize 以免画布尺寸错乱
watch(middleMode, (m) => {
  if (m === 'life') mobileView.value = 'life'
  else if (m === 'agent') mobileView.value = 'agent'
  else if (m === 'emotion') mobileView.value = 'emotion'
  else if (mobileView.value !== 'role') mobileView.value = 'companion'
  if (m === 'companion') {
    nextTick(() => window.dispatchEvent(new Event('resize')))
  }
})
</script>

<template>
  <LoginGate v-if="!isLoggedIn" @success="() => {}" @guide="openGuide" />
  <div
    v-else
    class="app"
    :class="{
      'focus-stage': middleMode !== 'companion',
      [`mobile-${mobileView}`]: true,
    }"
  >
    <SkillSidebar
      class="col-skill"
      :session-id="sessionId"
      @activate="onActivate"
      @logout="logout"
      @guide="openGuide"
    />

    <main class="col-stage glass">
      <div class="stage-toolbar">
        <div class="mode-switch" role="group" aria-label="功能模式">
          <button
            :class="{ on: middleMode === 'companion' }"
            :aria-pressed="middleMode === 'companion'"
            @click="middleMode = 'companion'"
          >
            陪伴
          </button>
          <button
            :class="{ on: middleMode === 'life' }"
            :aria-pressed="middleMode === 'life'"
            @click="middleMode = 'life'"
          >
            生活
          </button>
          <button
            :class="{ on: middleMode === 'agent' }"
            :aria-pressed="middleMode === 'agent'"
            @click="middleMode = 'agent'"
          >
            生产力
          </button>
          <button
            :class="{ on: middleMode === 'emotion' }"
            :aria-pressed="middleMode === 'emotion'"
            @click="middleMode = 'emotion'"
          >
            情绪
          </button>
        </div>
        <button class="guide-btn" type="button" title="使用指南" aria-label="打开使用指南" @click="openGuide">
          <Icon name="book" :size="15" />
          <span>指南</span>
        </button>
      </div>

      <!-- Live2D 用 visibility 隐藏，避免 display:none 导致人物纹理/部件丢失 -->
      <Live2DStage
        class="stage-pane"
        :class="{ off: middleMode !== 'companion' }"
        :speaking="speaking"
        :name="displaySkillName"
      />
      <AgentPanel
        v-show="middleMode === 'agent'"
        class="stage-pane"
        :session-id="sessionId"
      />
      <EmotionPanel
        v-show="middleMode === 'emotion'"
        class="stage-pane"
        :session-id="sessionId"
      />
      <LifePanel
        v-show="middleMode === 'life'"
        class="stage-pane"
        :session-id="sessionId"
        :active="middleMode === 'life'"
      />
    </main>

    <section v-show="middleMode === 'companion'" class="col-chat">
      <ChatPanel
        :session-id="sessionId"
        :skill-name="displaySkillName"
        :active="middleMode === 'companion'"
        :inbox-reply="inboxReply"
        @speaking="(v) => (speaking = v)"
      />
    </section>

    <nav class="mobile-nav" aria-label="主要功能">
      <button
        type="button"
        :class="{ on: mobileView === 'role' }"
        :aria-current="mobileView === 'role' ? 'page' : undefined"
        @click="setMobileView('role')"
      >
        <Icon name="spark" :size="20" />
        <span>角色</span>
      </button>
      <button
        type="button"
        :class="{ on: mobileView === 'companion' }"
        :aria-current="mobileView === 'companion' ? 'page' : undefined"
        @click="setMobileView('companion')"
      >
        <Icon name="message" :size="20" />
        <span>陪伴</span>
      </button>
      <button
        type="button"
        :class="{ on: mobileView === 'life' }"
        :aria-current="mobileView === 'life' ? 'page' : undefined"
        @click="setMobileView('life')"
      >
        <Icon name="calendar" :size="20" />
        <span>生活</span>
      </button>
      <button
        type="button"
        :class="{ on: mobileView === 'agent' }"
        :aria-current="mobileView === 'agent' ? 'page' : undefined"
        @click="setMobileView('agent')"
      >
        <Icon name="zap" :size="20" />
        <span>生产力</span>
      </button>
      <button
        type="button"
        :class="{ on: mobileView === 'emotion' }"
        :aria-current="mobileView === 'emotion' ? 'page' : undefined"
        @click="setMobileView('emotion')"
      >
        <Icon name="heart" :size="20" />
        <span>情绪</span>
      </button>
    </nav>
  </div>
  <UserGuide :open="guideOpen" @close="closeGuide" />
</template>

<style scoped>
.app {
  height: 100%;
  width: 100%;
  max-height: 100%;
  display: grid;
  grid-template-columns: minmax(210px, 17vw) minmax(0, 1fr) minmax(320px, 27vw);
  gap: clamp(10px, 1vw, 16px);
  padding: max(clamp(10px, 1vw, 16px), env(safe-area-inset-top, 0px))
    max(clamp(10px, 1vw, 16px), env(safe-area-inset-right, 0px))
    max(clamp(10px, 1vw, 16px), env(safe-area-inset-bottom, 0px))
    max(clamp(10px, 1vw, 16px), env(safe-area-inset-left, 0px));
  overflow: hidden;
  box-sizing: border-box;
}
.col-skill {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.col-stage {
  position: relative;
  border-radius: var(--radius-lg);
  overflow: hidden;
  min-width: 0;
  min-height: 0;
}
.stage-pane {
  position: absolute;
  inset: 0;
}
.stage-pane.off {
  visibility: hidden;
  pointer-events: none;
}
.stage-toolbar {
  position: absolute;
  z-index: 6;
  top: 14px;
  left: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.guide-btn {
  min-width: var(--touch-min);
  min-height: var(--touch-min);
  padding: 0 13px;
  border-radius: var(--radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-dim);
  background: rgba(15, 10, 18, 0.68);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
  transition: color 0.18s, background 0.18s, box-shadow 0.18s;
}
.guide-btn:hover {
  color: #fff;
  background: var(--surface-2);
}
.mode-switch {
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: rgba(15, 10, 18, 0.68);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
}
.mode-switch button {
  min-height: var(--touch-min);
  padding: 0 14px;
  border-radius: var(--radius-pill);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  transition: color 0.18s, background 0.18s, box-shadow 0.18s;
}
.mode-switch button.on {
  color: #fff;
  background: rgba(243, 142, 175, 0.2);
  box-shadow: inset 0 0 0 1px var(--border-strong);
}
.col-chat {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.mobile-nav {
  display: none;
}

.app.focus-stage {
  grid-template-columns: minmax(210px, 17vw) minmax(0, 1fr);
}

@media (max-width: 1100px) {
  .app {
    grid-template-columns: 210px minmax(0, 1fr) 320px;
  }
  .app.focus-stage {
    grid-template-columns: 210px minmax(0, 1fr);
  }
  .guide-btn {
    width: var(--touch-min);
    padding: 0;
  }
  .guide-btn span {
    display: none;
  }
  .mode-switch button {
    padding: 0 10px;
  }
}
@media (max-width: 880px) {
  .app {
    position: relative;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
    gap: 0;
    padding: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .app.focus-stage {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) auto;
  }
  .col-skill,
  .col-stage,
  .col-chat {
    grid-column: 1;
  }
  .col-skill {
    display: none;
  }
  .col-stage {
    position: absolute;
    inset: 0 0 64px;
    border: 0;
    border-radius: 0;
    visibility: hidden;
    pointer-events: none;
  }
  .col-chat {
    display: none;
    grid-row: 1;
    min-height: 0;
  }
  .mobile-companion .col-chat {
    display: flex;
  }
  .app.mobile-role {
    grid-template-rows: auto minmax(0, 1fr) auto;
  }
  .mobile-role .col-skill {
    display: block;
    grid-row: 1;
  }
  .mobile-role .col-stage,
  .mobile-life .col-stage,
  .mobile-agent .col-stage,
  .mobile-emotion .col-stage {
    position: relative;
    inset: auto;
    grid-row: 1;
    visibility: visible;
    pointer-events: auto;
  }
  .mobile-role .col-stage {
    grid-row: 2;
  }
  .stage-toolbar {
    display: none;
  }
  .mobile-nav {
    position: relative;
    z-index: 20;
    grid-column: 1;
    grid-row: -2 / -1;
    min-height: calc(64px + env(safe-area-inset-bottom, 0px));
    padding: 6px 10px max(6px, env(safe-area-inset-bottom, 0px));
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    align-items: start;
    background: rgba(17, 11, 20, 0.96);
    border-top: 1px solid var(--border);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .mobile-nav button {
    min-width: 0;
    min-height: 52px;
    border-radius: var(--radius-sm);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    color: var(--text-faint);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.03em;
  }
  .mobile-nav button.on {
    color: #f6bfd3;
    background: var(--accent-soft);
  }
  .mobile-nav button:active {
    transform: scale(0.96);
  }
}
</style>
