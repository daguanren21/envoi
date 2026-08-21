<script setup lang="ts">
import { computed } from "vue";

interface Props {
  lang?: "en" | "zh";
}

const props = withDefaults(defineProps<Props>(), { lang: "en" });

const text = computed(() =>
  props.lang === "zh"
    ? {
        main: "正常 response 路径",
        request: "修改标准化前的 request",
        adapter: "执行 transport",
        response: "修改解析后的 response",
        envelope: "执行项目 response policy",
        fromAdapter: "从 adapter 分支",
        transportFailure: "transport 抛错",
        requestFailureNote: "onRequestError 收到原始 error，可以在 reject 前替换 ctx.error。",
        fromEnvelope: "从 response policy 分支",
        success: "成功",
        failure: "失败",
        responseFailureNote:
          "non-ok 生成分类后的 error，onResponseError 可以在 reject 前替换 ctx.error。",
        everyPath: "所有路径",
        finallyNote:
          "onFinally 在 resolve 和 reject 路径都执行。请求和 cleanup 同时失败时返回 AggregateError。",
      }
    : {
        main: "Normal response path",
        request: "mutate the request before normalization",
        adapter: "execute the transport",
        response: "mutate the parsed response",
        envelope: "apply the project response policy",
        fromAdapter: "branch from adapter",
        transportFailure: "transport throws",
        requestFailureNote:
          "onRequestError receives the original error and may replace ctx.error before rejection.",
        fromEnvelope: "branch from response policy",
        success: "success",
        failure: "failure",
        responseFailureNote:
          "A non-ok result creates the classified error. onResponseError may replace ctx.error before rejection.",
        everyPath: "every path",
        finallyNote:
          "onFinally runs for resolved and rejected requests. Request plus cleanup failures produce AggregateError.",
      },
);
</script>

<template>
  <figure class="lifecycle-flow">
    <figcaption>{{ text.main }}</figcaption>

    <div class="lifecycle-flow__main">
      <div class="lifecycle-flow__stage is-request">
        <code>onRequest</code>
        <small>{{ text.request }}</small>
      </div>
      <span class="lifecycle-flow__arrow" aria-hidden="true">→</span>
      <div class="lifecycle-flow__stage is-adapter">
        <code>adapter</code>
        <small>{{ text.adapter }}</small>
      </div>
      <span class="lifecycle-flow__arrow" aria-hidden="true">→</span>
      <div class="lifecycle-flow__stage is-response">
        <code>onResponse</code>
        <small>{{ text.response }}</small>
      </div>
      <span class="lifecycle-flow__arrow" aria-hidden="true">→</span>
      <div class="lifecycle-flow__stage is-envelope">
        <code>policy</code>
        <small>{{ text.envelope }}</small>
      </div>
    </div>

    <div class="lifecycle-flow__branches">
      <article class="lifecycle-flow__branch is-transport">
        <header>
          <span>{{ text.fromAdapter }}</span>
          <strong>{{ text.transportFailure }}</strong>
        </header>
        <div class="lifecycle-flow__chain">
          <code>onRequestError(ctx.error)</code>
          <span aria-hidden="true">→</span>
          <code>reject</code>
        </div>
        <p>{{ text.requestFailureNote }}</p>
      </article>

      <article class="lifecycle-flow__branch is-protocol">
        <header>
          <span>{{ text.fromEnvelope }}</span>
          <strong>ResultKind</strong>
        </header>
        <div class="lifecycle-flow__path is-success">
          <span>{{ text.success }}</span>
          <code>kind: ok</code>
          <span aria-hidden="true">→</span>
          <code>onSuccess(ctx.value)</code>
          <span aria-hidden="true">→</span>
          <code>resolve</code>
        </div>
        <div class="lifecycle-flow__path is-failure">
          <span>{{ text.failure }}</span>
          <code>kind: non-ok</code>
          <span aria-hidden="true">→</span>
          <code>onResponseError(ctx.error)</code>
          <span aria-hidden="true">→</span>
          <code>reject</code>
        </div>
        <p>{{ text.responseFailureNote }}</p>
      </article>

      <article class="lifecycle-flow__branch is-finally">
        <header>
          <span>{{ text.everyPath }}</span>
          <strong>onFinally(ctx)</strong>
        </header>
        <div class="lifecycle-flow__chain">
          <code>resolve | reject</code>
          <span aria-hidden="true">→</span>
          <code>onFinally(ctx)</code>
          <span aria-hidden="true">→</span>
          <code>settle Promise</code>
        </div>
        <p>{{ text.finallyNote }}</p>
      </article>
    </div>
  </figure>
