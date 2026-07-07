/// <reference types="cypress" />

/** README gallery — `bun run docs:screenshots`; skipped by release-gate `cypress/e2e/` runs. */

import type { Editor } from '@tiptap/core'

import {
  prepareReadmeGalleryViewport,
  readmeGalleryShotOpts,
  setPlaygroundTheme,
  type ReadmeGalleryTheme
} from '@docs.plus/playground/cypress/readmeGallery'

import {
  README_AUDIO,
  README_GALLERY_EMBED_SETTLE_MS,
  README_GALLERY_LOCAL_MEDIA_SETTLE_MS,
  README_GALLERY_LOOM_HEIGHT,
  README_GALLERY_LOOM_READY_TIMEOUT_MS,
  README_GALLERY_LOOM_SETTLE_MS,
  README_GALLERY_SOUNDCLOUD_SETTLE_MS,
  README_GALLERY_TOOLBAR_SETTLE_MS,
  README_GALLERY_WIDTH,
  README_GALLERY_X_WIDGETS_SETTLE_MS,
  README_IMAGE,
  README_IMAGE_GALLERY_LAYOUT,
  README_LOOM,
  README_LOOM_EMBED_ID,
  README_LOOM_GALLERY_OPTS,
  README_MEDIA_HAVE_CURRENT_DATA,
  readmeGalleryLayout,
  readmeGalleryXLayout,
  README_GALLERY_SPOTIFY_HEIGHT,
  README_GALLERY_SPOTIFY_SETTLE_MS,
  README_SOUNDCLOUD,
  README_SPOTIFY,
  README_VIDEO,
  README_VIMEO,
  README_X,
  README_YOUTUBE
} from './readmeMedia'

const SCOPE = {
  image: '#editor .hypermultimedia--image__content',
  video: '#editor .hypermultimedia--video__content',
  audio: '#editor .hypermultimedia--audio__content',
  youtube: '#editor .hypermultimedia--youtube__content',
  vimeo: '#editor .hypermultimedia--vimeo__content',
  soundcloud: '#editor .hypermultimedia--soundcloud__content',
  spotify: '#editor .hypermultimedia--spotify__content',
  loom: '#editor .hypermultimedia--loom__content',
  x: '#editor .hypermultimedia--x__content'
} as const

type ScopeKey = keyof typeof SCOPE

type GalleryScene = {
  slug: string
  scope: ScopeKey
  loadingShell?: boolean
  settleMs?: number
  withGripper?: boolean
  beforeScene?: () => void
  setup: (editor: Editor, theme: ReadmeGalleryTheme) => void
  ready?: (theme: ReadmeGalleryTheme) => void
}

type LoadingShellReadyOpts = {
  provider?: string
  timeout?: number
}

function expectLoadingShellReady(scope: string, opts?: LoadingShellReadyOpts): void {
  if (opts?.provider) {
    cy.expectMediaLoadingPending(opts.provider, scope)
  }
  cy.expectMediaLoadingReady(scope, opts?.timeout)
}

function isHtmlMediaElement(el: Element): el is HTMLVideoElement | HTMLAudioElement {
  return el.nodeName === 'VIDEO' || el.nodeName === 'AUDIO'
}

function expectMediaDecoded(selector: string, requireVideoFrame = false): void {
  cy.get(selector).should(($el) => {
    const media = $el[0]
    if (!isHtmlMediaElement(media)) {
      throw new Error(`Expected video/audio element, got ${media.nodeName}`)
    }
    expect(media.readyState, 'readyState').to.be.gte(README_MEDIA_HAVE_CURRENT_DATA)
    if (requireVideoFrame) {
      // nodeName guard, not instanceof — AUT-realm elements fail cross-realm instanceof.
      const isVideo = (m: HTMLMediaElement): m is HTMLVideoElement => m.nodeName === 'VIDEO'
      if (!isVideo(media)) {
        throw new Error('Expected VIDEO for frame decode')
      }
      expect(media.videoWidth, 'videoWidth').to.be.gt(0)
    }
  })
}

