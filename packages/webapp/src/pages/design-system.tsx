/**
 * Design System Page
 * ===================
 *
 * This page showcases all UI components used in the docs.plus application.
 * It serves as a living style guide and component library demonstration.
 *
 * @see /components/pages/design-system for the component implementation
 */

import { DesignSystemPage } from '@components/pages/design-system'
import type { GetServerSideProps } from 'next'

// Disable static generation - this is a dev-only page
export const getServerSideProps: GetServerSideProps = async () => {
  return { props: {} }
}

export default DesignSystemPage
