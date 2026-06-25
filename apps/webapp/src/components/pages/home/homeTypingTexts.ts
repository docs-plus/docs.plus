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

export const HOME_TYPING_TEXTS: TypingTextItem[] = [
  { text: 'teams', icon: createElement(LuUsers, { size: 14 }), className: 'text-primary' },
  {
    text: 'communities',
    icon: createElement(LuGlobe, { size: 14 }),
    className: 'text-accent'
  },
  {
    text: 'classrooms',
    icon: createElement(LuGraduationCap, { size: 14 }),
    className: 'text-secondary'
  },
  { text: 'projects', icon: createElement(LuRocket, { size: 14 }), className: 'text-warning' },
  { text: 'meetups', icon: createElement(LuCalendar, { size: 14 }), className: 'text-error' },
  {
    text: 'organizations',
    icon: createElement(LuBuilding2, { size: 14 }),
    className: 'text-info'
  }
]

export const HOME_TYPING_SR_LABEL =
  'teams, communities, classrooms, projects, meetups, and organizations'
