import { defineConfig, type DefaultTheme } from "vitepress";

const logo: DefaultTheme.ThemeableImage = {
  light: "/brand/mark-light.svg",
  dark: "/brand/mark-dark.svg",
  alt: "envoi",
};

const sharedTheme = {
  logo,
  siteTitle: "envoi",
  socialLinks: [
    { icon: "github", link: "https://github.com/daguanren21/envoi" },
    { icon: "npm", link: "https://www.npmjs.com/package/@envoijs/http" },
  ],
  search: { provider: "local" as const },
};

const enTheme: DefaultTheme.Config = {
  ...sharedTheme,
  nav: [
    { text: "Guide", link: "/guide/getting-started" },
    { text: "Live demo", link: "/demo" },
    { text: "Example", link: "/examples/production-client" },
    { text: "API", link: "/reference/api" },
    {
      text: "v0.1.0",
      items: [
        { text: "npm", link: "https://www.npmjs.com/package/@envoijs/http" },
        { text: "Changelog", link: "https://github.com/daguanren21/envoi/releases" },
      ],
    },
  ],
  sidebar: [
    {
      text: "Start",
      items: [
        { text: "Getting started", link: "/guide/getting-started" },
        { text: "Protocol lab", link: "/demo" },
        { text: "Production client", link: "/examples/production-client" },
      ],
    },
    {
      text: "Response contract",
      items: [
        { text: "Envelopes", link: "/guide/envelopes" },
        { text: "Hooks", link: "/guide/hooks" },
        { text: "Middleware", link: "/guide/middleware" },
        { text: "Adapters", link: "/guide/adapters" },
      ],
    },
    {
      text: "Consumer examples",
      items: [
        { text: "Query libraries", link: "/guide/query-libraries" },
        { text: "Authorization abilities", link: "/guide/ability" },
      ],
    },
    {
      text: "Reference",
      items: [{ text: "Public API", link: "/reference/api" }],
    },
  ],
  outline: { level: [2, 3], label: "On this page" },
  editLink: {
    pattern: "https://github.com/daguanren21/envoi/edit/main/docs/:path",
    text: "Edit this page on GitHub",
  },
  docFooter: { prev: "Previous", next: "Next" },
  lastUpdated: { text: "Updated" },
  footer: {
    message: "Released under the MIT License.",
    copyright: "Copyright © 2026 envoi contributors",
  },
};

const zhTheme: DefaultTheme.Config = {
  ...sharedTheme,
  nav: [
    { text: "指南", link: "/zh/guide/getting-started" },
    { text: "在线 Demo", link: "/zh/demo" },
    { text: "完整案例", link: "/zh/examples/production-client" },
    { text: "API", link: "/zh/reference/api" },
    {
      text: "v0.1.0",
      items: [
        { text: "npm", link: "https://www.npmjs.com/package/@envoijs/http" },
        { text: "更新记录", link: "https://github.com/daguanren21/envoi/releases" },
      ],
    },
  ],
  sidebar: [
    {
      text: "开始",
      items: [
        { text: "快速开始", link: "/zh/guide/getting-started" },
        { text: "协议实验台", link: "/zh/demo" },
        { text: "生产客户端案例", link: "/zh/examples/production-client" },
      ],
    },
    {
      text: "返回契约",
      items: [
        { text: "Envelope", link: "/zh/guide/envelopes" },
        { text: "Hooks", link: "/zh/guide/hooks" },
        { text: "Middleware", link: "/zh/guide/middleware" },
        { text: "Adapters", link: "/zh/guide/adapters" },
      ],
    },
    {
      text: "使用方示例",
      items: [
        { text: "Query 库", link: "/zh/guide/query-libraries" },
        { text: "权限 Ability", link: "/zh/guide/ability" },
      ],
    },
    {
      text: "参考",
      items: [{ text: "公共 API", link: "/zh/reference/api" }],
    },
  ],
  outline: { level: [2, 3], label: "本页内容" },
  editLink: {
    pattern: "https://github.com/daguanren21/envoi/edit/main/docs/:path",
    text: "在 GitHub 编辑本页",
  },
  docFooter: { prev: "上一页", next: "下一页" },
  lastUpdated: { text: "更新时间" },
  darkModeSwitchLabel: "外观",
  lightModeSwitchTitle: "切换到浅色模式",
  darkModeSwitchTitle: "切换到深色模式",
  sidebarMenuLabel: "菜单",
  returnToTopLabel: "返回顶部",
  langMenuLabel: "切换语言",
  footer: {
    message: "基于 MIT License 发布。",
    copyright: "Copyright © 2026 envoi contributors",
  },
};

export default defineConfig({
  base: "/envoi/",
  title: "envoi",
  description: "Typed HTTP responses without repeated client wrappers.",
  lang: "en-US",
  cleanUrls: true,
  lastUpdated: true,
  appearance: true,
  markdown: {
    lineNumbers: true,
    theme: {
      light: "github-light",
      dark: "github-dark",
    },
  },
  sitemap: { hostname: "https://daguanren21.github.io/envoi/" },
  head: [
    [
      "meta",
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
    ],
    ["meta", { name: "theme-color", content: "#fcfaf6", media: "(prefers-color-scheme: light)" }],
    ["meta", { name: "theme-color", content: "#171c26", media: "(prefers-color-scheme: dark)" }],
    ["link", { rel: "icon", href: "/envoi/brand/favicon.svg", type: "image/svg+xml" }],
  ],
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      title: "envoi",
      description: "Typed HTTP responses without repeated client wrappers.",
      themeConfig: enTheme,
    },
    zh: {
      label: "简体中文",
      lang: "zh-CN",
      link: "/zh/",
      title: "envoi",
      description: "统一 transport response 与后端 envelope 的 TypeScript HTTP 客户端。",
      themeConfig: zhTheme,
      markdown: {
        codeCopyButton: { tooltipText: "复制代码", copiedText: "已复制" },
      },
    },
  },
});
