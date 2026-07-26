import '@testing-library/jest-dom';

Object.defineProperty(globalThis, 'fetch', {
  configurable: true,
  value: jest.fn(),
  writable: true,
});

HTMLDialogElement.prototype.showModal = function showModal() {
  this.setAttribute('open', '');
};

HTMLDialogElement.prototype.close = function close() {
  this.removeAttribute('open');
};
