import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./app/router";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/redesign.css";

createApp(App).use(router).mount("#app");