</template>

<style scoped>
.lifecycle-flow {
  margin: 28px 0 40px;
  padding: clamp(18px, 3vw, 28px);
  border: 1px solid var(--envoi-flow-border);
  border-radius: 22px;
  background: var(--envoi-flow-surface);
  box-shadow: var(--envoi-card-shadow);
}

.lifecycle-flow figcaption {
  margin-bottom: 14px;
  color: var(--vp-c-text-2);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.lifecycle-flow__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: stretch;
  gap: 8px;
}

.lifecycle-flow__stage {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 96px;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
  overflow: hidden;
  border: 1px solid var(--envoi-flow-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}

.lifecycle-flow__stage::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: var(--stage-color);
  content: "";
}

.lifecycle-flow__stage.is-request {
  --stage-color: var(--envoi-amber);
}

.lifecycle-flow__stage.is-adapter {
  --stage-color: var(--envoi-coral);
}

.lifecycle-flow__stage.is-response {
  --stage-color: var(--envoi-violet);
}

.lifecycle-flow__stage.is-envelope {
  --stage-color: var(--envoi-teal);
}

.lifecycle-flow__stage code,
.lifecycle-flow__chain code,
.lifecycle-flow__path code {
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-weight: 700;
}

.lifecycle-flow__stage small {
  margin-top: 18px;
  color: var(--vp-c-text-2);
  font-size: 11px;
  line-height: 1.45;
}

.lifecycle-flow__arrow {
  display: grid;
  place-items: center;
  color: var(--vp-c-text-3);
}

.lifecycle-flow__branches {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  margin-top: 12px;
}

.lifecycle-flow__branch {
  position: relative;
  padding: 16px;
  border: 1px solid var(--envoi-flow-border);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
}

.lifecycle-flow__branch::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  border-radius: 14px 0 0 14px;
  background: var(--branch-color);
  content: "";
}

.lifecycle-flow__branch.is-transport {
  --branch-color: var(--envoi-coral);
}

.lifecycle-flow__branch.is-protocol {
  --branch-color: var(--envoi-teal);
}

.lifecycle-flow__branch.is-finally {
  --branch-color: var(--envoi-violet);
}

.lifecycle-flow__branch header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.lifecycle-flow__branch header span,
.lifecycle-flow__path > span:first-child {
  color: var(--branch-color);
  font-family: var(--vp-font-family-mono);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.lifecycle-flow__branch header strong {
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.lifecycle-flow__chain,
.lifecycle-flow__path {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 9px;
}

.lifecycle-flow__chain code,
.lifecycle-flow__path code {
  white-space: nowrap;
}

.lifecycle-flow__chain > span,
.lifecycle-flow__path > span:not(:first-child) {
  color: var(--vp-c-text-3);
}

.lifecycle-flow__path {
  padding: 10px 0;
  border-top: 1px solid var(--envoi-flow-border);
}

.lifecycle-flow__path > span:first-child {
  width: 54px;
  flex: none;
}

.lifecycle-flow__path.is-success {
  --branch-color: var(--envoi-teal);
}

.lifecycle-flow__path.is-failure {
  --branch-color: var(--envoi-coral);
}

.lifecycle-flow__branch p {
  margin: 14px 0 0;
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.6;
}

@media (max-width: 760px) {
  .lifecycle-flow {
    padding: 16px;
  }

  .lifecycle-flow__main {
    grid-template-columns: 1fr;
  }

  .lifecycle-flow__stage {
    min-height: 82px;
  }

  .lifecycle-flow__arrow {
    height: 18px;
    transform: rotate(90deg);
  }

  .lifecycle-flow__branches {
    grid-template-columns: 1fr;
    margin-top: 18px;
  }

  .lifecycle-flow__chain,
  .lifecycle-flow__path {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .lifecycle-flow__path > span:first-child {
    width: 100%;
  }
}
</style>
