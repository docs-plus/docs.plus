/**
 * Showcase Index Page
 * ===================
 * Landing page for all showcase pages.
 */

import Head from 'next/head'
import Link from 'next/link'
import { useState, useCallback } from 'react'
import {
  MdAccountCircle,
  MdTextFields,
  MdEdit,
  MdNotifications,
  MdDescription,
  MdArrowForward,
  MdDarkMode,
  MdLightMode,
  MdArrowBack
} from 'react-icons/md'

const SHOWCASE_PAGES = [
  {
    href: '/showcase/profile',
    title: 'Profile & Account',
    description: 'User settings, preferences, security, and account management.',
    icon: MdAccountCircle,
    color: 'bg-blue-500',
    lightBg: 'bg-blue-50'
  },
  {
    href: '/showcase/typography',
    title: 'Typography',
    description: 'Font styles, weights, sizes, and text formatting for documents.',
    icon: MdTextFields,
    color: 'bg-violet-500',
    lightBg: 'bg-violet-50'
  },
  {
    href: '/showcase/editor',
    title: 'Document Editor',
    description: 'Real-time collaborative editing with rich formatting options.',
    icon: MdEdit,
    color: 'bg-emerald-500',
    lightBg: 'bg-emerald-50'
  },
  {
    href: '/showcase/notifications',
    title: 'Notifications & Bookmarks',
    description: 'Stay updated on mentions, comments, and save important sections.',
    icon: MdNotifications,
    color: 'bg-amber-500',
    lightBg: 'bg-amber-50'
  },
  {
    href: '/showcase/documents',
    title: 'Documents',
    description: 'Create, organize, and manage your documents and folders.',
    icon: MdDescription,
    color: 'bg-rose-500',
    lightBg: 'bg-rose-50'
  }
]

export default function ShowcaseIndex() {
  const [theme, setTheme] = useState<'docsplus' | 'docsplus-dark'>('docsplus')

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'docsplus' ? 'docsplus-dark' : 'docsplus'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }, [theme])

  return (
    <div className="bg-base-100 min-h-screen" data-theme={theme}>
      <Head>
        <title>Showcase | docs.plus</title>
        <meta name="description" content="Explore docs.plus features and design patterns" />
      </Head>

      {/* Header */}
      <header className="border-base-300 bg-base-100 sticky top-0 z-30 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/design-system"
              className="btn btn-ghost btn-circle btn-sm"
              aria-label="Back to Design System">
              <MdArrowBack size={20} />
            </Link>
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-primary text-primary-content flex size-8 items-center justify-center rounded-lg text-sm font-bold">
                d+
              </div>
              <span className="text-base-content text-lg font-bold">docs.plus</span>
            </Link>
          </div>
          <button
            onClick={toggleTheme}
            className="btn btn-ghost btn-circle btn-sm transition-transform hover:rotate-12"
            aria-label={theme === 'docsplus' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'docsplus' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="from-primary/5 bg-gradient-to-b to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="text-center">
            <h1 className="text-base-content text-4xl font-bold sm:text-5xl md:text-6xl">
              Feature Showcase
            </h1>
            <p className="text-base-content/70 mx-auto mt-4 max-w-2xl text-lg sm:text-xl">
              Explore the core features of docs.plus — a modern, open-source alternative to Google
              Docs built for teams who value privacy, speed, and simplicity.
            </p>
          </div>
        </div>
      </section>

      {/* Showcase Grid */}
      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_PAGES.map((page, index) => (
            <Link
              key={page.href}
              href={page.href}
              className="card border-base-300 bg-base-100 group border transition-all hover:-translate-y-1 hover:shadow-xl"
              style={{ animationDelay: `${index * 50}ms` }}>
              <div className="card-body">
                <div
                  className={`mb-4 flex size-14 items-center justify-center rounded-2xl ${page.lightBg} transition-transform group-hover:scale-110`}>
                  <page.icon size={28} className={page.color.replace('bg-', 'text-')} />
                </div>
                <h2 className="card-title text-lg">{page.title}</h2>
                <p className="text-base-content/70 text-sm">{page.description}</p>
                <div className="card-actions mt-4">
                  <span className="text-primary group-hover:text-primary-focus flex items-center gap-1 text-sm font-medium transition-colors">
                    Explore
                    <MdArrowForward
                      size={16}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 text-center">
          <div className="bg-base-200 inline-flex items-center gap-4 rounded-2xl p-6 sm:p-8">
            <div className="text-left">
              <h3 className="text-lg font-bold sm:text-xl">Ready to dive deeper?</h3>
              <p className="text-base-content/70 mt-1 text-sm sm:text-base">
                Check out the full component library and design system.
              </p>
            </div>
            <Link href="/design-system" className="btn btn-primary shrink-0">
              Design System
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-base-300 bg-base-200/30 border-t">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-base-content/60 text-sm">
              docs.plus — Free, open-source collaborative documents
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/docs-plus/docs.plus"
                target="_blank"
                rel="noopener noreferrer"
                className="text-base-content/60 hover:text-primary text-sm">
                GitHub
              </a>
              <Link
                href="/design-system"
                className="text-base-content/60 hover:text-primary text-sm">
                Design System
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
