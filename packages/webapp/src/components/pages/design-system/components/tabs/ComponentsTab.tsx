/**
 * ComponentsTab Component
 * ========================
 * Showcase of UI components: buttons, badges, alerts, etc.
 *
 * NOTE: Loading animations are toggled off by default to prevent
 * high CPU usage when the page loads. Users can enable them manually.
 */

import { useState } from 'react'
import {
  MdNotifications,
  MdEmail,
  MdInfo,
  MdCheckCircle,
  MdWarning,
  MdError,
  MdPlayArrow,
  MdStop
} from 'react-icons/md'
import { Avatar } from '@components/ui'

export const ComponentsTab = () => {
  const [activeComponentTab, setActiveComponentTab] = useState(0)
  // Loading animations are OFF by default to prevent CPU spikes
  const [showLoadingAnimations, setShowLoadingAnimations] = useState(false)

  return (
    <div className="animate-in fade-in space-y-6 duration-300">
      {/* Horizontal Tabs Demo */}
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Tabs Component</h3>
          <div role="tablist" className="tabs tabs-boxed bg-base-200 p-1">
            {['Overview', 'Features', 'Pricing', 'FAQ'].map((tab, i) => (
              <button
                key={tab}
                role="tab"
                className={`tab transition-all ${activeComponentTab === i ? 'tab-active' : ''}`}
                onClick={() => setActiveComponentTab(i)}
                aria-selected={activeComponentTab === i}>
                {tab}
              </button>
            ))}
          </div>
          <div className="bg-base-200 mt-4 min-h-20 rounded-lg p-4">
            {activeComponentTab === 0 && (
              <p>
                Welcome to our product overview. This tab demonstrates the tabs component with
                smooth transitions.
              </p>
            )}
            {activeComponentTab === 1 && (
              <p>
                ✨ Feature 1: Real-time collaboration
                <br />
                🚀 Feature 2: Lightning-fast performance
                <br />
                🔒 Feature 3: Enterprise security
              </p>
            )}
            {activeComponentTab === 2 && <p>Free tier available! Premium starts at $9/month.</p>}
            {activeComponentTab === 3 && (
              <p>
                Q: How do I get started?
                <br />
                A: Just click "Get Started" and follow the wizard!
              </p>
            )}
          </div>

          {/* Lifted Tabs */}
          <div className="divider">Lifted Variant</div>
          <div role="tablist" className="tabs tabs-lifted">
            <button role="tab" className="tab">
              Tab 1
            </button>
            <button role="tab" className="tab tab-active">
              Active
            </button>
            <button role="tab" className="tab">
              Tab 3
            </button>
          </div>

          {/* Bordered Tabs */}
          <div className="divider">Bordered Variant</div>
          <div role="tablist" className="tabs tabs-bordered">
            <button role="tab" className="tab">
              Tab 1
            </button>
            <button role="tab" className="tab tab-active">
              Active
            </button>
            <button role="tab" className="tab">
              Tab 3
            </button>
          </div>
        </div>
      </div>

      {/* Components Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Buttons */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Buttons</h3>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary transition-transform hover:scale-105">
                Primary
              </button>
              <button className="btn btn-secondary transition-transform hover:scale-105">
                Secondary
              </button>
              <button className="btn btn-accent transition-transform hover:scale-105">
                Accent
              </button>
              <button className="btn btn-ghost">Ghost</button>
              <button className="btn btn-outline">Outline</button>
            </div>
            <div className="divider my-2"></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-success btn-sm">Success</button>
              <button className="btn btn-warning btn-sm">Warning</button>
              <button className="btn btn-error btn-sm">Error</button>
              <button className="btn btn-info btn-sm">Info</button>
            </div>
            <div className="divider my-2"></div>
            <div className="join">
              <button className="btn join-item">Left</button>
              <button className="btn btn-active join-item">Middle</button>
              <button className="btn join-item">Right</button>
            </div>
          </div>
        </div>

        {/* Badges & Indicators */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Badges & Indicators</h3>
            <div className="flex flex-wrap gap-2">
              <span className="badge badge-primary">Primary</span>
              <span className="badge badge-secondary">Secondary</span>
              <span className="badge badge-accent">Accent</span>
              <span className="badge badge-ghost">Ghost</span>
              <span className="badge badge-outline">Outline</span>
            </div>
            <div className="divider my-2"></div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="indicator">
                <span className="indicator-item badge badge-primary badge-xs"></span>
                <button className="btn btn-ghost btn-sm" aria-label="Notifications">
                  <MdNotifications size={20} aria-hidden="true" />
                </button>
              </div>
              <div className="indicator">
                <span className="indicator-item badge badge-secondary">99+</span>
                <div className="bg-base-200 grid size-12 place-items-center rounded-lg">
                  <MdEmail size={24} aria-hidden="true" />
                </div>
              </div>
              <div className="indicator">
                <span className="indicator-item indicator-bottom badge badge-success badge-xs"></span>
                <Avatar id="indicator-demo" size="md" clickable={false} />
              </div>
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Alerts</h3>
            <div className="space-y-2">
              <div className="alert alert-info py-2" role="alert">
                <MdInfo size={18} aria-hidden="true" />
                <span className="text-sm">Info: New features available!</span>
              </div>
              <div className="alert alert-success py-2" role="alert">
                <MdCheckCircle size={18} aria-hidden="true" />
                <span className="text-sm">Success: Changes saved.</span>
              </div>
              <div className="alert alert-warning py-2" role="alert">
                <MdWarning size={18} aria-hidden="true" />
                <span className="text-sm">Warning: Review required.</span>
              </div>
              <div className="alert alert-error py-2" role="alert">
                <MdError size={18} aria-hidden="true" />
                <span className="text-sm">Error: Something went wrong.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Loading States - Toggle to prevent CPU spikes */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h3 className="card-title text-base">Loading States</h3>
              <button
                onClick={() => setShowLoadingAnimations(!showLoadingAnimations)}
                className={`btn btn-sm gap-1 ${showLoadingAnimations ? 'btn-error' : 'btn-primary'}`}
                aria-label={showLoadingAnimations ? 'Stop animations' : 'Start animations'}>
                {showLoadingAnimations ? (
                  <>
                    <MdStop size={16} /> Stop
                  </>
                ) : (
                  <>
                    <MdPlayArrow size={16} /> Demo
                  </>
                )}
              </button>
            </div>
            {showLoadingAnimations ? (
              <>
                <div className="flex flex-wrap items-center gap-6">
                  <span
                    className="loading loading-spinner loading-md text-primary"
                    aria-label="Loading"
                  />
                  <span
                    className="loading loading-dots loading-md text-secondary"
                    aria-label="Loading"
                  />
                  <span
                    className="loading loading-ring loading-md text-accent"
                    aria-label="Loading"
                  />
                  <span
                    className="loading loading-bars loading-md text-info"
                    aria-label="Loading"
                  />
                </div>
                <div className="divider my-2"></div>
                <div className="space-y-2">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-4/5" />
                  <div className="skeleton h-4 w-3/5" />
                </div>
              </>
            ) : (
              <div className="bg-base-200 flex items-center justify-center rounded-lg p-6">
                <p className="text-base-content/60 text-sm">
                  Click "Demo" to preview loading animations
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Progress & Range */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Progress & Range</h3>
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Storage Used</span>
                  <span>75%</span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value="75"
                  max="100"
                  aria-label="Storage usage 75%"
                />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>Tasks Complete</span>
                  <span>45%</span>
                </div>
                <progress
                  className="progress progress-success w-full"
                  value="45"
                  max="100"
                  aria-label="Tasks complete 45%"
                />
              </div>
              <div className="divider my-2">Range Slider</div>
              <input
                type="range"
                min="0"
                max="100"
                defaultValue="40"
                className="range range-primary range-sm"
                aria-label="Range slider"
              />
            </div>
          </div>
        </div>

        {/* Tooltips */}
        <div className="card border-base-300 bg-base-100 border shadow-sm">
          <div className="card-body">
            <h3 className="card-title text-base">Tooltips</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <div className="tooltip tooltip-top" data-tip="Top tooltip">
                <button className="btn btn-sm">Top</button>
              </div>
              <div className="tooltip tooltip-bottom" data-tip="Bottom tooltip">
                <button className="btn btn-sm">Bottom</button>
              </div>
              <div className="tooltip tooltip-left" data-tip="Left tooltip">
                <button className="btn btn-sm">Left</button>
              </div>
              <div className="tooltip tooltip-right" data-tip="Right tooltip">
                <button className="btn btn-sm">Right</button>
              </div>
              <div className="tooltip tooltip-primary" data-tip="Primary color">
                <button className="btn btn-primary btn-sm">Primary</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Divider Demo */}
      <div className="card border-base-300 bg-base-100 border shadow-sm">
        <div className="card-body">
          <h3 className="card-title text-base">Dividers</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="text-base-content/70 text-sm">Content above</p>
              <div className="divider">OR</div>
              <p className="text-base-content/70 text-sm">Content below</p>
            </div>
            <div className="flex h-24 items-center">
              <div className="flex-1 text-center text-sm">Left</div>
              <div className="divider divider-horizontal">•</div>
              <div className="flex-1 text-center text-sm">Right</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
