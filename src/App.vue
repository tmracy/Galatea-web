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
const stageCollapsed = ref(false)

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
  if (m !== 'companion') stageCollapsed.value = false
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
      'stage-collapsed': stageCollapsed,
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
        <button
          v-if="middleMode === 'companion'"
          class="stage-toggle"
          type="button"
          :aria-expanded="!stageCollapsed"
          :aria-label="stageCollapsed ? '展开角色舞台' : '收起角色舞台'"
          @click="stageCollapsed = !stageCollapsed"
        >
          {{ stageCollapsed ? '＋' : '－' }}
        </button>
      </div>

      <!-- Live2D 用 visibility 隐藏，避免 display:none 导致人物纹理/部件丢失 -->
      <Live2DStage
        class="stage-pane"
        :class="{ off: middleMode !== 'companion' || stageCollapsed }"
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
.stage-toggle {
  display: none;
  width: var(--touch-min);
  height: var(--touch-min);
  border-radius: var(--radius-pill);
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  background: rgba(15, 10, 18, 0.68);
  border: 1px solid var(--border);
  backdrop-filter: blur(10px);
  font-size: 20px;
  line-height: 1;
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
  .app.stage-collapsed {
    grid-template-rows: auto 64px minmax(0, 1fr);
  }
  .col-chat {
    min-height: 0;
  }
  .stage-toolbar {
    top: 10px;
    left: 10px;
  }
  .guide-btn {
    width: var(--touch-min);
    padding: 0;
  }
  .guide-btn span {
    display: none;
  }
  .stage-toggle {
    display: inline-flex;
  }
  .mode-switch button {
    min-height: var(--touch-min);
    padding: 0 12px;
  }
}
</style>
