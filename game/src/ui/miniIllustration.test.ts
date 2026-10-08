import { describe, expect, it } from 'vitest';
import { emptyManifest } from '../art/manifest';
import { wakeCandidates } from './miniIllustration';

describe('open-eyes backdrop', () => {
  const art = { ...emptyManifest(), plates: { 'k2-geweckt': { file: 'assets/cut/k2-geweckt.jpg' } }, backgrounds: { 'e2-ignatius-lager': { file: 'assets/bg/e2-ignatius-lager.png' }, 'k3-leselager': { file: 'assets/bg/k3-leselager.png' } } } as never;

  it('shows the scene plate first, the blurred map background as fallback', () => {
    expect(wakeCandidates({ backdrop: 'e2-der-fremde-geweckt', fallback: 'e2-ignatius-lager' }, art, 'k3-leselager')).toEqual([
      { file: 'assets/cut/e2-der-fremde-geweckt.jpg', blurred: false, lantern: false },
      { file: 'assets/bg/e2-ignatius-lager.png', blurred: true, lantern: false },
    ]);
  });

  it('never falls back to Foltan and Azar: without a backdrop the running map is used', () => {
    expect(wakeCandidates({}, art, 'k3-leselager')).toEqual([{ file: 'assets/bg/k3-leselager.png', blurred: true, lantern: false }]);
    expect(wakeCandidates({}, art, undefined)).toEqual([]);
  });

  it('keeps the lantern lights only for the Kapitel II plate', () => {
    expect(wakeCandidates({ backdrop: 'k2-geweckt' }, art, undefined)[0]).toEqual({ file: 'assets/cut/k2-geweckt.jpg', blurred: false, lantern: true });
  });
});
