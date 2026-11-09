<template>
  <div class="commerce-art" :class="{ 'is-paused': paused }" aria-hidden="true">
    <div class="commerce-art-glow" />
    <div class="commerce-art-cards">
      <div class="product-card">
        <div class="product-picture"><ShoppingBag :size="30" :stroke-width="1.6" /></div>
        <div class="product-caption"><i /><i /></div>
        <span class="product-rating"><Star v-for="n in 3" :key="n" :size="9" fill="currentColor" /></span>
      </div>
      <div class="price-tag"><Tags :size="21" /><span>SALE</span></div>
      <div class="audio-card"><AudioLines :size="30" :stroke-width="2" /></div>
      <div class="video-card"><Play :size="24" fill="currentColor" :stroke-width="1.5" /></div>
    </div>
    <img :src="mascot" class="commerce-art-mascot" alt="" draggable="false" fetchpriority="high" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { AudioLines, Play, ShoppingBag, Star, Tags } from "lucide-vue-next";
import mascot from "../assets/ui-v2/hero-ecommerce-assistant-refined.webp";

const paused = ref(false);
function syncVisibility() {
  paused.value = document.hidden;
}
onMounted(() => {
  syncVisibility();
  document.addEventListener("visibilitychange", syncVisibility);
});
onBeforeUnmount(() => document.removeEventListener("visibilitychange", syncVisibility));
</script>

<style scoped>
.commerce-art {
  --art-blue: #448cea;
  --art-blue-soft: #e0f0ff;
  --art-coral: #d97991;
  --art-peach-soft: #ffedf0;
  --art-mint: #279caa;
  --art-mint-soft: #dff7f4;
  position: relative;
  pointer-events: none;
  user-select: none;
}
.commerce-art-glow {
  position: absolute;
  inset: 14% 8% 0;
  background: radial-gradient(ellipse, color-mix(in srgb, var(--color-primary-600) 10%, transparent), transparent 68%);
}
.commerce-art-mascot {
  position: absolute;
  width: 64%;
  height: 118%;
  left: 19%;
  bottom: -7%;
  object-fit: contain;
  animation: assistant-float 6s ease-in-out infinite;
}
.commerce-art-cards {
  position: absolute;
  inset: 0;
}
.product-card,
.price-tag,
.audio-card,
.video-card {
  position: absolute;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--color-primary-200) 70%, white);
  box-shadow:
    inset 0 1px 2px white,
    0 7px 18px color-mix(in srgb, var(--color-primary-600) 9%, transparent);
  color: var(--color-primary-600);
  background: linear-gradient(140deg, white, var(--color-primary-100));
}
.product-card {
  color: var(--art-blue);
  border-color: color-mix(in srgb, var(--art-blue) 24%, white);
  background: linear-gradient(140deg, white, var(--art-blue-soft));
  top: 12%;
  left: 8%;
  width: 82px;
  height: 100px;
  gap: 5px;
  padding: 9px;
  border-radius: 12px;
  transform: rotate(-13deg);
  animation: card-drift 7s ease-in-out -1s infinite;
}
.product-picture {
  display: grid;
  place-items: center;
  width: 100%;
  height: 48px;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--art-blue-soft), var(--art-mint-soft));
}
.product-caption {
  display: flex;
  gap: 5px;
  width: 100%;
}
.product-caption i {
  height: 3px;
  width: 65%;
  border-radius: 4px;
  background: color-mix(in srgb, var(--art-blue) 28%, white);
}
.product-caption i:last-child {
  width: 25%;
}
.product-rating {
  display: flex;
  justify-self: start;
  gap: 3px;
  color: var(--art-coral);
}
.price-tag {
  color: var(--art-coral);
  border-color: color-mix(in srgb, var(--art-coral) 25%, white);
  background: linear-gradient(140deg, white, var(--art-peach-soft));
  right: 7%;
  top: 11%;
  width: 85px;
  height: 44px;
  grid-auto-flow: column;
  gap: 5px;
  padding: 8px;
  border-radius: 10px 14px 14px 10px;
  transform: rotate(12deg);
  animation: card-drift 6s ease-in-out -3s infinite reverse;
  font-size: 11px;
  font-weight: 750;
  letter-spacing: 1px;
}
.audio-card {
  bottom: 9%;
  left: 11%;
  width: 67px;
  height: 45px;
  border-radius: 12px;
  transform: rotate(8deg);
  animation: card-drift 5s ease-in-out -2s infinite;
  color: var(--art-mint);
  border-color: color-mix(in srgb, var(--art-mint) 24%, white);
  background: linear-gradient(140deg, white, var(--art-mint-soft));
}
.video-card {
  bottom: 10%;
  right: 6%;
  width: 58px;
  height: 46px;
  border-radius: 12px;
  transform: rotate(-10deg);
  animation: card-drift 6.5s ease-in-out -4s infinite reverse;
}
.is-paused .commerce-art-mascot,
.is-paused .commerce-art-cards > div {
  animation-play-state: paused;
}
@keyframes assistant-float {
  0%,
  100% {
    transform: translateY(3px) rotate(-2deg);
  }
  50% {
    transform: translateY(-7px) rotate(2deg);
  }
}
@keyframes card-drift {
  0%,
  100% {
    translate: 0 -4px;
    rotate: -3deg;
  }
  50% {
    translate: 4px 6px;
    rotate: 4deg;
  }
}
@media (max-width: 900px), (prefers-reduced-motion: reduce) {
  .commerce-art-mascot,
  .commerce-art-cards > div {
    animation: none;
  }
}
@media (max-width: 1100px) {
  .product-card {
    width: 64px;
    height: 82px;
    padding: 7px;
  }
  .product-picture {
    height: 36px;
  }
  .price-tag {
    width: 69px;
    height: 37px;
    font-size: 9px;
  }
  .audio-card {
    width: 52px;
    height: 37px;
  }
  .video-card {
    width: 46px;
    height: 38px;
  }
}
</style>
