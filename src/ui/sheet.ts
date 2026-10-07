export const SHEET_DRAG_PX = 40;

// Bottom sheet handle: drag up → full height, drag down → half (or close from half), tap → toggle size.
export function attachSheetDrag(sheet: HTMLElement, handle: HTMLElement, o: { expandable: boolean; onClose(): void }): () => void {
  let startY: number | null = null;
  const setFull = (on: boolean) => {
    sheet.classList.toggle('is-full', on);
    if (o.expandable) handle.setAttribute('aria-expanded', String(on));
  };
  const onDown = (e: Event) => { startY = (e as MouseEvent).clientY; };
  const onUp = (e: Event) => {
    if (startY === null) return;
    const dy = (e as MouseEvent).clientY - startY;
    startY = null;
    if (dy > SHEET_DRAG_PX) {
      if (sheet.classList.contains('is-full')) setFull(false); else o.onClose();
      return;
    }
    if (!o.expandable) return;
    if (dy < -SHEET_DRAG_PX) setFull(true);
    else setFull(!sheet.classList.contains('is-full'));
  };
  const onKey = (e: Event) => {
    const key = (e as KeyboardEvent).key;
    if (key === 'Escape') { o.onClose(); return; }
    if (key !== 'Enter' && key !== ' ') return;
    e.preventDefault();
    if (o.expandable) setFull(!sheet.classList.contains('is-full')); else o.onClose();
  };
  if (o.expandable) handle.setAttribute('aria-expanded', 'false');
  handle.addEventListener('pointerdown', onDown);
  document.addEventListener('pointerup', onUp);
  handle.addEventListener('keydown', onKey);
  return () => {
    handle.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    handle.removeEventListener('keydown', onKey);
  };
}
