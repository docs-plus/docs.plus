/**
 * TypographyShowcase Component
 * ============================
 * Showcase page for Typography styles and text formatting.
 */

import Head from 'next/head'
import {
  MdCode,
  MdFormatBold,
  MdFormatItalic,
  MdFormatListBulleted,
  MdFormatListNumbered,
  MdFormatQuote,
  MdFormatSize,
  MdFormatStrikethrough,
  MdFormatUnderlined,
  MdLink,
  MdTextFields,
  MdTitle
} from 'react-icons/md'

import { ShowcaseLayout } from './layouts'

const FONT_WEIGHTS = [
  { weight: 'font-thin', value: '100', name: 'Thin' },
  { weight: 'font-extralight', value: '200', name: 'Extra Light' },
  { weight: 'font-light', value: '300', name: 'Light' },
  { weight: 'font-normal', value: '400', name: 'Normal' },
  { weight: 'font-medium', value: '500', name: 'Medium' },
  { weight: 'font-semibold', value: '600', name: 'Semibold' },
  { weight: 'font-bold', value: '700', name: 'Bold' },
  { weight: 'font-extrabold', value: '800', name: 'Extra Bold' },
  { weight: 'font-black', value: '900', name: 'Black' }
]

const TEXT_COLORS = [
  { class: 'text-base-content', name: 'Base Content', desc: 'Primary text' },
  { class: 'text-base-content/80', name: 'Base 80%', desc: 'Secondary text' },
  { class: 'text-base-content/60', name: 'Base 60%', desc: 'Muted text' },
  { class: 'text-base-content/40', name: 'Base 40%', desc: 'Subtle text' },
  { class: 'text-primary', name: 'Primary', desc: 'Links, actions' },
  { class: 'text-secondary', name: 'Secondary', desc: 'Presence, status' },
  { class: 'text-accent', name: 'Accent', desc: 'Highlights' },
  { class: 'text-success', name: 'Success', desc: 'Positive feedback' },
  { class: 'text-warning', name: 'Warning', desc: 'Cautions' },
  { class: 'text-error', name: 'Error', desc: 'Errors, destructive' }
]

