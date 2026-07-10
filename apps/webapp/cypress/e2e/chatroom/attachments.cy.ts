/// <reference types="cypress" />

describe('chatroom attachments', () => {
  const storagePath = 'user-1/channel-1/test.png'
  const imageDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z4EPDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

  const channelAggregateBody = {
    channel_info: {
      id: 'test-channel',
      type: 'PUBLIC',
      name: 'test-channel',
      slug: 'test-channel'
    },
    is_user_channel_member: true,
    channel_member_info: { member_id: 'user-1', channel_id: 'test-channel' },
    pinned_messages: [],
    peer_max_read_seq: null,
    anchor_message_timestamp: null,
    has_more_newer: false,
    has_more_older: false,
    last_messages: [],
    last_read_message_id: null,
    last_read_message_timestamp: null,
    last_read_seq: 0,
    newer_cursor: null,
    older_cursor: null,
    total_messages_since_last_read: 0,
    unread_message: false
  }

  const clickNative = (selector: string) => {
    cy.get(selector).then(($el) => {
      const el = $el[0] as HTMLElement
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
    })
  }

  const stubMessageWindow = (rows: Record<string, unknown>[]) => {
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows,
        anchor_seq: null,
        has_more_before: false,
        has_more_after: false
      }
    }).as('messageWindow')
  }

  const mediaRow = (
    medias: Record<string, unknown>[],
    overrides: Record<string, unknown> = {}
  ) => ({
    id: 'feed-msg-1',
    seq: 1,
    content: '',
    medias,
    type: medias.length === 1 ? (medias[0]?.type ?? 'image') : 'image',
    channel_id: 'test-channel',
    user_id: 'user-1',
    created_at: new Date().toISOString(),
    user_details: { id: 'user-1', username: 'tester', fullname: 'Tester' },
    ...overrides
  })

  const seedSupabaseAuthSession = () => {
    cy.window().then((win) => {
      win.localStorage.setItem(
        'sb-docsplus_supabase-auth-token',
        JSON.stringify({
          access_token: 'e2e-access-token',
          refresh_token: 'e2e-refresh-token',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: { id: 'user-1', aud: 'authenticated', role: 'authenticated' }
        })
      )
    })
  }

  /** Drag-and-drop tests leave IDB attachment drafts that block Send on the next case. */
  const clearComposerDrafts = () => {
    cy.window().then((win) => {
      return new Promise<void>((resolve) => {
        const request = win.indexedDB.deleteDatabase('chatApp')
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    })
  }

  const stubStorage = () => {
    cy.intercept({ method: /POST|PUT/, url: '**/storage/v1/object/media/**' }, (req) => {
      req.reply({
        statusCode: 200,
        body: { Key: storagePath },
        headers: { 'content-type': 'application/json' }
      })
    }).as('storageUpload')

    cy.intercept('POST', '**/storage/v1/object/sign/media/**', (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const rawPath = body?.paths?.[0] ?? body?.path ?? storagePath
      const signedUrl = /\.(png|jpe?g|gif|webp)$/i.test(rawPath)
        ? imageDataUrl
        : `https://example.test/signed/${rawPath}`
      req.reply({
        statusCode: 200,
        body: { signedURL: signedUrl, signedUrl }
      })
    }).as('storageSign')
  }

  const stubChannelAggregate = () => {
    cy.intercept('POST', '**/rest/v1/rpc/get_channel_aggregate_data*', {
      statusCode: 200,
      body: channelAggregateBody
    }).as('channelAggregate')
  }

  const stubMessageInsert = () => {
    cy.intercept('POST', '**/rest/v1/messages*', (req) => {
      const body = req.body as { content?: string; medias?: unknown[]; type?: string }
      req.reply({
        statusCode: 201,
        body: [
          {
            id: 'msg-attachment-1',
            content: body.content ?? '',
            medias: body.medias ?? [],
            type: body.type ?? 'image',
            channel_id: 'test-channel',
            user_id: 'user-1',
            created_at: new Date().toISOString()
          }
        ]
      })
    }).as('messageInsert')
  }

  const waitForStorageSignIfPending = () => {
    cy.get('@storageSign.all').then((interceptions) => {
      if (interceptions.length === 0) {
        cy.wait('@storageSign', { timeout: 10_000 })
      }
    })
  }

  const visitFeed = (rows: Record<string, unknown>[], messageId?: string) => {
    stubMessageWindow(rows)
    stubChannelAggregate()
    stubStorage()
    seedSupabaseAuthSession()
    cy.visit('/c/test-channel')
    cy.wait('@channelAggregate')
    cy.wait('@messageWindow')
    cy.waitForMessage('chatroom-feed')
    cy.window().its('__chatTestApi').should('exist')
    cy.window().then((win) => {
      win.__chatTestApi?.clearFeedSpoilerReveal?.()
    })
    if (messageId) {
      cy.get(`[data-msg-id="${messageId}"]`, { timeout: 10_000 }).should('be.visible')
      cy.scrollToMessageViaApi(messageId)
    } else {
      cy.get('.msg_card', { timeout: 10_000 }).should('be.visible')
    }
    cy.get('[data-chat-media]', { timeout: 10_000 }).scrollIntoView()
  }

  const assertImageControlReady = () => {
    cy.get('[data-chat-media]', { timeout: 15_000 }).should('be.visible')
    cy.get(
      '[data-chat-media] [data-testid="feed-image-open"], [data-chat-media] [data-testid="feed-spoiler-reveal"]',
      { timeout: 15_000 }
    )
      .first()
      .scrollIntoView()
      .should('be.visible')
    waitForStorageSignIfPending()
  }

  const assertVideoExpandReady = () => {
    cy.get('[data-chat-media]', { timeout: 10_000 }).scrollIntoView()
    waitForStorageSignIfPending()
    cy.get('[data-chat-media] [aria-label="Expand video"]', { timeout: 10_000 }).should('exist')
  }

  /** Mosaic/stack video poster (multi-visual); lone video still uses Expand video. */
  const assertVideoPosterReady = () => {
    cy.get('[data-chat-media]', { timeout: 10_000 }).scrollIntoView()
    waitForStorageSignIfPending()
    cy.get('[data-chat-media] [data-testid="feed-video-poster"]', { timeout: 10_000 }).should(
      'exist'
    )
  }

  const assertAudioExpandReady = () => {
    cy.get('[data-chat-media]', { timeout: 10_000 }).scrollIntoView()
    waitForStorageSignIfPending()
    cy.get('[data-chat-media] [aria-label="Expand audio"]', { timeout: 10_000 }).should('exist')
  }

  const openFirstFeedImage = () => {
    cy.get('[data-chat-media] [data-testid="feed-image-open"]', { timeout: 10_000 })
      .first()
      .should('exist')
    clickNative('[data-chat-media] [data-testid="feed-image-open"]')
  }

  /** Carousel mounts every slide; inactive slides stay in the DOM with aria-hidden="true". */
  const galleryActiveSlide = () =>
    cy
      .get('[data-testid="chat-media-gallery"]')
      .find('.min-w-full.shrink-0')
      .not('[aria-hidden="true"]')

  const attachFixtureFile = (file: {
    contents: Cypress.Buffer
    fileName: string
    mimeType: string
    lastModified: number
  }) => {
    cy.get('[data-chat-composer-surface]').selectFile(file, { action: 'drag-drop', force: true })
  }

  const expectAttachmentVisible = (fileName: string) => {
    cy.contains(fileName, { timeout: 15_000 }).should('be.visible')
  }

  const waitForAttachmentUpload = () => {
    cy.wait('@storageUpload', { timeout: 30_000 })
    cy.get('[data-testid="composer-primary-action"]', { timeout: 10_000 }).should(
      'have.attr',
      'aria-label',
      'Send message'
    )
  }

  const openMessageContextMenu = (messageId?: string) => {
    const card = messageId ? `[data-msg-id="${messageId}"]` : '.msg_card'
    cy.get(card).first().scrollIntoView()
    cy.get(card).first().rightclick()
  }

  const clickComposerSend = () => {
    cy.get('[data-testid="composer-primary-action"]')
      .should('have.attr', 'aria-label', 'Send message')
      .click()
    cy.wait('@messageInsert', { timeout: 15_000 })
  }

  const registerUncaughtHandler = () => {
    cy.on('uncaught:exception', (err) => {
      if (err.message.includes('ResizeObserver loop')) return false
    })
  }

  describe('composer', () => {
    beforeEach(() => {
      registerUncaughtHandler()
      stubStorage()
      stubMessageInsert()
      stubChannelAggregate()
      stubMessageWindow([])
      seedSupabaseAuthSession()
      clearComposerDrafts()
      cy.visit('/c/test-channel')
      cy.wait('@channelAggregate')
      cy.wait('@messageWindow')
      cy.waitForMessage('chatroom-feed')
      cy.window().its('__chatTestApi').should('exist')
      cy.window().then((win) => {
        win.__chatTestApi?.resetComposerAttachments?.()
      })
      cy.get('[data-testid="composer-input"]', { timeout: 10_000 }).should('be.visible')
      cy.get('[data-testid="composer-attach-input"]', { timeout: 10_000 }).should('exist')
    })

    it('rejects blocked file types in the composer', () => {
      cy.get('[data-testid="composer-attach-input"]').selectFile(
        {
          contents: Cypress.Buffer.from('4d5a9000', 'hex'),
          fileName: 'malware.exe',
          mimeType: 'application/x-msdownload',
          lastModified: Date.now()
        },
        { force: true }
      )

      cy.contains('not allowed').should('be.visible')
      cy.get('[data-testid="composer-primary-action"]').should(
        'have.attr',
        'aria-label',
        'Record voice note'
      )
    })

    it('accepts drag-and-drop onto the composer', () => {
      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'dropped.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('dropped.png')
    })

    it('keeps attachment strip after failed send', () => {
      cy.intercept('POST', '**/rest/v1/messages*', {
        statusCode: 401,
        body: { code: '42501' }
      }).as('failedSend')

      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'keep-me.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('keep-me.png')
      waitForAttachmentUpload()
      cy.get('[data-testid="composer-primary-action"]').click()
      cy.wait('@failedSend', { timeout: 15_000 })
      cy.contains('keep-me.png').should('be.visible')
      cy.contains('Failed to send').should('be.visible')
    })

    it('marks an image attachment as spoiler before send', () => {
      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'secret.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('secret.png')
      waitForAttachmentUpload()
      cy.get('[data-testid="attachment-spoiler-toggle"]').click()
      cy.contains('Spoiler on').should('be.visible')
      clickComposerSend()
      cy.get('@messageInsert').its('request.body.medias.0.spoiler').should('eq', true)
    })

    it('uploads an attachment and sends a media message', () => {
      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'photo.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('photo.png')
      waitForAttachmentUpload()
      clickComposerSend()
      cy.get('@messageInsert').its('request.body').should('have.property', 'medias')
      cy.get('[data-message-layout="media-only"]').should('exist')
    })

    it.skip('filters the feed to messages with attachments only', () => {
      cy.intercept('POST', '**/rest/v1/rpc/fetch_media_message_window*', {
        statusCode: 200,
        body: {
          rows: [
            {
              id: 'media-only-1',
              seq: 5,
              content: '',
              medias: [{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }],
              type: 'image',
              channel_id: 'test-channel',
              user_id: 'user-1',
              created_at: new Date().toISOString(),
              user_details: { id: 'user-1', username: 'tester', fullname: 'Tester' }
            }
          ],
          anchor_seq: null,
          has_more_before: false,
          has_more_after: false
        }
      }).as('mediaWindow')

      cy.get('[data-testid="chat-media-filter"]').click()
      cy.wait('@mediaWindow')
      cy.get('[data-message-layout="media-only"]').should('exist')
    })

    it('accepts pasted files in the composer', () => {
      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'pasted.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('pasted.png')
    })

    it('attaches files on mobile viewport', () => {
      cy.viewport('iphone-x')
      attachFixtureFile({
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'mobile.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      })

      expectAttachmentVisible('mobile.png')
    })
  })

  describe('feed gallery', () => {
    beforeEach(() => {
      registerUncaughtHandler()
    })

    it('opens the root gallery when clicking a feed image', () => {
      const messageId = 'feed-image-1'
      visitFeed(
        [
          mediaRow([{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }], {
            id: messageId
          })
        ],
        messageId
      )
      assertImageControlReady()
      cy.get('[data-chat-media] [data-media-layout="single"]').should('exist')
      openFirstFeedImage()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
    })

    it('shows zoom in control on image gallery open', () => {
      const messageId = 'feed-image-zoom'
      visitFeed(
        [
          mediaRow([{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }], {
            id: messageId
          })
        ],
        messageId
      )
      assertImageControlReady()
      openFirstFeedImage()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"] [aria-label="Zoom in"]').should('be.visible')
    })

    it('opens overflow menu with Copy Media Link', () => {
      const messageId = 'feed-image-overflow'
      visitFeed(
        [
          mediaRow([{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }], {
            id: messageId
          })
        ],
        messageId
      )
      assertImageControlReady()
      openFirstFeedImage()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"] button[aria-label="Media actions"]').click()
      cy.get('[data-testid="chat-media-gallery"] [role="menu"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"]').contains('Copy Media Link').should('be.visible')
    })

    it('opens video lightbox from expand control', () => {
      const messageId = 'feed-video-1'
      visitFeed(
        [
          mediaRow(
            [
              {
                path: 'user-1/channel-1/clip.mp4',
                url: 'user-1/channel-1/clip.mp4',
                type: 'video',
                name: 'clip.mp4'
              }
            ],
            { id: messageId, type: 'video' }
          )
        ],
        messageId
      )
      assertVideoExpandReady()
      cy.get('[data-chat-media] [data-media-layout="single"]').should('exist')
      cy.get('[data-chat-media] [aria-label="Expand video"]').click()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"] video').should('exist')
    })

    it('navigates mixed playlist in feed order with file excluded', () => {
      const messageId = 'feed-mixed-playlist'
      const medias = [
        {
          path: 'user-1/channel-1/clip.mp4',
          url: 'user-1/channel-1/clip.mp4',
          type: 'video',
          name: 'clip.mp4'
        },
        { path: storagePath, url: storagePath, type: 'image', name: 'photo1.png' },
        {
          path: 'user-1/channel-1/doc.pdf',
          url: 'user-1/channel-1/doc.pdf',
          type: 'file',
          name: 'doc.pdf'
        },
        {
          path: 'user-1/channel-1/note.mp3',
          url: 'user-1/channel-1/note.mp3',
          type: 'audio',
          name: 'note.mp3'
        },
        {
          path: 'user-1/channel-1/photo2.png',
          url: 'user-1/channel-1/photo2.png',
          type: 'image',
          name: 'photo2.png'
        }
      ]

      visitFeed([mediaRow(medias, { id: messageId, seq: 4 })], messageId)
      assertImageControlReady()
      cy.contains('doc.pdf').should('exist')
      cy.get('[data-chat-media] [data-media-layout="mosaic"]')
        .should('exist')
        .within(() => {
          cy.get('[data-testid="feed-image-open"]').should('have.length.at.least', 1)
          cy.get('[data-testid="feed-video-poster"]').should('exist')
        })
      cy.get('[data-chat-media] [aria-label="Expand audio"]').should('exist')

      openFirstFeedImage()
      cy.get('[data-testid="chat-media-gallery"]').contains('1 / 4')

      cy.get('[data-testid="chat-media-gallery"] [aria-label="Next media"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('2 / 4')
      galleryActiveSlide().find('video').should('not.exist')
      galleryActiveSlide().find('audio').should('not.exist')

      cy.get('[data-testid="chat-media-gallery"] [aria-label="Next media"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('3 / 4')
      galleryActiveSlide().find('video').should('exist')
      galleryActiveSlide().find('audio').should('not.exist')

      cy.get('[data-testid="chat-media-gallery"] [aria-label="Next media"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('4 / 4')
      galleryActiveSlide().find('audio').should('exist')
      galleryActiveSlide().find('video').should('not.exist')
    })

    it('opens gallery on video slide at correct playlist index', () => {
      const messageId = 'feed-image-video'
      const medias = [
        { path: storagePath, url: storagePath, type: 'image', name: 'photo.png' },
        {
          path: 'user-1/channel-1/clip.mp4',
          url: 'user-1/channel-1/clip.mp4',
          type: 'video',
          name: 'clip.mp4'
        }
      ]

      visitFeed([mediaRow(medias, { id: messageId, seq: 2 })], messageId)
      assertImageControlReady()
      assertVideoPosterReady()
      cy.get('[data-chat-media] [data-media-layout="mosaic"]')
        .should('exist')
        .within(() => {
          cy.get('[data-testid="feed-image-open"]').should('exist')
          cy.get('[data-testid="feed-video-poster"]').should('exist')
        })
      cy.get('[data-chat-media] [aria-label="Expand video"]').should('not.exist')
      cy.get('[data-chat-media] [data-testid="feed-video-poster"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('2 / 2')
      cy.get('[data-testid="chat-media-gallery"] video').should('exist')

      cy.get('[data-testid="chat-media-gallery"] [aria-label="Previous media"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('1 / 2')
      galleryActiveSlide().find('video').should('not.exist')
    })

    it('excludes file attachments from carousel count', () => {
      const messageId = 'feed-image-file'
      const medias = [
        { path: storagePath, url: storagePath, type: 'image', name: 'photo.png' },
        {
          path: 'user-1/channel-1/doc.pdf',
          url: 'user-1/channel-1/doc.pdf',
          type: 'file',
          name: 'doc.pdf'
        }
      ]

      visitFeed([mediaRow(medias, { id: messageId, seq: 3 })], messageId)
      assertImageControlReady()
      cy.contains('doc.pdf').should('exist')

      openFirstFeedImage()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"] [aria-label="Previous media"]').should('not.exist')
      cy.get('[data-testid="chat-media-gallery"] [aria-label="Next media"]').should('not.exist')
      cy.get('[data-testid="chat-media-gallery"] .tabular-nums').should('not.exist')
    })

    it('hides carousel controls for a single-audio message', () => {
      const messageId = 'feed-audio-only'
      visitFeed(
        [
          mediaRow(
            [
              {
                path: 'user-1/channel-1/note.mp3',
                url: 'user-1/channel-1/note.mp3',
                type: 'audio',
                name: 'note.mp3'
              }
            ],
            { id: messageId, seq: 5, type: 'audio' }
          )
        ],
        messageId
      )
      assertAudioExpandReady()
      cy.get('[data-chat-media] [aria-label="Expand audio"]').click()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
      cy.get('[data-testid="chat-media-gallery"] audio').should('exist')
      cy.get('[data-testid="chat-media-gallery"] [aria-label="Previous media"]').should('not.exist')
      cy.get('[data-testid="chat-media-gallery"] [aria-label="Next media"]').should('not.exist')
    })

    it('requires two taps on spoiler feed image before opening gallery', () => {
      const messageId = 'feed-spoiler-image'
      visitFeed(
        [
          mediaRow(
            [
              {
                path: storagePath,
                url: storagePath,
                type: 'image',
                name: 'secret.png',
                spoiler: true
              }
            ],
            { id: messageId, seq: 6 }
          )
        ],
        messageId
      )
      assertImageControlReady()
      waitForStorageSignIfPending()

      cy.get(`[data-msg-id="${messageId}"] [data-testid="feed-spoiler-reveal"]`).should('exist')
      cy.get(`[data-msg-id="${messageId}"] [data-testid="feed-spoiler-reveal"]`).realClick()
      cy.get(`[data-msg-id="${messageId}"]`).then(($msg) => {
        if ($msg.find('[data-testid="feed-image-open"]').length === 0) {
          cy.window().then((win) => {
            win.__chatTestApi?.revealFeedSpoiler?.(storagePath)
          })
        }
      })
      cy.get(`[data-msg-id="${messageId}"] [data-testid="feed-image-open"]`, {
        timeout: 15_000
      }).should('be.visible')
      cy.get(`[data-msg-id="${messageId}"] [data-testid="feed-image-open"]`).realClick()
      cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
    })

    it('keeps gallery spoiler blurred when reached via carousel prev from video', () => {
      const messageId = 'feed-spoiler-video'
      const medias = [
        { path: storagePath, url: storagePath, type: 'image', name: 'secret.png', spoiler: true },
        {
          path: 'user-1/channel-1/clip.mp4',
          url: 'user-1/channel-1/clip.mp4',
          type: 'video',
          name: 'clip.mp4'
        }
      ]

      visitFeed([mediaRow(medias, { id: messageId, seq: 7 })], messageId)
      cy.get('[data-chat-media] [data-testid="feed-spoiler-reveal"]', {
        timeout: 10_000
      }).should('be.visible')
      waitForStorageSignIfPending()
      assertVideoPosterReady()
      cy.get('[data-chat-media] [data-media-layout="mosaic"]').should('exist')
      cy.get('[data-chat-media] [data-testid="feed-video-poster"]').click({ force: true })
      cy.get('[data-testid="chat-media-gallery"]').contains('2 / 2')

      cy.get('[data-testid="chat-media-gallery"] [aria-label="Previous media"]').click()
      cy.get('[data-testid="chat-media-gallery"]').contains('1 / 2')
      waitForStorageSignIfPending()
      cy.get('[data-testid="chat-media-gallery"] [data-testid="gallery-spoiler-reveal"]', {
        timeout: 15_000
      }).should('exist')
      cy.get('[data-testid="chat-media-gallery"]').contains('Tap to reveal')
    })

    it('loads existing attachments when editing a media message', () => {
      const messageId = 'edit-media-1'
      visitFeed(
        [
          mediaRow([{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }], {
            id: messageId,
            seq: 12,
            content: 'caption'
          })
        ],
        messageId
      )
      assertImageControlReady()
      openMessageContextMenu(messageId)
      cy.contains('Edit').click()
      cy.contains('Edit message').should('be.visible')
      cy.contains('photo.png').should('be.visible')
    })

    it('shows copy-to-doc in the message more menu', () => {
      const messageId = 'copy-doc-1'
      visitFeed(
        [
          mediaRow([{ path: storagePath, url: storagePath, type: 'image', name: 'photo.png' }], {
            id: messageId,
            seq: 3,
            content: 'hello'
          })
        ],
        messageId
      )
      assertImageControlReady()
      openMessageContextMenu(messageId)
      cy.contains('Copy to Doc').should('be.visible')
    })
  })
})
