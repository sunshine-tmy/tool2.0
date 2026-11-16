/** Resolve legacy Worker health into an explicit set without changing CPU/CUDA behavior. */
import type { ChatterboxDevice, ChatterboxWorkerHealth } from "@toolbox/shared";

export function supportedChatterboxDevices(health: ChatterboxWorkerHealth): ChatterboxDevice[] {
  if (health.supportedDevices) return [...health.supportedDevices];
  const devices: ChatterboxDevice[] = ["cpu"];
  if (health.cudaAvailable === true || (health.cudaAvailable === undefined && health.device === "cuda")) {
    devices.push("cuda");
  }
  if (health.mpsAvailable === true) devices.push("mps");
  return devices;
}

export function supportsChatterboxDevice(health: ChatterboxWorkerHealth, device: ChatterboxDevice) {
  return supportedChatterboxDevices(health).includes(device);
}

export function chatterboxDeviceUnavailable(device: ChatterboxDevice, health: ChatterboxWorkerHealth) {
  if (device === "cuda") {
    return {
      code: "CHATTERBOX_CUDA_UNAVAILABLE",
      message: "当前运行环境没有可用的 CUDA GPU，请改选 CPU 或安装 CUDA 运行环境。"
    };
  }
  if (device === "mps") {
    return {
      code: "CHATTERBOX_MPS_UNAVAILABLE",
      message: health.mpsUnavailableReason || "当前运行环境没有已验证的 MPS 设备，请改选 CPU。"
    };
  }
  return { code: "CHATTERBOX_CPU_UNAVAILABLE", message: "当前运行环境没有可用的 CPU 推理路径。" };
}
