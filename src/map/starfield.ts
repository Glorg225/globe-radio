export function renderStarfield(host: HTMLElement, count = 140, seed = 11): void {
  let s = seed;
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  const stars: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    const size = rand() < 0.7 ? 1 : 2;
    star.style.left = `${(rand() * 100).toFixed(2)}%`;
    star.style.top = `${(rand() * 100).toFixed(2)}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.opacity = (0.25 + rand() * 0.5).toFixed(2);
    stars.push(star);
  }
  host.replaceChildren(...stars);
}