export const TypographyShowcase = () => {
  return (
    <>
      <Head>
        <title>Typography | docs.plus Showcase</title>
      </Head>
      <ShowcaseLayout
        title="Typography"
        description="Font styles, weights, sizes, and text formatting for documents.">
        <div className="space-y-12">
          {/* Heading Scale */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-primary/10 flex size-10 items-center justify-center rounded-xl">
                <MdTitle size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Heading Scale</h2>
                <p className="text-base-content/60 text-sm">Semantic heading hierarchy</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body space-y-6">
                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H1 • Page Title
                  </div>
                  <h1 className="text-4xl font-bold md:text-5xl">
                    The quick brown fox jumps over the lazy dog
                  </h1>
                </div>

                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H2 • Section Heading
                  </div>
                  <h2 className="text-2xl font-bold sm:text-3xl">
                    The quick brown fox jumps over the lazy dog
                  </h2>
                </div>

                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H3 • Subsection
                  </div>
                  <h3 className="text-xl font-semibold sm:text-2xl">
                    The quick brown fox jumps over the lazy dog
                  </h3>
                </div>

                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H4 • Card Title
                  </div>
                  <h4 className="text-lg font-semibold">
                    The quick brown fox jumps over the lazy dog
                  </h4>
                </div>

                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H5 • Label
                  </div>
                  <h5 className="text-base font-semibold">
                    The quick brown fox jumps over the lazy dog
                  </h5>
                </div>

                <div className="group hover:bg-base-200/50 -mx-4 rounded-xl px-4 py-3 transition-colors">
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    H6 • Small Label
                  </div>
                  <h6 className="text-sm font-semibold tracking-wide uppercase">
                    The quick brown fox jumps over the lazy dog
                  </h6>
                </div>
              </div>
            </div>
          </section>

          {/* Body Text */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-secondary/10 flex size-10 items-center justify-center rounded-xl">
                <MdTextFields size={24} className="text-secondary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Body Text</h2>
                <p className="text-base-content/60 text-sm">Paragraph and prose styles</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body space-y-6">
                {/* Large */}
                <div>
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    Large • text-lg
                  </div>
                  <p className="text-base-content/80 text-lg leading-relaxed">
                    docs.plus is a free, open-source collaborative document editor. Write together
                    in real-time with your team, friends, or community. No sign-up required to get
                    started.
                  </p>
                </div>

                {/* Base */}
                <div>
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    Base • text-base
                  </div>
                  <p className="text-base-content/80 text-base leading-relaxed">
                    docs.plus is a free, open-source collaborative document editor. Write together
                    in real-time with your team, friends, or community. No sign-up required to get
                    started. Perfect for meeting notes, project documentation, and creative writing.
                  </p>
                </div>

                {/* Small */}
                <div>
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    Small • text-sm
                  </div>
                  <p className="text-base-content/70 text-sm leading-relaxed">
                    docs.plus is a free, open-source collaborative document editor. Write together
                    in real-time with your team, friends, or community. No sign-up required to get
                    started. Perfect for meeting notes, project documentation, and creative writing.
                  </p>
                </div>

                {/* Extra Small */}
                <div>
                  <div className="text-base-content/50 mb-2 text-xs font-medium tracking-wider uppercase">
                    Extra Small • text-xs
                  </div>
                  <p className="text-base-content/60 text-xs leading-relaxed">
                    docs.plus is a free, open-source collaborative document editor. Write together
                    in real-time with your team, friends, or community. No sign-up required.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Font Weights */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-accent/10 flex size-10 items-center justify-center rounded-xl">
                <MdFormatBold size={24} className="text-accent" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Font Weights</h2>
                <p className="text-base-content/60 text-sm">All available weight variations</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {FONT_WEIGHTS.map((fw) => (
                    <div
                      key={fw.weight}
                      className="bg-base-200/50 hover:bg-base-200 flex items-center justify-between rounded-xl px-4 py-3 transition-colors">
                      <span className={`text-lg ${fw.weight}`}>{fw.name}</span>
                      <span className="text-base-content/50 font-mono text-xs">{fw.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Text Colors */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-info/10 flex size-10 items-center justify-center rounded-xl">
                <MdFormatSize size={24} className="text-info" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Text Colors</h2>
                <p className="text-base-content/60 text-sm">Semantic color palette for text</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {TEXT_COLORS.map((color) => (
                    <div
                      key={color.class}
                      className="border-base-300 rounded-xl border p-4 transition-shadow hover:shadow-md">
                      <p className={`text-lg font-semibold ${color.class}`}>{color.name}</p>
                      <p className="text-base-content/60 text-sm">{color.desc}</p>
                      <code className="text-base-content/50 mt-2 block font-mono text-xs">
                        {color.class}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Text Formatting */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-success/10 flex size-10 items-center justify-center rounded-xl">
                <MdFormatItalic size={24} className="text-success" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Text Formatting</h2>
                <p className="text-base-content/60 text-sm">Inline formatting options</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdFormatBold size={14} /> Bold
                    </div>
                    <p className="font-bold">The quick brown fox</p>
                  </div>

                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdFormatItalic size={14} /> Italic
                    </div>
                    <p className="italic">The quick brown fox</p>
                  </div>

                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdFormatUnderlined size={14} /> Underline
                    </div>
                    <p className="underline">The quick brown fox</p>
                  </div>

                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdFormatStrikethrough size={14} /> Strikethrough
                    </div>
                    <p className="line-through">The quick brown fox</p>
                  </div>

                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdCode size={14} /> Inline Code
                    </div>
                    <p>
                      Use{' '}
                      <code className="bg-base-300 rounded px-1.5 py-0.5 font-mono text-sm">
                        npm install
                      </code>{' '}
                      command
                    </p>
                  </div>

                  <div className="bg-base-200/50 rounded-xl p-4">
                    <div className="text-base-content/60 mb-2 flex items-center gap-2 text-xs">
                      <MdLink size={14} /> Link
                    </div>
                    <p>
                      Visit{' '}
                      <a href="#" className="text-primary hover:underline">
                        docs.plus
                      </a>{' '}
                      to learn more
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Block Elements */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-warning/10 flex size-10 items-center justify-center rounded-xl">
                <MdFormatQuote size={24} className="text-warning" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Block Elements</h2>
                <p className="text-base-content/60 text-sm">Quotes, lists, and code blocks</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Blockquote */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body">
                  <h3 className="card-title text-base">Blockquote</h3>
                  <blockquote className="border-primary bg-primary/5 border-l-4 py-3 pr-4 pl-4 italic">
                    "The best way to predict the future is to invent it."
                    <footer className="mt-2 text-sm font-medium not-italic">— Alan Kay</footer>
                  </blockquote>
                </div>
              </div>

              {/* Unordered List */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body">
                  <div className="flex items-center gap-2">
                    <MdFormatListBulleted size={18} className="text-base-content/60" />
                    <h3 className="card-title text-base">Unordered List</h3>
                  </div>
                  <ul className="text-base-content/80 list-disc space-y-1 pl-5">
                    <li>Real-time collaboration</li>
                    <li>Version history</li>
                    <li>Export to multiple formats</li>
                    <li>Customizable themes</li>
                  </ul>
                </div>
              </div>

              {/* Ordered List */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body">
                  <div className="flex items-center gap-2">
                    <MdFormatListNumbered size={18} className="text-base-content/60" />
                    <h3 className="card-title text-base">Ordered List</h3>
                  </div>
                  <ol className="text-base-content/80 list-decimal space-y-1 pl-5">
                    <li>Create a new document</li>
                    <li>Share the link with your team</li>
                    <li>Start collaborating in real-time</li>
                    <li>Export when ready</li>
                  </ol>
                </div>
              </div>

              {/* Code Block */}
              <div className="card border-base-300 bg-base-100 border">
                <div className="card-body">
                  <div className="flex items-center gap-2">
                    <MdCode size={18} className="text-base-content/60" />
                    <h3 className="card-title text-base">Code Block</h3>
                  </div>
                  <pre className="bg-base-200 overflow-x-auto rounded-xl p-4 font-mono text-sm">
                    <code>{`function greet(name) {
  return \`Hello, \${name}!\`;
}

console.log(greet('docs.plus'));`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </section>

          {/* Document Preview */}
          <section>
            <div className="mb-6 flex items-center gap-2">
              <div className="bg-error/10 flex size-10 items-center justify-center rounded-xl">
                <MdFormatSize size={24} className="text-error" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Document Preview</h2>
                <p className="text-base-content/60 text-sm">Real-world typography in context</p>
              </div>
            </div>

            <div className="card border-base-300 bg-base-100 border">
              <div className="card-body prose prose-slate max-w-none">
                <h1>Getting Started with docs.plus</h1>
                <p className="lead">
                  docs.plus is a modern, open-source alternative to Google Docs. Built for teams who
                  value privacy, speed, and simplicity.
                </p>

                <h2>Why Choose docs.plus?</h2>
                <p>
                  Whether you're writing meeting notes, drafting a proposal, or collaborating on a
                  story, docs.plus provides a <strong>distraction-free</strong> writing experience
                  with <em>powerful collaboration features</em>.
                </p>

                <h3>Key Features</h3>
                <ul>
                  <li>
                    <strong>Real-time collaboration</strong> — See changes as they happen
                  </li>
                  <li>
                    <strong>Version history</strong> — Never lose your work
                  </li>
                  <li>
                    <strong>Export options</strong> — PDF, Markdown, HTML, and more
                  </li>
                </ul>

                <blockquote>
                  "docs.plus has transformed how our team collaborates on documentation. It's fast,
                  intuitive, and just works."
                </blockquote>

                <h3>Getting Started</h3>
                <p>
                  To create your first document, simply visit <a href="#">docs.plus</a> and start
                  typing. No sign-up required!
                </p>

                <pre>
                  <code>{`// Embed docs.plus in your app
<iframe src="https://docs.plus/your-doc" />`}</code>
                </pre>
              </div>
            </div>
          </section>
        </div>
      </ShowcaseLayout>
    </>
  )
}

export default TypographyShowcase
