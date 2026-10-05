export function createPulse(): HTMLElement {
  const box = document.createElement('div');
  box.className = 'pulse';
  box.innerHTML = '<span class="pulse__ring"></span><span class="pulse__dot"></span>';
  return box;
}
