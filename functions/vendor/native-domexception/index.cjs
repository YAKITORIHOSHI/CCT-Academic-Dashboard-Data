// Node 22 already provides DOMException. Preserve the old polyfill's module contract.
module.exports = globalThis.DOMException;
