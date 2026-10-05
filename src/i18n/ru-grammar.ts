// Russian prepositional case for language names ("на испанском", "на иврите", "на латыни", "на хинди").
export function prepositional(name: string): string {
  const n = name.trim();
  if (/(ий|ый|ой)$/.test(n)) return `${n.slice(0, -2)}ом`;
  if (n.endsWith('ь')) return `${n.slice(0, -1)}и`;
  if (/[бвгджзклмнпрстфхцчшщ]$/.test(n)) return `${n}е`;
  return n;
}
