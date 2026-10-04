import { describe, expect, it } from 'vitest';
import { assetUrl } from "../platform/assets/url";

describe('content-versioned asset URLs', () => {
  it('uses the build content digest by default for relative and root URLs', () => {
    expect(assetUrl('assets/sprites/road-travelers-walk.png')).toMatch(/^assets\/sprites\/road-travelers-walk\.png\?v=[a-f0-9]{12}$/);
    expect(assetUrl('/assets/ui/bag-open.png').split('?')[1]).toBe(assetUrl('assets/manifest.json').split('?')[1]);
  });
  it('changes the cache key when the content revision changes', () => {
    expect(assetUrl('assets/sheet.png', 'first')).not.toBe(assetUrl('assets/sheet.png', 'second'));
    expect(assetUrl('assets/sheet.png', 'first')).toBe('assets/sheet.png?v=first');
  });
  it('preserves query values and fragments, placing the revision before the fragment', () => {
    expect(assetUrl('/assets/sheet.png?mode=1%202&frame=4#preview', 'abc')).toBe('/assets/sheet.png?mode=1%202&frame=4&v=abc#preview');
    expect(assetUrl('assets/sheet.png#south', 'abc')).toBe('assets/sheet.png?v=abc#south');
    expect(assetUrl('assets/sheet.png?', 'abc')).toBe('assets/sheet.png?v=abc');
  });
  it('replaces a prior revision and remains idempotent without mutating the input', () => {
    const path = 'assets/sheet.png?v=old&frame=4#south';
    const updated = assetUrl(path, 'new');
    expect(updated).toBe('assets/sheet.png?v=new&frame=4#south');
    expect(assetUrl(updated, 'new')).toBe(updated);
    expect(path).toBe('assets/sheet.png?v=old&frame=4#south');
    expect(assetUrl('assets/sheet.png', 'space & hash#')).toBe('assets/sheet.png?v=space%20%26%20hash%23');
  });
});
