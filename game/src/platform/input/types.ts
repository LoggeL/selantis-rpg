export type InputAction = 'move-up' | 'move-left' | 'move-down' | 'move-right' | 'interact' | 'continue' | 'beam' | 'wave' | 'wait' | 'confirm' | 'cancel' | 'inventory' | 'party' | 'settings' | 'bookmark';
export type InputPhase = 'begin' | 'end' | 'activate';
export type InputSource = 'keyboard' | 'touch' | 'pointer';
export type InputIntent = { action: InputAction; phase: InputPhase; source: InputSource; owner?: string; value?: string };
export type IntentHandler = (intent: InputIntent) => void | boolean;
export type IntentHandlers = Partial<Record<InputAction, IntentHandler>>;
export type ActionKey = 'E' | 'Q' | 'R' | 'SPACE' | 'ENTER' | 'ESC';
export type Direction = 'up' | 'left' | 'down' | 'right';
export type ControlProfile = {
  directions: Direction[];
  actions: Partial<Record<ActionKey, string>>;
  bindings?: Partial<Record<ActionKey, InputAction>>;
  inventory?: boolean;
  disabled?: boolean;
};
export const KEY_ACTIONS: Record<ActionKey, InputAction> = { E: 'interact', Q: 'beam', R: 'wave', SPACE: 'wait', ENTER: 'confirm', ESC: 'cancel' };
export const CODE_ACTIONS: Record<string, InputAction> = {
  ArrowUp: 'move-up', KeyW: 'move-up', ArrowLeft: 'move-left', KeyA: 'move-left',
  ArrowDown: 'move-down', KeyS: 'move-down', ArrowRight: 'move-right', KeyD: 'move-right',
  KeyE: 'interact', KeyQ: 'beam', KeyR: 'wave', Space: 'wait', Enter: 'confirm', Escape: 'cancel',
  KeyI: 'inventory', KeyC: 'party', KeyO: 'settings',
};
export const CODE_KEYS: Partial<Record<string, ActionKey>> = { KeyE: 'E', KeyQ: 'Q', KeyR: 'R', Space: 'SPACE', Enter: 'ENTER', Escape: 'ESC' };
