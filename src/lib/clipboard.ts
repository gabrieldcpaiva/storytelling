export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* In embedded previews, use the selection fallback. */
    }
  }
  const previousFocus = document.activeElement as HTMLElement | null;
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  const success = document.execCommand('copy');
  area.remove();
  previousFocus?.focus();
  if (!success) throw new Error('Clipboard access was blocked. Download the file instead.');
}
