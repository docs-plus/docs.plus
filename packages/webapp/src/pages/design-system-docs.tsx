/**
 * Design System Documentation Page
 * =================================
 *
 * Developer-facing documentation for the docs.plus design system.
 * Includes tokens, components, patterns, and implementation guidelines.
 *
 * @see /components/pages/design-system-docs for the implementation
 * @route /design-system-docs
 */

import { DesignSystemDocsPage } from '@components/pages/design-system-docs'
import type { GetServerSideProps } from 'next'

// Disable static generation - this is a dev-only page
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

export default DesignSystemDocsPage
