<script setup lang="ts">
import { computed, onMounted, shallowRef } from "vue";
import {
  BizError,
  createHttp,
  type Adapter,
  type EnvelopeOption,
  type HttpResponse,
} from "../../../../packages/http/src/index";
import ProtocolDataPanel from "./ProtocolDataPanel.vue";
import ProtocolScenarioPicker from "./ProtocolScenarioPicker.vue";

interface Props {
  lang?: "en" | "zh";
}

interface DemoUser {
  id: number;
  name: string;
}

type ScenarioKey = "success" | "business-error" | "http-only" | "renamed" | "http-error";

interface LocalizedCopy {
  en: string;
  zh: string;
}

interface Scenario {
  key: ScenarioKey;
  label: LocalizedCopy;
  summary: LocalizedCopy;
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
        titleLead: "后端响应如何转换为",
        titleTail: "业务数据或 BizError",
        description:
          "选择一种后端响应，运行仓库里的真实 createHttp，对比原始 response 与 Promise resolve/reject 的最终结果。",
        response: "后端 response",
        result: "envoi 输出",
        scenario: "场景",
        pipeline: "真实请求管线",
        run: "运行请求",
        rerun: "再次运行",
        booting: "正在启动",
        running: "处理中",
        ready: "等待运行",
        idle: "// 运行后在这里查看 resolve 值或 BizError",
        inFlight: "// createHttp 正在处理 response...",
        completed: "已完成",
        value: "Promise resolve",
        error: "Promise reject",
        real: "真实 envoi client",
      }
    : {
        eyebrow: "Protocol workbench",
        titleLead: "From backend response to",
        titleTail: "data or BizError",
        description:
          "Choose a backend response, run the repository's real createHttp, and compare the raw response with the final resolved value or rejected BizError.",
        response: "Backend response",
        result: "envoi outcome",
        scenario: "Scenario",
        pipeline: "Real request pipeline",
        run: "Run request",
        rerun: "Run again",
        booting: "Starting client",
        running: "Running",
        ready: "Ready to run",
        idle: "// Run the scenario to inspect its resolved value or BizError",
        inFlight: "// createHttp is processing the response...",
        completed: "Completed",
        value: "Promise resolved",
        error: "Promise rejected",
        real: "real envoi client",
      },
);

