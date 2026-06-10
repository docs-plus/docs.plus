// The floating engine lives in `@docs.plus/floating-popover` — a private
// workspace package bundled into this extension's dist (each consuming
// extension bundles its own controller instance; there is no cross-package
// singleton). This shim keeps internal `../floating-popover` paths stable.
export * from '@docs.plus/floating-popover'
