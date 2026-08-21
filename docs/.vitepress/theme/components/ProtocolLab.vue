<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import {
  BizError,
  createHttp,
  type Adapter,
  type EnvelopeOption,
  type HttpResponse,
} from "../../../../packages/http/src/index";

interface Props {
  lang?: "en" | "zh";
}

interface DemoUser {
  id: number;
  name: string;
}

type ScenarioKey = "success" | "business-error" | "http-only" | "renamed" | "http-error";

interface Scenario {
  key: ScenarioKey;
  label: { en: string; zh: string };
  status: number;
  statusText: string;
  body: unknown;
  envelope?: EnvelopeOption;
}

interface Outcome {
  state: "value" | "error";
  type: string;
  payload: unknown;
}

const props = withDefaults(defineProps<Props>(), { lang: "en" });
const selectedKey = shallowRef<ScenarioKey>("success");
const hydrated = shallowRef(false);
const running = shallowRef(false);
const completedRuns = shallowRef(0);
const outcome = shallowRef<Outcome>();

const text = computed(() =>
  props.lang === "zh"
    ? {
        eyebrow: "协议实验台",
        title: "一眼看清 response 如何变成 T",
        description:
          "下面运行的是仓库里的真实 createHttp。选择后端返回，再执行请求并观察 resolve 或 BizError。",
        response: "后端 response",
        result: "envoi 输出",
        run: "运行请求",
        rerun: "再次运行",
        booting: "正在启动",
        running: "处理中",
        ready: "等待运行",
        idle: "// 选择一个场景，然后点击“运行请求”",
        inFlight: "// 正在执行 createHttp...",
        completed: "已完成请求",
        value: "Promise resolve",
        error: "Promise reject",
        real: "真实 envoi client",
      }
    : {
        eyebrow: "Protocol workbench",
        title: "See exactly how a response becomes T",
        description:
          "This demo runs the repository's real createHttp. Choose a backend response, run it, and inspect the resolved value or BizError.",
        response: "Backend response",
        result: "envoi outcome",
        run: "Run request",
        rerun: "Run again",
        booting: "Starting client",
        running: "Running",
        ready: "Ready to run",
        idle: "// Choose a scenario, then click Run request",
        inFlight: "// Executing createHttp...",
        completed: "Completed run",
        value: "Promise resolved",
        error: "Promise rejected",
        real: "real envoi client",
      },
);

const scenarios: Scenario[] = [
  {
    key: "success",
    label: { en: "Envelope success", zh: "Envelope 成功" },
    status: 200,
    statusText: "OK",
    body: { code: 200, msg: "ok", data: { id: 42, name: "Ada" } },
    envelope: {},
  },
  {
    key: "business-error",
    label: { en: "Business error", zh: "业务错误" },
    status: 200,
    statusText: "OK",
    body: { code: 42_201, msg: "Plan limit reached", data: null },
    envelope: {},
  },
  {
    key: "http-only",
    label: { en: "HTTP-only body", zh: "HTTP-only" },
    status: 200,
    statusText: "OK",
    body: { id: 42, name: "Ada" },
  },
  {
    key: "renamed",
    label: { en: "Renamed fields", zh: "字段改名" },
    status: 200,
    statusText: "OK",
    body: { errno: 0, errmsg: "ok", result: { id: 42, name: "Ada" } },
    envelope: {
      code: "errno",
      msg: "errmsg",
      data: "result",
      ok: (code) => code === 0,
    },
  },
  {
    key: "http-error",
    label: { en: "HTTP 503", zh: "HTTP 503" },
    status: 503,
    statusText: "Service Unavailable",
    body: { code: 200, msg: "stale success code", data: { id: 42, name: "Ada" } },
    envelope: {},
  },
];

const selected = computed(
  () => scenarios.find((scenario) => scenario.key === selectedKey.value) ?? scenarios[0],
);
const responseText = computed(() =>
  JSON.stringify(
    {
      status: selected.value.status,
      body: selected.value.body,
    },
    null,
    2,
  ),
);
const outcomeState = computed(() => {
  if (running.value) return "running";
  return outcome.value?.state ?? "idle";
});
const outcomeStatus = computed(() => {
  if (running.value) return text.value.running;
  if (outcome.value?.state === "error") return text.value.error;
  if (outcome.value?.state === "value") return text.value.value;
  return text.value.ready;
});
const outcomeType = computed(() => {
  if (running.value) return "createHttp(...)";
  return outcome.value?.type ?? "—";
});
const outcomeText = computed(() => {
  if (running.value) return text.value.inFlight;
  if (!outcome.value) return text.value.idle;
  return JSON.stringify(outcome.value.payload, null, 2);
});
const runLabel = computed(() => {
  if (!hydrated.value) return text.value.booting;
  if (running.value) return `${text.value.running}…`;
  return outcome.value ? text.value.rerun : text.value.run;
});

