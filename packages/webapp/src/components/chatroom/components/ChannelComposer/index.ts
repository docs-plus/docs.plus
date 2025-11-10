/**
 * ChannelComposer - Production-ready compound component for channel access management
 *
 * @example
 * // Smart mode (recommended) - automatically handles all channel access logic
 * <ChannelComposer />
 *
 * @example
 * // Manual mode - custom control over what's displayed
 * <ChannelComposer>
 *   <ChannelComposer.JoinGroup />
 * </ChannelComposer>
 *
 * @example
 * // Direct access control usage
 * <ChannelComposer.AccessControl />
 */
export { default } from './ChannelComposer'

// Named exports for advanced usage
export type { ChannelComposerProps } from './ChannelComposer'
