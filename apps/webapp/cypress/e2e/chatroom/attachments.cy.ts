/// <reference types="cypress" />

describe('chatroom attachments', () => {
  const storagePath = 'user-1/channel-1/test.png'

  beforeEach(() => {
    cy.intercept('POST', '**/storage/v1/object/media/**', {
      statusCode: 200,
      body: { Key: storagePath }
    }).as('storageUpload')

    cy.intercept('POST', '**/storage/v1/object/sign/media/**', {
      statusCode: 200,
      body: { signedURL: `https://example.test/signed/${storagePath}` }
    }).as('storageSign')

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

    cy.visit('/c/test-channel')
    cy.get('[data-key="chatroom-feed"]', { timeout: 10_000 }).should('be.visible')
  })

  it('uploads an attachment and sends a media message', () => {
    cy.get('[data-testid="composer-attach-input"]').selectFile(
      {
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'photo.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      },
      { force: true }
    )

    cy.wait('@storageUpload')
    cy.wait('@storageSign')
    cy.contains('photo.png').should('be.visible')

    cy.get('[data-testid="composer-submit"]').click()
    cy.wait('@messageInsert').its('request.body').should('have.property', 'medias')
    cy.get('[data-message-layout="media-only"]').should('exist')
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
    cy.get('[data-testid="composer-submit"]').should('be.disabled')
  })

  it('opens the root gallery when clicking a feed image', () => {
    cy.intercept('GET', '**/rest/v1/messages*', {
      statusCode: 200,
      body: [
        {
          id: 'feed-image-1',
          content: '',
          medias: [
            {
              path: storagePath,
              url: storagePath,
              type: 'image',
              name: 'photo.png'
            }
          ],
          type: 'image',
          channel_id: 'test-channel',
          user_id: 'user-1',
          created_at: new Date().toISOString(),
          user_details: { id: 'user-1', username: 'tester', fullname: 'Tester' }
        }
      ]
    }).as('messagesList')

    cy.reload()
    cy.wait('@messagesList')
    cy.get('[data-chat-media] button').first().click()
    cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
  })

  it('opens video lightbox from expand control', () => {
    cy.intercept('GET', '**/rest/v1/messages*', {
      statusCode: 200,
      body: [
        {
          id: 'feed-video-1',
          content: '',
          medias: [
            {
              path: 'user-1/channel-1/clip.mp4',
              url: 'user-1/channel-1/clip.mp4',
              type: 'video',
              name: 'clip.mp4'
            }
          ],
          type: 'video',
          channel_id: 'test-channel',
          user_id: 'user-1',
          created_at: new Date().toISOString(),
          user_details: { id: 'user-1', username: 'tester', fullname: 'Tester' }
        }
      ]
    }).as('messagesListVideo')

    cy.reload()
    cy.wait('@messagesListVideo')
    cy.get('[data-chat-media] [aria-label="Expand video"]').click()
    cy.get('[data-testid="chat-media-gallery"]').should('be.visible')
    cy.get('[data-testid="chat-media-gallery"] video').should('exist')
  })

  it('accepts drag-and-drop onto the composer', () => {
    cy.get('[data-chat-composer-surface]').selectFile(
      {
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'dropped.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      },
      { action: 'drag-drop' }
    )

    cy.wait('@storageUpload')
    cy.contains('dropped.png').should('be.visible')
  })

  it('keeps attachment strip after failed send', () => {
    cy.intercept('POST', '**/rest/v1/messages*', {
      statusCode: 401,
      body: { code: '42501' }
    }).as('failedSend')

    cy.get('[data-testid="composer-attach-input"]').selectFile(
      {
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'keep-me.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      },
      { force: true }
    )

    cy.wait('@storageUpload')
    cy.contains('keep-me.png').should('be.visible')
    cy.get('[data-testid="composer-submit"]').click()
    cy.wait('@failedSend')
    cy.contains('keep-me.png').should('be.visible')
    cy.get('[data-status="failed"]').should('be.visible')
  })

  it('filters the feed to messages with attachments only', () => {
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

  it('marks an image attachment as spoiler before send', () => {
    cy.get('[data-testid="composer-attach-input"]').selectFile(
      {
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'secret.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      },
      { force: true }
    )

    cy.wait('@storageUpload')
    cy.get('[data-testid="attachment-spoiler-toggle"]').click()
    cy.contains('Spoiler on').should('be.visible')
    cy.get('[data-testid="composer-submit"]').click()
    cy.wait('@messageInsert').its('request.body.medias.0.spoiler').should('eq', true)
  })

  it('loads existing attachments when editing a media message', () => {
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows: [
          {
            id: 'edit-media-1',
            seq: 12,
            content: 'caption',
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
    }).as('window')

    cy.reload()
    cy.wait('@window')
    cy.get('.msg_card').first().realHover()
    cy.get('.msg_card').first().find('button[aria-label="More Actions"]').click({ force: true })
    cy.contains('button', 'Edit Message').click({ force: true })
    cy.contains('Edit message').should('be.visible')
    cy.contains('photo.png').should('be.visible')
  })

  it('shows copy-to-doc in the message more menu', () => {
    cy.intercept('POST', '**/rest/v1/rpc/fetch_message_window*', {
      statusCode: 200,
      body: {
        rows: [
          {
            id: 'copy-doc-1',
            seq: 3,
            content: 'hello',
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
    }).as('windowCopy')

    cy.reload()
    cy.wait('@windowCopy')
    cy.get('.msg_card').first().realHover()
    cy.get('.msg_card').first().find('button[aria-label="More Actions"]').click({ force: true })
    cy.contains('button', 'Copy to Doc').should('be.visible')
  })

  it('accepts pasted files in the composer', () => {
    cy.get('.ProseMirror').click()
    cy.get('.ProseMirror').then(($editor) => {
      const file = new File([Cypress.Buffer.from('89504e470d0a1a0a', 'hex')], 'pasted.png', {
        type: 'image/png'
      })
      const dt = new DataTransfer()
      dt.items.add(file)
      const paste = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true })
      $editor[0].dispatchEvent(paste)
    })

    cy.wait('@storageUpload')
    cy.contains('pasted.png').should('be.visible')
  })

  it('attaches files on mobile viewport', () => {
    cy.viewport('iphone-x')
    cy.get('[data-testid="composer-attach-input"]').selectFile(
      {
        contents: Cypress.Buffer.from('89504e470d0a1a0a', 'hex'),
        fileName: 'mobile.png',
        mimeType: 'image/png',
        lastModified: Date.now()
      },
      { force: true }
    )

    cy.wait('@storageUpload')
    cy.contains('mobile.png').should('be.visible')
  })
})
