import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import ProtocolLab from "./components/ProtocolLab.vue";
import RequestFlow from "./components/RequestFlow.vue";
// oxlint-disable-next-line import/no-unassigned-import -- VitePress theme stylesheet
import "./styles.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("ProtocolLab", ProtocolLab);
    app.component("RequestFlow", RequestFlow);
  },
} satisfies Theme;
