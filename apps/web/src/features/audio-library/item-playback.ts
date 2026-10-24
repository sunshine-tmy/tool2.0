/** 列表内单条播放互斥；作用域仅为当前列表，不涉及队列或其他模块。 */
export function onItemPlay(event: Event) {
  const target = event.target;
  if (!(target instanceof HTMLMediaElement) || !(event.currentTarget instanceof HTMLElement)) return;
  for (const audio of event.currentTarget.querySelectorAll<HTMLAudioElement>("audio[data-audio-library-inline]"))
    if (audio !== target) audio.pause();
}
