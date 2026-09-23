/**
 * Phone Find only while the pad owns the keyboard. An open chat pane owns the keyboard
 * and the 96px document floor, so the phone find bar yields to it. Desktop always may.
 */
export const canOpenFind = (isMobile: boolean, padOwnsKeyboard: boolean): boolean =>
  !isMobile || padOwnsKeyboard
