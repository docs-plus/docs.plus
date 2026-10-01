import { TypingTextItem } from '@components/ui/TypingText'
import { createElement } from 'react'
import {
  LuBuilding2,
  LuCalendar,
  LuGlobe,
  LuGraduationCap,
  LuRocket,
  LuUsers
} from 'react-icons/lu'

// Raw hues read 1.7-4.3:1 on the light floor. Accent and secondary have no ink token, so they
// borrow the nearest one.
export const HOME_TYPING_TEXTS: TypingTextItem[] = [
  {
    text: 'teams',
    icon: createElement(LuUsers, { size: 14 }),
    className: 'text-[var(--primary-ink)]'
  },
  {
    text: 'communities',
    icon: createElement(LuGlobe, { size: 14 }),
    className: 'text-[var(--warning-ink)]'
  },
  {
    text: 'classrooms',
    icon: createElement(LuGraduationCap, { size: 14 }),
    className: 'text-[var(--success-ink)]'
  },
  {
    text: 'projects',
    icon: createElement(LuRocket, { size: 14 }),
    className: 'text-[var(--warning-ink)]'
  },
  {
    text: 'meetups',
    icon: createElement(LuCalendar, { size: 14 }),
    className: 'text-[var(--error-ink)]'
  },
  {
    text: 'organizations',
    icon: createElement(LuBuilding2, { size: 14 }),
    className: 'text-[var(--info-ink)]'
  }
]

export const HOME_TYPING_SR_LABEL =
  'teams, communities, classrooms, projects, meetups, and organizations'
