import './endingDialog.css';

/** The final card uses browser layout so reading and touch targets never scale with the canvas. */
export function createEndingDialog(options: {
  title: string;
  text: string;
  replay: () => void;
  titleScreen: () => void;
}): () => void {
  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-game-dialog story-ending-dialog';
  dialog.dataset.storyEndingDialog = '';
  const title = document.createElement('h2');
  title.id = 'story-ending-title'; title.textContent = options.title; title.tabIndex = -1;
  dialog.setAttribute('aria-labelledby', title.id);
  const text = document.createElement('p');
  text.id = 'story-ending-description'; text.textContent = options.text;
  dialog.setAttribute('aria-describedby', text.id);
  const actions = document.createElement('div'); actions.className = 'story-ending-actions';
  let leaving = false;
  let disposed = false;
  const activate = (callback: () => void) => {
    if (leaving || disposed) return;
    leaving = true;
    callback();
  };
  const replay = document.createElement('button');
  replay.type = 'button'; replay.textContent = 'Letzten Abschnitt wiederholen';
  const toTitle = document.createElement('button');
  toTitle.type = 'button'; toTitle.textContent = 'Zurück zum Titel';
  const replayClick = () => activate(options.replay);
  const titleClick = () => activate(options.titleScreen);
  replay.addEventListener('click', replayClick); toTitle.addEventListener('click', titleClick);
  const hint = document.createElement('p'); hint.className = 'story-ending-keyboard'; hint.textContent = 'R: Abschnitt wiederholen · T: Titel';
  actions.append(replay, toTitle); dialog.append(title, text, actions, hint);
  const keyboard = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const action = event.code === 'KeyR' ? options.replay : event.code === 'KeyT' ? options.titleScreen : undefined;
    // Keep native Tab/Enter/Space behavior while suppressing game shortcuts.
    event.stopPropagation();
    if (!action) return;
    event.preventDefault(); activate(action);
  };
  const cancel = (event: Event) => event.preventDefault();
  document.addEventListener('keydown', keyboard, true); dialog.addEventListener('cancel', cancel);
  const previousEnding = document.documentElement.dataset.storyEnding;
  document.documentElement.dataset.storyEnding = 'true';
  document.body.append(dialog); dialog.showModal(); title.focus({ preventScroll: true });
  return () => {
    if (disposed) return;
    disposed = true;
    document.removeEventListener('keydown', keyboard, true); dialog.removeEventListener('cancel', cancel);
    replay.removeEventListener('click', replayClick); toTitle.removeEventListener('click', titleClick);
    dialog.close(); dialog.remove();
    if (previousEnding === undefined) delete document.documentElement.dataset.storyEnding;
    else document.documentElement.dataset.storyEnding = previousEnding;
  };
}
