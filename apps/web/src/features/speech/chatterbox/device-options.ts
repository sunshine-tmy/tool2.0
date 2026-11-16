import type { ChatterboxDevice, ChatterboxHealth } from "@toolbox/shared";

export type ChatterboxDeviceOption = {
  value: ChatterboxDevice;
  label: string;
  description: string;
};

export function getSupportedChatterboxDevices(health?: ChatterboxHealth): ChatterboxDevice[] {
  if (health?.supportedDevices) return [...health.supportedDevices];
  const devices: ChatterboxDevice[] = ["cpu"];
  if (health?.cudaAvailable === true || (health?.cudaAvailable === undefined && health?.device === "cuda")) {
    devices.push("cuda");
  }
  if (health?.mpsAvailable === true) devices.push("mps");
  return devices;
}

export function selectSupportedChatterboxDevice(health: ChatterboxHealth | undefined, preferred?: ChatterboxDevice) {
  const supported = getSupportedChatterboxDevices(health);
  if (preferred && supported.includes(preferred)) return preferred;
  if (health?.device && supported.includes(health.device)) return health.device;
  return (["cuda", "mps", "cpu"] as const).find((device) => supported.includes(device)) || "cpu";
}

export function chatterboxDeviceOptions(health?: ChatterboxHealth): ChatterboxDeviceOption[] {
  if (health?.available !== true) return [];
  return getSupportedChatterboxDevices(health).map((value) => ({
    value,
    label: value === "cuda" ? "NVIDIA GPU" : value === "mps" ? "Apple MPS" : "CPU",
    description: value === "cuda" ? health?.gpuName || "CUDA 加速" : value === "mps" ? "Apple Metal 加速" : "兼容优先"
  }));
}