const scenarios: Scenario[] = [
  {
    key: "success",
    label: { en: "Envelope success", zh: "Envelope 成功" },
    summary: { en: "Unwrap data", zh: "解包 data" },
    status: 200,
    statusText: "OK",
    body: { code: 200, msg: "ok", data: { id: 42, name: "Ada" } },
    envelope: {},
  },
  {
    key: "business-error",
    label: { en: "Business error", zh: "业务错误" },
    summary: { en: "Reject BizError", zh: "reject BizError" },
    status: 200,
    statusText: "OK",
    body: { code: 42_201, msg: "Plan limit reached", data: null },
    envelope: {},
  },
  {
    key: "http-only",
    label: { en: "HTTP-only body", zh: "HTTP-only" },
    summary: { en: "Return body", zh: "直接返回 body" },
    status: 200,
    statusText: "OK",
    body: { id: 42, name: "Ada" },
  },
  {
    key: "renamed",
    label: { en: "Renamed fields", zh: "字段改名" },
    summary: { en: "Map custom keys", zh: "映射自定义字段" },
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
    summary: { en: "Reject by status", zh: "按 status reject" },
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

function selectScenario(key: string): void {
  if (running.value) return;
  const scenario = scenarios.find((item) => item.key === key);
  if (!scenario) return;
  selectedKey.value = scenario.key;
  outcome.value = undefined;
}

onMounted(() => {
  hydrated.value = true;
});
</script>

<template>
  <section class="protocol-lab" aria-labelledby="protocol-lab-title">
    <header class="protocol-lab__header">
      <div class="protocol-lab__intro">
        <span class="protocol-lab__eyebrow">{{ text.eyebrow }}</span>
        <h2 id="protocol-lab-title">
          <span>{{ text.titleLead }}</span>
          <span>{{ text.titleTail }}</span>
        </h2>
        <p>{{ text.description }}</p>
      </div>
      <div class="protocol-lab__trust" role="status">
        <span><i />{{ text.real }}</span>
        <code>createHttp()</code>
      </div>
    </header>

    <div class="protocol-lab__selector">
      <div class="protocol-lab__selector-head">
        <span>{{ text.scenario }}</span>
        <strong>{{ selected.label[props.lang] }}</strong>
        <small>{{ selected.summary[props.lang] }}</small>
      </div>
      <ProtocolScenarioPicker
        :items="scenarios"
        :selected-key="selectedKey"
        :lang="props.lang"
        :disabled="!hydrated || running"
        :label="text.scenario"
        @select="selectScenario"
      />
    </div>

    <div class="protocol-lab__workspace" :class="{ 'is-running': running }">
      <div class="protocol-lab__toolbar">
        <div class="protocol-lab__pipeline">
          <i />
          <span>
            <small>{{ text.pipeline }}</small>
            <strong>HTTP {{ selected.status }} · {{ selected.statusText }}</strong>
          </span>
        </div>
        <button
          class="protocol-lab__run"
          type="button"
          :disabled="!hydrated || running"
          @click="runScenario"
        >
          <i aria-hidden="true" />
          {{ runLabel }}
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div class="protocol-lab__panels">
        <ProtocolDataPanel
          :heading="text.response"
          :badge="`HTTP ${selected.status}`"
          :label="selected.statusText"
          :content="responseText"
          tone="response"
        />
        <span class="protocol-lab__flow" aria-hidden="true">→</span>
        <ProtocolDataPanel
          :heading="text.result"
          :badge="outcomeStatus"
          :label="outcomeType"
          :content="outcomeText"
          :tone="outcomeState"
          :busy="running"
        />
      </div>

      <footer class="protocol-lab__footer" aria-live="polite">
        <span>{{ selected.summary[props.lang] }}</span>
        <span v-if="outcome">{{ text.completed }} #{{ completedRuns }}</span>
        <span v-else>{{ text.ready }}</span>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.protocol-lab {
  position: relative;
  max-width: 1080px;
  margin: 64px auto;
  padding: clamp(22px, 3.5vw, 34px);
  border: 1px solid var(--envoi-lab-border);
  border-radius: 26px;
  color: var(--envoi-lab-title);
  background: var(--envoi-lab-bg);
  box-shadow: var(--envoi-lab-shadow);
}

.protocol-lab__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 28px;
}

.protocol-lab__intro {
  min-width: 0;
}

.protocol-lab__eyebrow {
  color: var(--envoi-coral);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.protocol-lab__intro h2 {
  max-width: 720px;
  margin: 8px 0 12px;
  border: 0;
  color: var(--envoi-lab-title);
  font-size: clamp(32px, 5vw, 52px);
  line-height: 1.02;
  letter-spacing: -0.045em;
}

.protocol-lab__intro h2 span {
  display: block;
}

.protocol-lab__intro p {
  max-width: 720px;
  margin: 0;
  color: var(--envoi-lab-muted);
  font-size: 15px;
  line-height: 1.7;
}

.protocol-lab__trust {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 7px;
  padding: 10px 12px;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 12px;
  background: var(--envoi-lab-chip);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
}

.protocol-lab__trust span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--envoi-lab-title);
  font-weight: 650;
}

.protocol-lab__trust i,
.protocol-lab__pipeline > i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--envoi-teal);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--envoi-teal), transparent 80%);
}

.protocol-lab__trust code {
  color: var(--envoi-lab-muted);
  font-size: 9px;
}

.protocol-lab__selector {
  margin-top: 28px;
}

.protocol-lab__selector-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 10px;
}

