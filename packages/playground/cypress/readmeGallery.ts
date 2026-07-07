export type ReadmeGalleryTheme = 'light' | 'dark'

export const readmeGalleryShotOpts = { capture: 'viewport', overwrite: true } as const

export function prepareReadmeGalleryViewport(): void {
  cy.viewport(900, 540)
}

export function setPlaygroundTheme(
  theme: ReadmeGalleryTheme
): Cypress.Chainable<Cypress.AUTWindow> {
  return cy.window().then((w) => {
    w.document.documentElement.setAttribute('data-theme', theme)
  })
}
