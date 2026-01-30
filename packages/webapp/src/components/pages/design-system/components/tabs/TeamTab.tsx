/**
 * TeamTab Component
 * ==================
 * Team members view with cards and avatar stack demo.
 */

import { Avatar } from '@components/ui'
import { MdAdd } from 'react-icons/md'

import { DEMO_USERS } from '../../constants/demoData'

export const TeamTab = () => (
  <div className="animate-in fade-in space-y-6 duration-300">
    {/* Team Header */}
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold">Team Members</h2>
        <p className="text-base-content/60">Manage your team and their permissions</p>
      </div>
      <button className="btn btn-primary gap-2 transition-transform hover:scale-105">
        <MdAdd size={20} aria-hidden="true" /> Invite Member
      </button>
    </div>

    {/* Team Grid */}
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {DEMO_USERS.map((user, i) => (
        <div
          key={user.id}
          className="card border-base-300 bg-base-100 border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ animationDelay: `${i * 50}ms` }}>
          <div className="card-body items-center text-center">
            <div className="indicator">
              <span
                className={`indicator-item badge badge-xs ${user.status === 'online' ? 'badge-success' : user.status === 'away' ? 'badge-warning' : 'badge-ghost'}`}
                aria-label={`Status: ${user.status}`}></span>
              <Avatar id={user.id} size="xl" clickable={false} />
            </div>
            <h3 className="card-title mt-2 text-base">{user.name}</h3>
            <p className="text-base-content/60 text-sm">{user.email}</p>
            <span
              className={`badge ${user.role === 'Admin' ? 'badge-primary' : user.role === 'Editor' ? 'badge-secondary' : 'badge-ghost'}`}>
              {user.role}
            </span>
            <div className="card-actions mt-2">
              <button className="btn btn-ghost btn-sm transition-colors">View Profile</button>
            </div>
          </div>
        </div>
      ))}
    </div>

    {/* Avatar Stack Demo */}
    <div className="card border-base-300 bg-base-100 border shadow-sm">
      <div className="card-body">
        <h3 className="card-title text-base">Active Collaborators</h3>
        <div className="flex items-center gap-4">
          <div className="avatar-group -space-x-3">
            {DEMO_USERS.slice(0, 3).map((user) => (
              <Avatar
                key={user.id}
                id={`stack-${user.id}`}
                size="md"
                className="ring-base-100 ring-2"
                clickable={false}
              />
            ))}
            <div className="avatar avatar-placeholder ring-base-100 size-10 rounded-full ring-2">
              <div className="bg-neutral text-neutral-content flex size-10 items-center justify-center rounded-full text-sm font-semibold">
                +2
              </div>
            </div>
          </div>
          <span className="text-base-content/60 text-sm">5 people editing this document</span>
        </div>
      </div>
    </div>
  </div>
)
