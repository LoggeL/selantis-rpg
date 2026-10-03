/** Native controls stay readable and keep their touch targets independent of canvas scale. */
export const usesMobileInterface = () => typeof matchMedia === 'function' &&
  matchMedia('(any-pointer: coarse), (max-width: 900px)').matches;
let dialogId = 0;

export function createMobileDialog(title: string, onDismiss: () => void) {
  if (!document.getElementById('mobile-game-dialog-style')) {
    const style = document.createElement('style');
    style.id = 'mobile-game-dialog-style';
    style.textContent = `
      .mobile-game-dialog { box-sizing:border-box; width:min(420px,calc(100vw - 24px)); max-height:calc(100dvh - 24px); overflow:auto; margin:auto; padding:20px; border:2px solid #8a7a5a; border-radius:12px; background:#141b1a; color:#e8e2d0; font:16px/1.5 system-ui,sans-serif; }
      .mobile-game-dialog::backdrop { background:rgba(7,11,10,.88); }
      .mobile-game-dialog h2 { margin:0 0 16px; font-size:22px; }
      .mobile-game-dialog button { min-height:48px; border:1px solid #9cc4ec; border-radius:8px; padding:10px 18px; background:#252c35; color:#e8e2d0; font:inherit; cursor:pointer; touch-action:manipulation; }
      .mobile-game-dialog button:focus-visible,.mobile-game-dialog input:focus-visible { outline:3px solid #d6ad59; outline-offset:3px; }
      .mobile-game-dialog label { display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:52px; }
      .mobile-game-dialog input[type=range] { display:block; width:100%; height:48px; accent-color:#9cc4ec; touch-action:pan-x; }
      .mobile-game-dialog input[type=checkbox] { width:26px; height:26px; accent-color:#9cc4ec; flex:none; }
      .mobile-game-dialog .mobile-dialog-content { margin-bottom:18px; }
      .mobile-game-dialog ul { list-style:none; padding:0; margin:0; }
      .mobile-game-dialog li { display:flex; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid #394034; }
      .mobile-game-dialog p { margin:8px 0; }
      .mobile-game-dialog .mobile-dialog-close { width:100%; }
    `;
    document.head.append(style);
  }
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
