const audioCache = new Map<string, HTMLAudioElement>();

export function playSound(name: string, loop = false) {
  const key = `/sounds/${name}`;
  let audio = audioCache.get(key);
  if (!audio) {
    audio = new Audio(key);
    audio.preload = 'auto';
    audioCache.set(key, audio);
  }
  audio.loop = loop;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

export function stopSound(name: string) {
  const key = `/sounds/${name}`;
  const audio = audioCache.get(key);
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
}

export function stopAllSounds() {
  audioCache.forEach((audio) => {
    audio.pause();
    audio.currentTime = 0;
  });
}
