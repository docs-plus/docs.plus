// The floating engine was hoisted to its own published package so the
// hypermultimedia extension can share one popover surface. This shim keeps
// every internal `../floating-popover` import path stable.
export * from '@docs.plus/floating-popover'
