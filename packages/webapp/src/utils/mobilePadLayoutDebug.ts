/** Paste `dumpMobilePadLayoutDebug()` in Safari Web Inspector (Sources → Snippets) while reproducing. */

function rectLike(el: Element | null) {
  if (!el) return null
  const r = el.getBoundingClientRect()
  return {
    top: r.top,
    left: r.left,
    bottom: r.bottom,
    right: r.right,
    width: r.width,
    height: r.height
  }
}

export function dumpMobilePadLayoutDebug(): Record<string, unknown> {
  if (typeof window === 'undefined') return {}
  const vv = window.visualViewport
  const root = document.querySelector('.mobileLayoutRoot')
  const hdr = document.querySelector('.mobilePadTitleShell')
  const tb = document.querySelector('.mobileToolbarBottom')
  const wrap = document.querySelector(
    '.mobileLayoutRoot .editor.editorWrapper'
  ) as HTMLElement | null
  const pm = document.querySelector('.mobileLayoutRoot .ProseMirror') as HTMLElement | null
  let domCaretRect: Record<string, number> | null = null
  try {
    const sel = window.getSelection()
    if (sel?.rangeCount) {
      const r = sel.getRangeAt(0).getBoundingClientRect()
      domCaretRect = {
        top: r.top,
        left: r.left,
        bottom: r.bottom,
        right: r.right,
        width: r.width,
        height: r.height
      }
    }
  } catch {
    domCaretRect = null
  }

  const html = document.documentElement
  return {
    vv: vv
      ? { height: vv.height, width: vv.width, offsetTop: vv.offsetTop, offsetLeft: vv.offsetLeft }
      : null,
    window: {
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      scrollY: window.scrollY
    },
    cssVars: {
      vvh:
        html.style.getPropertyValue('--visual-viewport-height') ||
        getComputedStyle(html).getPropertyValue('--visual-viewport-height'),
      vvot: getComputedStyle(html).getPropertyValue('--visual-viewport-offset-top'),
      vvol: getComputedStyle(html).getPropertyValue('--visual-viewport-offset-left'),
      vvw: getComputedStyle(html).getPropertyValue('--visual-viewport-width')
    },
    root: rectLike(root),
    mobilePadTitleShell: rectLike(hdr),
    mobileToolbarBottom: rectLike(tb),
    editorWrapper: wrap
      ? { ...rectLike(wrap), scrollTop: wrap.scrollTop, scrollHeight: wrap.scrollHeight }
      : null,
    proseMirror: rectLike(pm),
    domSelectionCaretRect: domCaretRect,
    gapRootBottomToVv:
      vv && root ? vv.offsetTop + vv.height - root.getBoundingClientRect().bottom : null,
    gapToolbarBottomToRootBottom:
      tb && root ? root.getBoundingClientRect().bottom - tb.getBoundingClientRect().bottom : null
  }
}
