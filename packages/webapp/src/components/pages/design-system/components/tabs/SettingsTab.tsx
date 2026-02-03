/**
 * SettingsTab Component
 * ======================
 * Settings view with quick actions and account stats.
 */

import { PanelHeader } from '@components/ui'
import {
  MdBugReport,
  MdDelete,
  MdDescription,
  MdDownload,
  MdFavorite,
  MdLightbulbOutline,
  MdSettings,
  MdStar,
  MdStarOutline,
  MdWarning
} from 'react-icons/md'

import { ActionCard } from '../cards'

export const SettingsTab = () => (
  <div className="animate-in fade-in mx-auto max-w-2xl space-y-6 duration-300">
    <PanelHeader
      icon={MdSettings}
      title="Settings"
      description="Manage your account and preferences"
    />

    {/* Quick Actions */}
    <div className="grid gap-3 sm:grid-cols-2">
      <ActionCard
        label="Star us on GitHub"
        description="Support the project"
        icon={MdStarOutline}
        iconColor="text-amber-500"
        bgColor="bg-amber-50 dark:bg-amber-500/10"
        delay={0}
      />
      <ActionCard
        label="Request a feature"
        description="Suggest an idea"
        icon={MdLightbulbOutline}
        iconColor="text-blue-500"
        bgColor="bg-blue-50 dark:bg-blue-500/10"
        delay={50}
      />
      <ActionCard
        label="Report an issue"
        description="Found a bug?"
        icon={MdBugReport}
        iconColor="text-rose-500"
        bgColor="bg-rose-50 dark:bg-rose-500/10"
        delay={100}
      />
      <ActionCard
        label="Download data"
        description="Export your documents"
        icon={MdDownload}
        iconColor="text-emerald-500"
        bgColor="bg-emerald-50 dark:bg-emerald-500/10"
        delay={150}
      />
    </div>

    {/* Stats */}
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">Account Stats</h3>
        <div className="stats stats-vertical sm:stats-horizontal border-base-300 w-full border">
          <div className="stat">
            <div className="stat-figure text-primary">
              <MdDescription size={24} />
            </div>
            <div className="stat-title">Documents</div>
            <div className="stat-value text-primary">31</div>
            <div className="stat-desc">↑ 4 this week</div>
          </div>
          <div className="stat">
            <div className="stat-figure text-secondary">
              <MdFavorite size={24} />
            </div>
            <div className="stat-title">Likes</div>
            <div className="stat-value text-secondary">2.6K</div>
            <div className="stat-desc">↑ 21% vs last month</div>
          </div>
          <div className="stat">
            <div className="stat-figure text-accent">
              <MdStar size={24} />
            </div>
            <div className="stat-title">Rating</div>
            <div className="stat-value text-accent">4.9</div>
            <div className="stat-desc">From 120 reviews</div>
          </div>
        </div>
      </div>
    </div>

    {/* Danger Zone */}
    <div className="card border-error/30 bg-error/5 border">
      <div className="card-body">
        <h3 className="card-title text-error text-base">
          <MdWarning size={20} aria-hidden="true" /> Danger Zone
        </h3>
        <p className="text-base-content/70 text-sm">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="card-actions mt-2">
          <button className="btn btn-error btn-outline btn-sm hover:bg-error hover:text-error-content gap-2 transition-colors">
            <MdDelete size={18} aria-hidden="true" /> Delete Account
          </button>
        </div>
      </div>
    </div>
  </div>
)
