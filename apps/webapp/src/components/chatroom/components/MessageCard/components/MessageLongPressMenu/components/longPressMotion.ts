// A sibling module: MessageLongPressMenu.tsx imports all three panels, so a helper there is a cycle.
export const longPressMotionClass = (isVisible: boolean) =>
  `transition-[opacity,transform] motion-reduce:transition-none ${
    isVisible
      ? 'duration-[var(--motion-overlay-in)] ease-[var(--motion-ease-enter)]'
      : 'duration-[var(--motion-overlay-out)] ease-[var(--motion-ease-exit)]'
  }`
