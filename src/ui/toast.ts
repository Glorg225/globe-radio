export function showToast(host: HTMLElement, text: string, ms = 5000): HTMLElement {
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.textContent = text;
  host.append(box);
  setTimeout(() => box.remove(), ms);
  return box;
}
