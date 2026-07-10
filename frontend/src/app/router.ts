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
      path: "/tools/image-compress",
      name: "image-compress",
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
      path: "/tools/short-video",
      name: "short-video",
      component: () => import("../modules/short-video/page.vue")
    }
  ]
});