async function runScenario(): Promise<void> {
  if (!hydrated.value || running.value) return;

  running.value = true;
  outcome.value = undefined;
  const scenario = selected.value;
  const adapter: Adapter = {
    name: "protocol-lab",
    async request(): Promise<HttpResponse> {
      // Keep the real client transition visible instead of resolving in the same frame.
      await new Promise<void>((resolve) => setTimeout(resolve, 420));
      return {
        status: scenario.status,
        statusText: scenario.statusText,
        headers: { "x-demo": "protocol-lab" },
        body: scenario.body,
      };
    },
  };
  const client = createHttp({ adapter, envelope: scenario.envelope });

  try {
    const value = await client.get<DemoUser>("/demo");
    outcome.value = {
      state: "value",
      type: "User",
      payload: value,
    };
  } catch (error) {
    if (error instanceof BizError) {
      outcome.value = {
        state: "error",
        type: "BizError",
        payload: {
          code: error.code,
          kind: error.kind,
          source: error.source,
          message: error.msg,
        },
      };
    } else {
      outcome.value = {
        state: "error",
        type: error instanceof Error ? error.name : "Error",
        payload: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  } finally {
    completedRuns.value += 1;
    running.value = false;
  }
}

function selectScenario(key: ScenarioKey): void {
  if (running.value) return;
  selectedKey.value = key;
  outcome.value = undefined;
}

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <section class="protocol-lab" aria-labelledby="protocol-lab-title">
    <header class="protocol-lab__header">
      <div>
        <span class="protocol-lab__eyebrow">{{ text.eyebrow }}</span>
        <h2 id="protocol-lab-title">{{ text.title }}</h2>
        <p>{{ text.description }}</p>
      </div>
      <span class="protocol-lab__status"><i />{{ text.real }}</span>
    </header>

    <div class="protocol-lab__scenarios" role="group" :aria-label="text.eyebrow">
      <button
        v-for="scenario in scenarios"
        :key="scenario.key"
        type="button"
        :aria-pressed="selectedKey === scenario.key"
        :disabled="!hydrated || running"
        @click="selectScenario(scenario.key)"
      >
        {{ scenario.label[props.lang] }}
      </button>
    </div>

    <div class="protocol-lab__panels">
      <article class="protocol-lab__panel protocol-lab__panel--response">
        <div class="protocol-lab__panel-head">
          <span>{{ text.response }}</span>
          <code>HTTP {{ selected.status }}</code>
        </div>
        <pre><code>{{ responseText }}</code></pre>
      </article>

      <article
        class="protocol-lab__panel protocol-lab__panel--outcome"
        :class="`is-${outcomeState}`"
        :aria-busy="running"
        aria-live="polite"
      >
        <div class="protocol-lab__panel-head">
          <span>{{ text.result }}</span>
          <code :class="`is-${outcomeState}`">{{ outcomeStatus }}</code>
        </div>
        <strong>{{ outcomeType }}</strong>
        <pre><code>{{ outcomeText }}</code></pre>
      </article>
    </div>

    <div class="protocol-lab__actions">
      <button
        class="protocol-lab__run"
        type="button"
        :disabled="!hydrated || running"
        @click="runScenario"
      >
        {{ runLabel }}
      </button>
      <span v-if="outcome" aria-live="polite">{{ text.completed }} #{{ completedRuns }}</span>
    </div>
  </section>
</template>

<style scoped>
.protocol-lab {
  position: relative;
  max-width: 1080px;
  margin: 72px auto;
  overflow: hidden;
  padding: clamp(22px, 4vw, 40px);
  border: 1px solid var(--envoi-lab-border);
  border-radius: 28px;
  background: var(--envoi-lab-bg);
  box-shadow: var(--envoi-lab-shadow);
}

.protocol-lab::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    linear-gradient(90deg, transparent 49.8%, var(--envoi-lab-grid) 50%, transparent 50.2%) 0 0 /
      48px 48px,
    linear-gradient(transparent 49.8%, var(--envoi-lab-grid) 50%, transparent 50.2%) 0 0 / 48px 48px;
  content: "";
  opacity: 0.45;
}

.protocol-lab > * {
  position: relative;
}

.protocol-lab__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
}