const GALLERY_SCENES: GalleryScene[] = [
  {
    slug: 'preview',
    scope: 'image',
    loadingShell: false,
    setup: (editor) => {
      editor.commands.setImage({
        src: README_IMAGE,
        alt: 'Sample photo',
        ...README_IMAGE_GALLERY_LAYOUT
      })
    },
    ready: () => {
      cy.get('#editor img').should('be.visible')
    }
  },
  {
    slug: 'image',
    scope: 'image',
    setup: (editor) => {
      editor.commands.setImage({
        src: README_IMAGE,
        alt: 'Grapefruit slice',
        ...README_IMAGE_GALLERY_LAYOUT
      })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.image)
      cy.get('#editor img').should('be.visible')
    }
  },
  {
    slug: 'video',
    scope: 'video',
    settleMs: README_GALLERY_LOCAL_MEDIA_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setVideo({ src: README_VIDEO, ...readmeGalleryLayout() })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.video)
      expectMediaDecoded('#editor video', true)
    }
  },
  {
    slug: 'audio',
    scope: 'audio',
    settleMs: README_GALLERY_LOCAL_MEDIA_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setAudio({ src: README_AUDIO, ...readmeGalleryLayout() })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.audio)
      expectMediaDecoded('#editor audio')
    }
  },
  {
    slug: 'youtube',
    scope: 'youtube',
    settleMs: README_GALLERY_EMBED_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setYoutubeVideo({ src: README_YOUTUBE, ...readmeGalleryLayout() })
    },
    ready: () => {
      cy.nodeCount('youtube').should('eq', 1)
      expectLoadingShellReady(SCOPE.youtube, { provider: 'YouTube' })
    }
  },
  {
    slug: 'vimeo',
    scope: 'vimeo',
    settleMs: README_GALLERY_EMBED_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setVimeo({ src: README_VIMEO, ...readmeGalleryLayout() })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.vimeo)
      cy.get('#editor iframe').should('have.attr', 'src').and('include', 'player.vimeo.com')
    }
  },
  {
    slug: 'soundcloud',
    scope: 'soundcloud',
    settleMs: README_GALLERY_SOUNDCLOUD_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setSoundCloud({ src: README_SOUNDCLOUD, ...readmeGalleryLayout() })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.soundcloud, { provider: 'SoundCloud' })
      cy.get('#editor iframe').should('have.attr', 'src').and('include', 'w.soundcloud.com')
    }
  },
  {
    slug: 'spotify',
    scope: 'spotify',
    settleMs: README_GALLERY_SPOTIFY_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setSpotify({
        src: README_SPOTIFY,
        ...readmeGalleryLayout(README_GALLERY_WIDTH, README_GALLERY_SPOTIFY_HEIGHT)
      })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.spotify, { provider: 'Spotify' })
      cy.get('#editor iframe').should('have.attr', 'src').and('include', 'open.spotify.com/embed')
    }
  },
  {
    slug: 'loom',
    scope: 'loom',
    settleMs: README_GALLERY_LOOM_SETTLE_MS,
    setup: (editor) => {
      editor.commands.setLoom({
        src: README_LOOM,
        ...README_LOOM_GALLERY_OPTS,
        ...readmeGalleryLayout(README_GALLERY_WIDTH, README_GALLERY_LOOM_HEIGHT)
      })
    },
    ready: () => {
      expectLoadingShellReady(SCOPE.loom, { timeout: README_GALLERY_LOOM_READY_TIMEOUT_MS })
      cy.get('#editor iframe')
        .should('have.attr', 'src')
        .and('include', `loom.com/embed/${README_LOOM_EMBED_ID}`)
        .and('include', 'hideEmbedTopBar=true')
      cy.get('#editor iframe').should('have.attr', 'scrolling', 'no')
      cy.get('#editor iframe')
        .invoke('outerHeight')
        .should('be.gte', README_GALLERY_LOOM_HEIGHT - 2)
    }
  },
  {
    slug: 'x',
    scope: 'x',
    loadingShell: false,
    settleMs: README_GALLERY_X_WIDGETS_SETTLE_MS,
    withGripper: false,
    beforeScene: () => {
      cy.intercept('GET', 'https://publish.x.com/oembed*').as('xOembedReadme')
    },
    setup: (editor, theme) => {
      editor.commands.setX({ src: README_X, ...readmeGalleryXLayout(theme) })
    },
    ready: (theme) => {
      cy.wait('@xOembedReadme')
      cy.nodeCount('x').should('eq', 1)
      cy.nodeAttr('x', 'theme').should('eq', theme)
      cy.get(SCOPE.x + ' iframe', { timeout: 15000 }).should('exist')
    }
  }
]

function prepareGalleryScene(loadingShell = true): void {
  prepareReadmeGalleryViewport()
  cy.visitPlayground(loadingShell ? '' : 'loadingShell=false')
  cy.setEditorContent('<p></p>')
}

function showReadmeMediaControls(contentSelector: string, withGripper = true): void {
  cy.hoverMediaControls(contentSelector)
  if (withGripper) {
    cy.get('#editor .hypermultimedia__resize-gripper--active').should('exist')
  }
  cy.get('#editor .media-toolbar').should('be.visible')
  cy.wait(README_GALLERY_TOOLBAR_SETTLE_MS)
}

function runGalleryScene(scene: GalleryScene, theme: ReadmeGalleryTheme): void {
  scene.beforeScene?.()
  prepareGalleryScene(scene.loadingShell ?? true)
  setPlaygroundTheme(theme)
  cy.getEditor().then((editor) => {
    scene.setup(editor, theme)
  })
  scene.ready?.(theme)
  if (scene.settleMs) {
    cy.wait(scene.settleMs)
  }
  showReadmeMediaControls(SCOPE[scene.scope], scene.withGripper ?? true)
  cy.screenshot(`${scene.slug}-${theme}`, readmeGalleryShotOpts)
}

describe('README screenshot gallery', () => {
  for (const theme of ['light', 'dark'] as const) {
    describe(`${theme} theme`, () => {
      for (const scene of GALLERY_SCENES) {
        it(`captures ${scene.slug} (${theme})`, () => {
          runGalleryScene(scene, theme)
        })
      }
    })
  }
})

export {}
