/**
 * Design System Documentation Page
 * =================================
 * Developer-facing design system documentation for DocsPlus.
 *
 * This page provides:
 * - Design tokens (colors, typography, spacing, etc.)
 * - Component gallery with code snippets
 * - Editor-specific UI patterns
 * - Accessibility guidelines
 * - Implementation notes
 */

import Head from 'next/head'
import { DesignSystemDocsProvider } from './context/DesignSystemDocsContext'
import { ScrollArea } from '@components/ui'
import {
  Sidebar,
  Header,
  GettingStartedSection,
  FoundationsSection,
  ComponentsSection,
  EditorComponentsSection,
  PatternsSection,
  AccessibilitySection,
  ImplementationSection
} from './components'

/**
 * Main content area with all sections
 */
const MainContent = () => {
  return (
    <ScrollArea className="flex-1" scrollbarSize="thin">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Getting Started */}
        <GettingStartedSection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Foundations */}
        <FoundationsSection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Components */}
        <ComponentsSection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Editor Components */}
        <EditorComponentsSection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Patterns */}
        <PatternsSection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Accessibility */}
        <AccessibilitySection />

        {/* Divider */}
        <div className="my-16 h-px bg-slate-200" />

        {/* Implementation */}
        <ImplementationSection />

        {/* Footer */}
        <footer className="mt-16 border-t border-slate-200 py-8 text-center">
          <p className="text-sm text-slate-500">
            docs.plus Design System v1.1.0 •{' '}
            <a
              href="https://github.com/docs-plus/docs.plus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline">
              GitHub
            </a>
          </p>
        </footer>
      </div>
    </ScrollArea>
  )
}

/**
 * Page content with layout
 */
const PageContent = () => {
  return (
    <>
      <Head>
        <title>Design System | docs.plus</title>
        <meta
          name="description"
          content="Developer documentation for the docs.plus design system. Tokens, components, patterns, and guidelines."
        />
      </Head>

      <div className="bg-base-100 text-base-content flex h-screen overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Mobile header */}
          <Header />

          {/* Content */}
          <MainContent />
        </div>
      </div>
    </>
  )
}

/**
 * Design System Documentation Page
 * Wrapped with context provider
 */
export const DesignSystemDocsPage = () => {
  return (
    <DesignSystemDocsProvider>
      <PageContent />
    </DesignSystemDocsProvider>
  )
}
