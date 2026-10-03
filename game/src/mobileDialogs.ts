/** Native controls stay readable and keep their touch targets independent of canvas scale. */
export const usesMobileInterface = () => typeof matchMedia === 'function' &&
  matchMedia('(any-pointer: coarse), (max-width: 900px)').matches;
let dialogId = 0;

export function createMobileDialog(title: string, onDismiss: () => void) {
  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-game-dialog';
  const heading = document.createElement('h2');
  heading.textContent = title;
  heading.id = `mobile-dialog-${++dialogId}`;
  heading.tabIndex = -1;
  heading.setAttribute('autofocus', '');
  dialog.setAttribute('aria-labelledby', heading.id);
  const content = document.createElement('div');
  content.className = 'mobile-dialog-content';
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'mobile-dialog-close';
  close.textContent = 'Zurück zum Spiel';
  close.addEventListener('click', onDismiss);
  dialog.addEventListener('cancel', event => { event.preventDefault(); onDismiss(); });
  dialog.append(heading, content, close);
  document.body.append(dialog);
  dialog.showModal();
  heading.focus({ preventScroll: true });
  dialog.scrollTop = 0;
  return { content, destroy: () => { dialog.close(); dialog.remove(); } };
}
