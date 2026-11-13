// Stored bytes of each loaded room, keyed by its Hocuspocus Document. The WeakMap lets an
// unloaded room drop out on its own. Yjs-free, so metrics.ts and the hooks can share it.
export const loadedStateBytes = new WeakMap<object, number>()
