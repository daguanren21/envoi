import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import LifecycleFlow from "./components/LifecycleFlow.vue";
import ProtocolLab from "./components/ProtocolLab.vue";
import RequestFlow from "./components/RequestFlow.vue";
// oxlint-disable-next-line import/no-unassigned-import -- Twoslash tooltip stylesheet
import "@shikijs/vitepress-twoslash/style.css";
// oxlint-disable-next-line import/no-unassigned-import -- VitePress theme stylesheet
import "./styles.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.use(TwoslashFloatingVue);
    app.component("LifecycleFlow", LifecycleFlow);
    app.component("ProtocolLab", ProtocolLab);
    app.component("RequestFlow", RequestFlow);
  },
} satisfies Theme;
