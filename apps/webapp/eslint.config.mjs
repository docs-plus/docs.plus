import nextConfig from '../../packages/eslint-config/next.js'

// A flat-config rule entry replaces the shared one, so the console selector is repeated here.
// Keep it in step with packages/eslint-config/next.js.
const consoleSelector = {
  selector:
    "CallExpression[callee.object.name='console'][callee.property.name!=/^(info|warn|error|log|debug)$/]",
  message: 'Prefer console.info, console.warn, or console.error in production code.'
}

// Loading-state guard: design-system.md §State language. A class string is a JSX or JS literal.
const SKELETON = String.raw`/\bskeleton\b/`
// Side variants (rounded-t-lg) and arbitrary values (rounded-[4px]) count as literal radii.
const RADIUS_TOKEN = String.raw`(^|[\s:])rounded(-[trblsexy]{1,2})?(-(sm|md|lg|xl|2xl|3xl)|-\[[^\]]*\])?`
const RADIUS = `/${RADIUS_TOKEN}(\\s|$)/`
// A non-tail template chunk may end in a prefix like `rounded${size}`, so it needs whitespace after.
const RADIUS_MID = `/${RADIUS_TOKEN}\\s/`
const BG = String.raw`/(^|[\s:])bg-/`
const skeletonSelectors = [
  {
    selector: `Literal[value=${SKELETON}][value=${RADIUS}], TemplateLiteral:has(TemplateElement[value.raw=${SKELETON}]):has(TemplateElement[value.raw=${RADIUS_MID}], TemplateElement[tail=true][value.raw=${RADIUS}])`,
    message:
      'A skeleton bone takes no literal radius class. Use rounded-field, rounded-box, rounded-full or rounded-none (design-system.md §State language).'
  },
  {
    selector: `Literal[value=${SKELETON}][value=${BG}], TemplateLiteral:has(TemplateElement[value.raw=${SKELETON}]):has(TemplateElement[value.raw=${BG}])`,
    message:
      'A skeleton bone takes no bg-* class; daisyUI .skeleton owns the fill (design-system.md §State language).'
  }
]
const pulseSelector = {
  selector: 'Literal[value=/animate-pulse/], TemplateElement[value.raw=/animate-pulse/]',
  message:
    'No animate-pulse. Use a .skeleton bone or the daisyUI spinner (design-system.md §State language).'
}

export default [
  { ignores: ['src/types/supabase.ts'] },
  ...nextConfig,
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'tailwind-merge',
              importNames: ['twMerge'],
              message: 'Use @utils/twMerge (it knows text-meta).'
            }
          ]
        }
      ],
      'no-restricted-syntax': ['warn', consoleSelector, ...skeletonSelectors, pulseSelector]
    }
  },
  {
    files: ['src/utils/twMerge.ts'],
    rules: { 'no-restricted-imports': 'off' }
  },
  {
    // The shared config allows any console call in the logger; keep that, but keep the guard.
    files: ['src/utils/logger.ts'],
    rules: { 'no-restricted-syntax': ['warn', ...skeletonSelectors, pulseSelector] }
  },
  {
    // Not loaders: typing dots and the live recording dot.
    files: [
      'src/components/ui/TypingText.tsx',
      'src/components/chatroom/components/MessageComposer/components/VoiceRecordingBar.tsx'
    ],
    rules: { 'no-restricted-syntax': ['warn', consoleSelector, ...skeletonSelectors] }
  }
]
