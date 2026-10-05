import type { HlsCtor } from './player';

export async function loadHls(): Promise<HlsCtor> {
  return (await import('hls.js')).default as unknown as HlsCtor;
}
