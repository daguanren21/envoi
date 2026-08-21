<script setup lang="ts">
interface Props {
  request?: string;
  adapter?: string;
  policy?: string;
  result?: string;
  label?: string;
}

const props = withDefaults(defineProps<Props>(), {
  request: "request hooks",
  adapter: "adapter",
  policy: "response policy",
  result: "Promise<T>",
  label: "Request processing flow",
});
</script>

<template>
  <div class="request-flow" role="img" :aria-label="props.label">
    <div class="request-flow__stage request-flow__stage--request">
      <span class="request-flow__index">01</span>
      <strong>{{ props.request }}</strong>
      <small>lifecycle</small>
    </div>
    <span class="request-flow__arrow" aria-hidden="true">→</span>
    <div class="request-flow__stage request-flow__stage--adapter">
      <span class="request-flow__index">02</span>
      <strong>{{ props.adapter }}</strong>
      <small>transport</small>
    </div>
    <span class="request-flow__arrow" aria-hidden="true">→</span>
    <div class="request-flow__stage request-flow__stage--policy">
      <span class="request-flow__index">03</span>
      <strong>{{ props.policy }}</strong>
      <small>protocol</small>
    </div>
    <span class="request-flow__arrow" aria-hidden="true">→</span>
    <div class="request-flow__stage request-flow__stage--result">
      <span class="request-flow__index">04</span>
      <strong>{{ props.result }}</strong>
      <small>consumer</small>
    </div>
  </div>
</template>

<style scoped>
.request-flow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: 12px;
  margin: 48px auto;
  max-width: 980px;
}

.request-flow__stage {
  position: relative;
  display: flex;
  min-height: 124px;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  padding: 20px;
  border: 1px solid var(--envoi-flow-border);
  border-radius: 18px;
  background: var(--envoi-flow-surface);
  box-shadow: var(--envoi-card-shadow);
}

.request-flow__stage::before {
  position: absolute;
  inset: 0 0 auto;
  height: 4px;
  background: var(--stage-color);
  content: "";
}

.request-flow__stage--request {
  --stage-color: var(--envoi-amber);
}

.request-flow__stage--adapter {
  --stage-color: var(--envoi-coral);
}

.request-flow__stage--policy {
  --stage-color: var(--envoi-teal);
}

.request-flow__stage--result {
  --stage-color: var(--envoi-violet);
}

.request-flow__index {
  position: absolute;
  top: 16px;
  right: 18px;
  color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
}

.request-flow__stage strong {
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 16px;
}

.request-flow__stage small {
  margin-top: 4px;
  color: var(--vp-c-text-2);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.request-flow__arrow {
  display: grid;
  align-items: center;
  color: var(--vp-c-text-3);
  font-size: 18px;
}

@media (max-width: 760px) {
  .request-flow {
    grid-template-columns: 1fr;
    gap: 8px;
    margin: 32px 0;
  }

  .request-flow__stage {
    min-height: 98px;
  }

  .request-flow__arrow {
    height: 20px;
    justify-content: center;
    transform: rotate(90deg);
  }
}
</style>
