/**
 * 中文模块说明：前端应用层，负责 路由、懒加载和页面导航配置
 */
import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/settings/data-backup", name: "data-backup", component: () => import("../features/data-backup/page.vue") },
    {
      path: "/settings/diagnostics",
      name: "diagnostics",
      component: () => import("../features/diagnostics/DiagnosticsPage.vue")
    },
    {
      path: "/",
      name: "home",
      component: () => import("./ToolHomePage.vue")
    },
    {
      path: "/settings",
      name: "desktop-settings",
      component: () => import("../features/desktop-settings/DesktopSettingsPage.vue")
    },
    {
      path: "/tools/image-compress",
      name: "image-compress",
      // 业务页面按路由懒加载，首屏只下载首页和布局所需代码。
      component: () => import("../features/image-compress/page.vue")
    },
    {
      path: "/tools/image-ai",
      name: "image-ai",
      component: () => import("../features/image-ai/page.vue")
    },
    {
      path: "/tools/video-subtitle",
      name: "video-subtitle",
      component: () => import("../features/video-ai/page.vue")
    },
    {
      path: "/tools/lan-transfer",
      name: "lan-transfer",
      component: () => import("../features/lan-transfer/page.vue")
    },
    {
      path: "/tools/edge-tts",
      name: "edge-tts",
      component: () => import("../features/speech/page.vue")
    },
    {
      path: "/tools/audio-library",
      name: "audio-library",
      component: () => import("../features/audio-library/page.vue")
    },
    {
      path: "/tools/audio-extract",
      name: "audio-extract",
      component: () => import("../features/audio-extract/page.vue")
    },
    {
      path: "/tools/audio-convert",
      name: "audio-convert",
      component: () => import("../features/audio-convert/page.vue")
    },
    {
      path: "/tools/json-format",
      name: "json-format",
      component: () => import("../features/json-format/page.vue")
    },
    {
      path: "/tools/base64",
      name: "base64",
      component: () => import("../features/base64/page.vue")
    },
    {
      path: "/tools/url-codec",
      name: "url-codec",
      component: () => import("../features/url-codec/page.vue")
    },
    {
      path: "/tools/uuid-generator",
      name: "uuid-generator",
      component: () => import("../features/uuid-generator/page.vue")
    },
    {
      path: "/tools/media-archive/video-editor/:itemId/:mediaId",
      name: "archive-video-editor",
      component: () => import("../features/content-archive/ArchiveVideoEditorPage.vue")
    },
    {
      path: "/tools/media-archive",
      name: "xhs-archive",
      component: () => import("../features/content-archive/page.vue")
    },
    {
      // 旧收藏与桌面深链接沿用入口；仅页面重定向，不改变当前 API 或媒体路径。
      path: "/tools/xhs-archive",
      redirect: (to) => ({ path: "/tools/media-archive", query: to.query, hash: to.hash })
    }
  ]
});
