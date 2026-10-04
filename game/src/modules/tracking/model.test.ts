import { describe, expect, it } from 'vitest';
import { TrackingModel } from './model';
describe('tracking evidence and route decision', () => {
  it('cannot win by guessing the correct route or by inspecting two unrelated clues', () => {
    const model = new TrackingModel();
    expect(model.choose('forward')).toBe(false);
    model.inspect('hooves'); model.inspect('ground');
    expect(model.choose('forward')).toBe(false);
    expect(model.state.phase).toBe('inspect');
    expect(model.state.attempts).toBe(0);
  });
  it('wrong route has feedback and must be retried before another decision', () => {
    const model = new TrackingModel(); model.inspect('hooves'); model.inspect('bark');
    expect(model.choose('back')).toBe(false);
    expect(model.state.phase).toBe('failed'); expect(model.state.feedback).toContain('Hier verliert');
    expect(model.choose('forward')).toBe(false);
    model.retry(); expect(model.state.examined).toEqual(['hooves', 'bark']);
    expect(model.choose('forward')).toBe(true);
    expect(model.state.attempts).toBe(2); expect(model.state.phase).toBe('solved');
  });
  it('inspection is idempotent and snapshots cannot modify evidence', () => {
    const model = new TrackingModel(); model.inspect('bark'); model.inspect('bark');
    const snapshot = model.snapshot(); snapshot.examined.push('hooves');
    expect(model.state.examined).toEqual(['bark']);
  });
  it('cancelled and successful challenges cannot be advanced again', () => {
    const cancelled = new TrackingModel(); cancelled.cancel(); cancelled.inspect('bark');
    expect(cancelled.choose('forward')).toBe(false); expect(cancelled.state.examined).toEqual([]);
    const solved = new TrackingModel(); solved.inspect('hooves'); solved.inspect('bark'); solved.choose('forward');
    const before = solved.snapshot(); solved.retry(); solved.cancel(); solved.inspect('ground'); solved.choose('back');
    expect(solved.snapshot()).toEqual(before);
  });
});
