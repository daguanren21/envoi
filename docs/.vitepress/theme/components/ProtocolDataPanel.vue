<script setup lang="ts">
type PanelTone = "idle" | "running" | "value" | "error" | "response";

interface Props {
  heading: string;
  badge: string;
  label: string;
  content: string;
  tone: PanelTone;
  busy?: boolean;
}

const props = withDefaults(defineProps<Props>(), { busy: false });
</script>

<template>
  <article
    class="protocol-panel"
    :class="`is-${props.tone}`"
    :aria-busy="props.busy"
    aria-live="polite"
  >
    <header class="protocol-panel__head">
      <div>
        <span>{{ props.heading }}</span>
        <strong>{{ props.label }}</strong>
      </div>
      <code>{{ props.badge }}</code>
    </header>
    <pre tabindex="0"><code>{{ props.content }}</code></pre>
  </article>
</template>

<style scoped>
.protocol-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 16px;
  background: var(--envoi-lab-panel);
  transition:
    border-color 180ms ease,
    box-shadow 180ms ease;
}

.protocol-panel.is-running {
  border-color: color-mix(in srgb, var(--envoi-amber), transparent 38%);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--envoi-amber), transparent 78%);
}

.protocol-panel.is-value {
  border-color: color-mix(in srgb, var(--envoi-teal), transparent 48%);
}

.protocol-panel.is-error {
  border-color: color-mix(in srgb, var(--envoi-coral), transparent 42%);
}

.protocol-panel__head {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 0 18px;
  border-bottom: 1px solid var(--envoi-lab-border);
  background: color-mix(in srgb, var(--envoi-lab-chip), transparent 18%);
}

.protocol-panel__head div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 3px;
}

.protocol-panel__head span {
  color: var(--envoi-lab-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.protocol-panel__head strong {
  overflow: hidden;
  color: var(--envoi-lab-title);
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-panel__head code {
  flex: none;
  padding: 5px 8px;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 7px;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-bg);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.is-response .protocol-panel__head code,
.is-running .protocol-panel__head code {
  color: var(--envoi-amber);
}

.is-value .protocol-panel__head code {
  color: var(--envoi-teal);
}

.is-error .protocol-panel__head code {
  color: var(--envoi-coral);
}

.protocol-panel pre {
  min-height: 260px;
  max-height: 380px;
  margin: 0;
  overflow: auto;
  padding: 20px;
  color: var(--envoi-lab-code);
  background: transparent;
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-wrap;
}

.protocol-panel pre:focus-visible {
  outline: 3px solid var(--vp-c-brand-soft);
  outline-offset: -3px;
}

@media (max-width: 760px) {
  .protocol-panel__head {
    min-height: 58px;
    padding: 0 14px;
  }

  .protocol-panel pre {
    min-height: 210px;
    padding: 16px;
    font-size: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .protocol-panel {
    transition: none;
  }
}
</style>
