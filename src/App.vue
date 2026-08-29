<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import SkillSidebar from './components/SkillSidebar.vue'
import Live2DStage from './components/Live2DStage.vue'
import AgentPanel from './components/AgentPanel.vue'
import EmotionPanel from './components/EmotionPanel.vue'
import ChatPanel from './components/ChatPanel.vue'
import LoginGate from './components/LoginGate.vue'
import UserGuide from './components/UserGuide.vue'
import Icon from './components/Icon.vue'
import { useAuth } from './composables/useAuth.js'
import { skillDisplayName } from './utils/skillName.js'

const GUIDE_KEY = 'galatea_guide_seen'

const speaking = ref(false)
const activeSkill = ref({ id: 'hh', name: '明日香' })
const middleMode = ref('companion') // companion | agent | emotion
const guideOpen = ref(false)

const { isLoggedIn, currentSessionId, logout } = useAuth()

watch(isLoggedIn, (on) => {
  if (on && !localStorage.getItem(GUIDE_KEY)) guideOpen.value = true
}, { immediate: true })

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

// Live2D 不能用 display:none，切回陪伴时触发 resize 以免画布尺寸错乱
watch(middleMode, (m) => {
  if (m === 'companion') {
    nextTick(() => window.dispatchEvent(new Event('resize')))
  }
})
</script>

<template>
  <LoginGate v-if="!isLoggedIn" @success="() => {}" @guide="openGuide" />
  <div v-else class="app" :class="{ 'focus-stage': middleMode !== 'companion' }">
    <SkillSidebar
      class="col-skill"
      :session-id="sessionId"
      @activate="onActivate"
      @logout="logout"
      @guide="openGuide"
    />

    <main class="col-stage glass">
      <button class="guide-fab" type="button" title="使用指南" aria-label="打开使用指南" @click="openGuide">
        <Icon name="book" :size="16" />
      </button>
      <div class="mode-switch">
        <button
          :class="{ on: middleMode === 'companion' }"
          @click="middleMode = 'companion'"
        >
          陪伴
        </button>
        <button
          :class="{ on: middleMode === 'agent' }"
          @click="middleMode = 'agent'"
        >
          生产力
        </button>
        <button
          :class="{ on: middleMode === 'emotion' }"
          @click="middleMode = 'emotion'"
        >
          情绪
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
    </main>

    <section v-show="middleMode === 'companion'" class="col-chat">
      <ChatPanel
        :session-id="sessionId"
        :skill-name="displaySkillName"
        :active="middleMode === 'companion'"
        @speaking="(v) => (speaking = v)"
      />
    </section>
  </div>
  <UserGuide :open="guideOpen" @close="closeGuide" />
</template>

<style scoped>
.app {
  height: 100%;
  width: 100%;
  max-height: 100%;
  display: grid;
  grid-template-columns: 268px 1fr 400px;
  gap: 14px;
  padding: 14px;
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
  border-radius: var(--radius);
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
.guide-fab {
  position: absolute;
  z-index: 6;
  top: 14px;
  right: 14px;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: var(--text-dim);
  background: rgba(12, 8, 10, 0.45);
  border: 1px solid var(--border);
  backdrop-filter: blur(14px);
  transition: color 0.18s, background 0.18s, box-shadow 0.18s;
}
.guide-fab:hover {
  color: #fff;
  background: rgba(255, 143, 180, 0.22);
  box-shadow: 0 6px 18px rgba(255, 143, 180, 0.28);
}
.mode-switch {
  position: absolute;
  z-index: 5;
  top: 14px;
  left: 14px;
  display: flex;
  gap: 3px;
  padding: 3px;
  border-radius: 999px;
  background: rgba(12, 8, 10, 0.45);
  border: 1px solid var(--border);
  backdrop-filter: blur(14px);
}
.mode-switch button {
  padding: 7px 13px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--text-dim);
  transition: color 0.18s, background 0.18s, box-shadow 0.18s;
}
.mode-switch button.on {
  color: #fff;
  background: var(--accent-grad);
  box-shadow: 0 4px 16px rgba(255, 143, 180, 0.35);
}
.col-chat {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.app.focus-stage {
  grid-template-columns: 268px 1fr;
}

@media (max-width: 1100px) {
  .app {
    grid-template-columns: 232px 1fr 340px;
    gap: 12px;
    padding: 12px;
  }
  .app.focus-stage {
    grid-template-columns: 232px 1fr;
  }
}
@media (max-width: 880px) {
  .app {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(180px, 30vh) minmax(0, 1fr);
    gap: 10px;
    padding: 10px;
    height: 100%;
    min-height: 0;
    overflow: hidden;
  }
  .app.focus-stage {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .col-chat {
    min-height: 0;
  }
}
</style>