.protocol-lab__selector-head > span {
  color: var(--envoi-lab-muted);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.protocol-lab__selector-head strong {
  color: var(--envoi-lab-title);
  font-size: 13px;
}

.protocol-lab__selector-head small {
  color: var(--envoi-lab-muted);
  font-size: 11px;
}

.protocol-lab__workspace {
  margin-top: 16px;
  overflow: hidden;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 20px;
  background: color-mix(in srgb, var(--envoi-lab-panel), transparent 20%);
}

.protocol-lab__toolbar {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 11px 14px 11px 18px;
  border-bottom: 1px solid var(--envoi-lab-border);
  background: var(--envoi-lab-chip);
}

.protocol-lab__pipeline {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.protocol-lab__pipeline span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.protocol-lab__pipeline small {
  color: var(--envoi-lab-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.protocol-lab__pipeline strong {
  overflow: hidden;
  color: var(--envoi-lab-title);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.protocol-lab__run {
  display: inline-flex;
  min-height: 44px;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 9px;
  margin: 0;
  padding: 0 16px;
  border: 1px solid color-mix(in srgb, var(--vp-c-brand-1), black 8%);
  border-radius: 11px;
  color: #fff;
  background: var(--vp-c-brand-1);
  box-shadow: 0 9px 22px var(--vp-c-brand-soft);
  font-size: 12px;
  font-weight: 750;
  cursor: pointer;
  transition:
    background-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.protocol-lab__run > i {
  display: none;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
}

.protocol-lab__workspace.is-running .protocol-lab__run > i {
  display: block;
  animation: protocol-spin 700ms linear infinite;
}

.protocol-lab__run:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 26px var(--vp-c-brand-soft);
}

.protocol-lab__run:active:not(:disabled) {
  transform: translateY(0);
}

.protocol-lab__run:focus-visible {
  outline: 3px solid var(--vp-c-brand-soft);
  outline-offset: 3px;
}

.protocol-lab__run:disabled {
  cursor: wait;
  opacity: 0.68;
}

.protocol-lab__panels {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 32px minmax(0, 1fr);
  align-items: stretch;
  padding: 14px;
}

.protocol-lab__flow {
  display: grid;
  width: 24px;
  height: 24px;
  place-self: center;
  place-items: center;
  border: 1px solid var(--envoi-lab-border);
  border-radius: 50%;
  color: var(--envoi-lab-muted);
  background: var(--envoi-lab-chip);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
}

.protocol-lab__footer {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 0 18px;
  border-top: 1px solid var(--envoi-lab-border);
  color: var(--envoi-lab-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 9px;
  letter-spacing: 0.04em;
}

@keyframes protocol-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 760px) {
  .protocol-lab {
    margin: 40px 0;
    padding: 20px 18px;
    border-radius: 20px;
  }

  .protocol-lab__header {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .protocol-lab__intro h2 {
    font-size: clamp(28px, 8vw, 34px);
  }

  .protocol-lab__trust {
    align-items: flex-start;
    justify-self: start;
  }

  .protocol-lab__selector-head {
    display: grid;
    grid-template-columns: auto 1fr;
  }

  .protocol-lab__selector-head small {
    grid-column: 1 / -1;
  }

  .protocol-lab__toolbar {
    align-items: stretch;
    flex-direction: column;
    padding: 14px;
  }

  .protocol-lab__run {
    width: 100%;
  }

  .protocol-lab__panels {
    grid-template-columns: 1fr;
    padding: 12px;
  }

  .protocol-lab__flow {
    margin: 8px 0;
    transform: rotate(90deg);
  }

  .protocol-lab__footer {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
    padding: 10px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .protocol-lab__run {
    transition: none;
  }

  .protocol-lab__run:hover:not(:disabled) {
    transform: none;
  }

  .protocol-lab__workspace.is-running .protocol-lab__run > i {
    animation: none;
  }
}
</style>
