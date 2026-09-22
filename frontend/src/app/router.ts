/**
 * 中文模块说明：前端应用层，负责 路由、懒加载和页面导航配置
 */
import { createRouter, createWebHistory } from "vue-router";
import ToolHomePage from "../pages/ToolHomePage.vue";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: ToolHomePage
    },
    {
      path: "/settings",
      name: "desktop-settings",
      component: () => import("../pages/DesktopSettingsPage.vue")
    },
    {
      path: "/tools/image-compress",
      name: "image-compress",
      // 业务页面按路由懒加载，首屏只下载首页和布局所需代码。
      component: () => import("../modules/image-compress/page.vue")
    },
    {
      path: "/tools/image-ai",
      name: "image-ai",
      component: () => import("../modules/image-ai/page.vue")
    },
    {
      path: "/tools/lan-transfer",
      name: "lan-transfer",
      component: () => import("../modules/lan-transfer/page.vue")
    },
    {
      path: "/tools/video-text",
      name: "video-text",
      component: () => import("../modules/video-text/page.vue")
    },
    {
      path: "/tools/edge-tts",
      name: "edge-tts",
      component: () => import("../modules/edge-tts/page.vue")
    },
    {
      path: "/tools/short-video",
      name: "short-video",
      component: () => import("../modules/short-video/page.vue")
    },
    {
      path: "/tools/xhs-archive",
      name: "xhs-archive",
      component: () => import("../modules/xhs-archive/page.vue")
    }
  ]
});
