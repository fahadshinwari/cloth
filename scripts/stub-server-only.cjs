/**
 * Test-only shim: neutralizes the `server-only` guard package so the real
 * service layer can run under tsx/node outside React Server Components.
 */
/* eslint-disable @typescript-eslint/no-require-imports */
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
