<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { NConfigProvider, NMessageProvider, type GlobalThemeOverrides } from "naive-ui";

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#2563eb",
    primaryColorHover: "#1d4ed8",
    primaryColorPressed: "#1e3a8a",
    primaryColorSuppl: "#0f766e",
    infoColor: "#0f766e",
    successColor: "#16a34a",
    warningColor: "#d97706",
    errorColor: "#dc2626",
    textColorBase: "#172033",
    bodyColor: "#f5f7fb",
    borderColor: "#e4e9f2",
    borderRadius: "8px",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  Button: {
    borderRadiusMedium: "8px",
    heightMedium: "38px"
  },
  Card: {
    borderRadius: "8px"
  },
  Input: {
    borderRadius: "8px",
    heightMedium: "38px"
  },
  Select: {
    peers: {
      InternalSelection: {
        borderRadius: "8px",
        heightMedium: "38px"
      }
    }
  }
};
</script>
