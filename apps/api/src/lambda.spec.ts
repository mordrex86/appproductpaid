import { handler } from './lambda';

describe('Lambda handler', () => {
  it('uses the asynchronous Node.js 24 handler signature', () => {
    expect(handler).toHaveLength(2);
  });
});