.protocol-lab__eyebrow {
  color: var(--envoi-coral);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.protocol-lab__header h2 {
  max-width: 700px;
  margin: 8px 0 10px;
  border: 0;
  color: var(--envoi-lab-title);
  font-size: clamp(26px, 4vw, 42px);
  letter-spacing: -0.04em;
}

.protocol-lab__header p {
  max-width: 720px;
  margin: 0;
  color: var(--envoi-lab-muted);
  font-size: 16px;
  line-height: 1.7;
}

.protocol-lab__status {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 11px;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 999px;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-chip);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
}

.protocol-lab__status i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--envoi-teal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--envoi-teal), transparent 78%);
}

.protocol-lab__scenarios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 28px 0 16px;
}

.protocol-lab__scenarios button {
  min-height: 42px;
  padding: 9px 13px;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 10px;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-chip);
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition:
    border-color 150ms ease,
    color 150ms ease,
    background-color 150ms ease;
}

.protocol-lab__scenarios button:hover,
.protocol-lab__scenarios button[aria-pressed="true"] {
  border-color: var(--envoi-coral);
  color: var(--envoi-lab-title);
  background: color-mix(in srgb, var(--envoi-coral), transparent 88%);
}

.protocol-lab__scenarios button:disabled {
  cursor: wait;
  opacity: 0.62;
}

.protocol-lab__panels {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 14px;
}

.protocol-lab__panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 16px;
  background: var(--envoi-lab-panel);
}

.protocol-lab__panel-head {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--envoi-lab-border);
  color: var(--envoi-lab-muted);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.protocol-lab__panel-head code {
  color: var(--envoi-amber);
  font-size: 11px;
}

.protocol-lab__panel-head code.is-error {
  color: var(--envoi-coral);
}

.protocol-lab__panel-head code.is-value {
  color: var(--envoi-teal);
}

.protocol-lab__panel-head code.is-idle {
  color: var(--envoi-lab-muted);
}

.protocol-lab__panel-head code.is-running {
  color: var(--envoi-amber);
}

.protocol-lab__panel--outcome.is-running {
  border-color: color-mix(in srgb, var(--envoi-amber), transparent 42%);
}

.protocol-lab__panel pre {
  min-height: 238px;
  max-height: 360px;
  margin: 0;
  overflow: auto;
  padding: 18px;
  color: var(--envoi-lab-code);
  background: transparent;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.protocol-lab__panel--outcome strong {
  display: block;
  padding: 20px 18px 0;
  color: var(--envoi-lab-title);
  font-family: var(--vp-font-family-mono);
  font-size: 20px;
}

.protocol-lab__panel--outcome pre {
  min-height: 194px;
  padding-top: 12px;
}

.protocol-lab__actions {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 14px;
  margin-top: 16px;
}

.protocol-lab__actions > span {
  color: var(--envoi-lab-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  letter-spacing: 0.04em;
}

.protocol-lab__run {
  min-height: 46px;
  margin: 0;
  padding: 0 20px;
  border: 0;
  border-radius: 11px;
  color: #fff;
  background: var(--vp-c-brand-1);
  box-shadow: 0 10px 26px var(--vp-c-brand-soft);
  font-weight: 750;
  cursor: pointer;
}

.protocol-lab__run:not(:disabled):hover {
  filter: brightness(1.06);
}

.protocol-lab__run:not(:disabled):active {
  transform: translateY(1px);
}

.protocol-lab__run:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 760px) {
  .protocol-lab {
    margin: 44px 0;
    border-radius: 20px;
  }

  .protocol-lab__header {
    flex-direction: column;
  }

  .protocol-lab__scenarios {
    flex-wrap: nowrap;
    margin-right: -22px;
    margin-left: -22px;
    overflow-x: auto;
    padding: 0 22px 8px;
    scrollbar-width: none;
  }

  .protocol-lab__scenarios::-webkit-scrollbar {
    display: none;
  }

  .protocol-lab__scenarios button {
    flex: none;
  }

  .protocol-lab__panels {
    grid-template-columns: 1fr;
  }

  .protocol-lab__panel pre {
    min-height: 190px;
    font-size: 12px;
  }

  .protocol-lab__actions {
    flex-direction: column;
    align-items: stretch;
  }

  .protocol-lab__actions > span {
    text-align: center;
  }

  .protocol-lab__run {
    width: 100%;
  }
}
</style>
