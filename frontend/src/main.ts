/**
 * 中文模块说明：前端应用层，负责 页面布局、共享组件、服务或工具能力
 */
import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./app/router";
import "./styles/index.css";

createApp(App).use(router).mount("#app");
