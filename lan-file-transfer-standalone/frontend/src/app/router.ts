import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/tools/lan-transfer"
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
      path: "/:pathMatch(.*)*",
      redirect: "/tools/lan-transfer"
    }
  ]
});
