export function showToast(host: HTMLElement, text: string, ms = 5000): HTMLElement {
  const box = document.createElement('div');
  box.className = 'toast';
  box.setAttribute('role', 'status');
  box.textContent = text;
  host.append(box);
  setTimeout(() => box.remove(), ms);
  return box;
}

export function showActionToast(host: HTMLElement, text: string, action: { label: string; onClick(): void }): HTMLElement {
  const box = document.createElement('div');
  box.className = 'toast toast--action';
  box.setAttribute('role', 'status');
  const span = document.createElement('span');
  span.textContent = text;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toast__action';
  btn.textContent = action.label;
  btn.addEventListener('click', () => { box.remove(); action.onClick(); });
  box.append(span, btn);
  host.append(box);
  return box;
}
