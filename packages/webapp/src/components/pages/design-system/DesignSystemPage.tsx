/**
 * DesignSystemPage Component
 * ===========================
 * Main entry component for the design system demo.
 *
 * This page showcases all UI components in an interactive dashboard format.
 * It demonstrates proper component organization, theming, and accessibility.
 */

import Head from 'next/head'

import {
  ComponentsTab,
  DashboardTab,
  DocumentsTab,
  FormsTab,
  SettingsTab,
  TeamTab} from './components'
import { DesignSystemProvider, useDesignSystem } from './context/DesignSystemContext'
import { DashboardLayout } from './layouts'

/**
 * TabContent - Renders the appropriate tab based on active selection
 */
const TabContent = () => {
  const { activeTab } = useDesignSystem()

  switch (activeTab) {
    case 'dashboard':
      return <DashboardTab />
    case 'documents':
      return <DocumentsTab />
    case 'team':
      return <TeamTab />
    case 'components':
      return <ComponentsTab />
    case 'forms':
      return <FormsTab />
    case 'settings':
      return <SettingsTab />
    default:
      return <DashboardTab />
  }
}

/**
 * DesignSystemPageContent - The inner content wrapped by the provider
 */
const DesignSystemPageContent = () => {
  return (
    <>
      <Head>
        <title>Design System | docs.plus</title>
        <meta name="description" content="docs.plus component showcase and design system" />
      </Head>

      <DashboardLayout>
        <TabContent />
      </DashboardLayout>
    </>
  )
}

/**
 * DesignSystemPage - Main export with context provider
 */
export const DesignSystemPage = () => {
  return (
    <DesignSystemProvider>
      <DesignSystemPageContent />
    </DesignSystemProvider>
  )
}
