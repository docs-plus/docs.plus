import React from 'react'

const ColorSwatch = ({
  name,
  variable,
  className
}: {
  name: string
  variable: string
  className: string
}) => {
  return (
    <div className="flex flex-col gap-2">
      <div className={`h-24 w-full rounded-xl shadow-sm ${className} border-base-300 border`}></div>
      <div className="flex flex-col">
        <span className="text-sm font-semibold">{name}</span>
        <code className="text-base-content/60 text-xs">{variable}</code>
      </div>
    </div>
  )
}

export const FoundationsTab = () => {
  return (
    <div className="animate-in fade-in space-y-8 duration-300">
      {/* Colors Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Color Palette</h2>
        <p className="text-base-content/70">
          The semantic color system defines the look and feel of the application.
        </p>

        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title mb-4 text-base">Base Colors</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <ColorSwatch
                name="Base 100 (Canvas)"
                variable="bg-base-100"
                className="bg-base-100"
              />
              <ColorSwatch
                name="Base 200 (Surface)"
                variable="bg-base-200"
                className="bg-base-200"
              />
              <ColorSwatch
                name="Base 300 (Border)"
                variable="bg-base-300"
                className="bg-base-300"
              />
              <ColorSwatch name="Content" variable="bg-base-content" className="bg-base-content" />
            </div>

            <div className="divider"></div>

            <h3 className="card-title mb-4 text-base">Brand Colors</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <ColorSwatch name="Primary" variable="bg-primary" className="bg-primary" />
              <ColorSwatch name="Secondary" variable="bg-secondary" className="bg-secondary" />
              <ColorSwatch name="Accent" variable="bg-accent" className="bg-accent" />
              <ColorSwatch name="Neutral" variable="bg-neutral" className="bg-neutral" />
            </div>

            <div className="divider"></div>

            <h3 className="card-title mb-4 text-base">Semantic Status</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <ColorSwatch name="Info" variable="bg-info" className="bg-info" />
              <ColorSwatch name="Success" variable="bg-success" className="bg-success" />
              <ColorSwatch name="Warning" variable="bg-warning" className="bg-warning" />
              <ColorSwatch name="Error" variable="bg-error" className="bg-error" />
            </div>
          </div>
        </div>
      </section>

      {/* Typography Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Typography</h2>
        <p className="text-base-content/70">Typographic scale and font weights.</p>

        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <div className="space-y-8">
              {/* Headings */}
              <div>
                <span className="text-base-content/50 mb-4 block text-xs font-bold tracking-wider uppercase">
                  Headings
                </span>
                <div className="space-y-4">
                  <div className="border-base-200 flex items-center gap-4 border-b pb-4">
                    <div className="text-base-content/50 w-24 text-xs">H1</div>
                    <div className="flex-1">
                      <h1 className="text-4xl font-bold">
                        The quick brown fox jumps over the lazy dog
                      </h1>
                    </div>
                  </div>
                  <div className="border-base-200 flex items-center gap-4 border-b pb-4">
                    <div className="text-base-content/50 w-24 text-xs">H2</div>
                    <div className="flex-1">
                      <h2 className="text-3xl font-bold">
                        The quick brown fox jumps over the lazy dog
                      </h2>
                    </div>
                  </div>
                  <div className="border-base-200 flex items-center gap-4 border-b pb-4">
                    <div className="text-base-content/50 w-24 text-xs">H3</div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">
                        The quick brown fox jumps over the lazy dog
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-base-content/50 w-24 text-xs">H4</div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold">
                        The quick brown fox jumps over the lazy dog
                      </h4>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div>
                <span className="text-base-content/50 mb-4 block text-xs font-bold tracking-wider uppercase">
                  Body Text
                </span>
                <div className="space-y-4">
                  <div className="border-base-200 flex items-start gap-4 border-b pb-4">
                    <div className="text-base-content/50 w-24 pt-1 text-xs">Body</div>
                    <div className="flex-1">
                      <p className="text-base">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                        tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
                        quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
                        consequat.
                      </p>
                    </div>
                  </div>
                  <div className="border-base-200 flex items-start gap-4 border-b pb-4">
                    <div className="text-base-content/50 w-24 pt-1 text-xs">Small</div>
                    <div className="flex-1">
                      <p className="text-sm">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                        tempor incididunt ut labore et dolore magna aliqua.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="text-base-content/50 w-24 pt-1 text-xs">Muted</div>
                    <div className="flex-1">
                      <p className="text-base-content/60 text-base">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
                        tempor incididunt ut labore et dolore magna aliqua.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Radius Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold">Radius System</h2>
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 border-primary rounded-selector flex h-32 w-32 items-center justify-center border-2">
                  <span className="font-mono text-xs">rounded-selector</span>
                </div>
                <span className="text-sm font-medium">Buttons & Chips</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 border-primary rounded-field flex h-32 w-32 items-center justify-center border-2">
                  <span className="font-mono text-xs">rounded-field</span>
                </div>
                <span className="text-sm font-medium">Inputs</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 border-primary rounded-box flex h-32 w-32 items-center justify-center border-2">
                  <span className="font-mono text-xs">rounded-box</span>
                </div>
                <span className="text-sm font-medium">Cards & Modals</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
