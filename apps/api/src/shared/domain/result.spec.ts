import { failure, success } from './result';

describe('Result', () => {
  it('creates a successful result', () => {
    expect(success('value')).toEqual({
      ok: true,
      value: 'value',
    });
  });

  it('creates a failed result', () => {
    expect(failure('reason')).toEqual({
      error: 'reason',
      ok: false,
    });
  });
});
