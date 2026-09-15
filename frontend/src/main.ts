/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./app/router";
import "./styles/index.css";

// 先加载全局样式和路由，再挂载根组件，保证首屏布局与导航上下文一次性就绪。
createApp(App).use(router).mount("#app");
