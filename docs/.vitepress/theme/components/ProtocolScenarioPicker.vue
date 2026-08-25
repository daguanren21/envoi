<script setup lang="ts">
interface LocalizedCopy {
  en: string;
  zh: string;
}

interface ScenarioOption {
  key: string;
  label: LocalizedCopy;
  summary: LocalizedCopy;
  status: number;
}

interface Props {
  items: readonly ScenarioOption[];
  selectedKey: string;
  lang: "en" | "zh";
  disabled: boolean;
  label: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  select: [key: string];
}>();
</script>

<template>
  <div class="scenario-picker" role="group" :aria-label="props.label">
    <button
      v-for="(scenario, index) in props.items"
      :key="scenario.key"
      class="scenario-picker__item"
      type="button"
      :aria-pressed="props.selectedKey === scenario.key"
      :disabled="props.disabled"
      @click="emit('select', scenario.key)"
    >
      <span class="scenario-picker__index">0{{ index + 1 }}</span>
      <span class="scenario-picker__copy">
        <strong>{{ scenario.label[props.lang] }}</strong>
        <small>{{ scenario.summary[props.lang] }}</small>
      </span>
      <code>HTTP {{ scenario.status }}</code>
    </button>
  </div>
</template>

<style scoped>
.scenario-picker {
  display: grid;
  grid-template-columns: repeat(5, minmax(108px, 1fr));
  gap: 7px;
  overflow-x: auto;
  padding: 4px;
  scrollbar-width: thin;
}

.scenario-picker__item {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 104px;
  flex-direction: column;
  justify-content: space-between;
  gap: 9px;
  padding: 13px 11px;
  overflow: hidden;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 14px;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-chip);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease,
    transform 160ms ease;
}

.scenario-picker__item::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: transparent;
  content: "";
}

.scenario-picker__item:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--envoi-coral), transparent 45%);
  transform: translateY(-1px);
}

.scenario-picker__item[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--envoi-coral), transparent 28%);
  color: var(--envoi-lab-title);
  background: color-mix(in srgb, var(--envoi-coral), var(--envoi-lab-chip) 91%);
}

.scenario-picker__item[aria-pressed="true"]::before {
  background: var(--envoi-coral);
}

.scenario-picker__item:focus-visible {
  outline: 3px solid var(--vp-c-brand-soft);
  outline-offset: 2px;
}

.scenario-picker__item:disabled {
  cursor: wait;
  opacity: 0.6;
}

.scenario-picker__index {
  position: absolute;
  top: 11px;
  right: 10px;
  color: var(--envoi-coral);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
.scenario-picker__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
  padding-right: 18px;
}

.scenario-picker__copy strong {
  color: var(--envoi-lab-title);
  font-size: 11px;
  line-height: 1.3;
}

.scenario-picker__copy small {
  color: var(--envoi-lab-muted);
  font-size: 9px;
  line-height: 1.3;
}

.scenario-picker__item code {
  align-self: flex-start;
  padding: 3px 6px;
  border-radius: 6px;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-panel);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

@media (max-width: 760px) {
  .scenario-picker {
    grid-template-columns: repeat(5, 148px);
    margin: 0 -18px;
    padding: 4px 18px 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scenario-picker__item {
    transition: none;
  }

  .scenario-picker__item:hover:not(:disabled) {
    transform: none;
  }
}
</style>
