// A single decoder serves the material grid; completed posters survive component remounts.
const posters = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();

export function loadVideoCover(url: string, signal: AbortSignal): Promise<string> {
  const job = queue.then(async () => {
    signal.throwIfAborted();
    const cached = posters.get(url);
    if (cached) return cached;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    try {
      await mediaEvent(video, "loadeddata", signal, () => {
        video.src = url;
        video.load();
      });
      const time = Number.isFinite(video.duration) ? Math.min(0.5, video.duration / 4) : 0;
      if (time > 0)
        await mediaEvent(video, "seeked", signal, () => {
          video.currentTime = time;
        });
      signal.throwIfAborted();
      if (!video.videoWidth || !video.videoHeight) throw new Error("视频没有可用画面");
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 320 / video.videoWidth, 240 / video.videoHeight);
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法读取视频封面");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const poster = canvas.toDataURL("image/jpeg", 0.8);
      posters.set(url, poster);
      if (posters.size > 120) posters.delete(posters.keys().next().value!);
      return poster;
    } finally {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
  });
  queue = job.catch(() => undefined);
  return job;
}

function mediaEvent(video: HTMLVideoElement, event: string, signal: AbortSignal, start: () => void) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(event, ready);
      video.removeEventListener("error", failed);
      signal.removeEventListener("abort", aborted);
    };
    const ready = () => {
      cleanup();
      resolve();
    };
    const failed = () => {
      cleanup();
      reject(new Error("视频封面加载失败"));
    };
    const aborted = () => {
      cleanup();
      reject(new DOMException("已取消", "AbortError"));
    };
    const timer = setTimeout(failed, 8000);
    video.addEventListener(event, ready, { once: true });
    video.addEventListener("error", failed, { once: true });
    signal.addEventListener("abort", aborted, { once: true });
    if (signal.aborted) {
      aborted();
      return;
    }
    try {
      start();
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
