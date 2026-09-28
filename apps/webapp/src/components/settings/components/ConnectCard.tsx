import { AppMark } from '@components/ui/AppMark'
import CopyButton from '@components/ui/CopyButton'
import { PanelTabBar } from '@components/ui/PanelTabBar'
import { Icons } from '@icons'
import { AI_APP_BRANDS, type AiAppId } from '@utils/aiAppBrands'
import { type ReactNode, useState } from 'react'
import { LuPlug } from 'react-icons/lu'

import { GITHUB_REPO_URL } from '../constants'
import { isMobileSurface } from '../utils/isMobileSurface'
import { mcpServerUrl } from '../utils/mcpServerUrl'
import SettingsCard from './SettingsCard'

const SERVER_NAME = 'docs-plus'
const SETUP_GUIDE_URL = `${GITHUB_REPO_URL}/blob/main/docs/mcp/README.md`

const TABS = [
  { label: 'Claude', icon: AI_APP_BRANDS.claude },
  { label: 'ChatGPT', icon: AI_APP_BRANDS.chatgpt },
  { label: 'Claude Code', icon: AI_APP_BRANDS.claudeCode },
  { label: 'Codex', icon: AI_APP_BRANDS.codex },
  { label: 'Other' }
] as const
type ConnectTab = (typeof TABS)[number]['label']

const Strong = ({ children }: { children: ReactNode }) => (
  <span className="text-base-content font-medium">{children}</span>
)

const Steps = ({ children }: { children: ReactNode }) => (
  <ol className="mt-5 space-y-4">{children}</ol>
)

const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <li className="flex gap-3">
    <span
      aria-hidden
      className="bg-base-200 text-base-content/70 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
      {n}
    </span>
    <div className="text-base-content/80 min-w-0 flex-1 pt-0.5 text-sm">{children}</div>
  </li>
)

const CopyLine = ({ text }: { text: string }) => (
  <div className="mt-2 flex items-center gap-2">
    <code className="bg-base-200 border-base-300 rounded-field text-base-content min-w-0 flex-1 overflow-x-auto border px-2 py-1.5 font-mono text-xs whitespace-nowrap">
      {text}
    </code>
    <CopyButton
      text={text}
      label="Copy"
      successLabel="Copied"
      successMessage={null}
      variant="soft"
      className="shrink-0"
    />
  </div>
)

// Opens in the click itself: Safari blocks a tab opened after the copy's await.
const OpenAndCopy = ({ label, href, text }: { label: string; href: string; text: string }) => (
  <CopyButton
    text={text}
    label={label}
    successLabel="URL copied"
    successMessage={null}
    variant="primary"
    icon={Icons.externalLink}
    onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
    className="shrink-0"
  />
)

const PanelHeader = ({
  app,
  name,
  where,
  action
}: {
  app: AiAppId
  name: string
  where: string
  action?: ReactNode
}) => (
  <div className="flex flex-wrap items-center gap-3">
    <AppMark app={app} />
    <div className="min-w-0 flex-1">
      <p className="text-base-content text-sm font-semibold">{name}</p>
      <p className="text-base-content/60 text-xs">{where}</p>
    </div>
    {action}
  </div>
)

const OtherRow = ({
  app,
  name,
  note,
  action
}: {
  app: AiAppId
  name: string
  note: string
  action: ReactNode
}) => (
  <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
    <AppMark app={app} />
    <div className="min-w-0 flex-1">
      <p className="text-base-content text-sm font-semibold">{name}</p>
      <p className="text-base-content/60 text-xs">{note}</p>
    </div>
    {action}
  </li>
)

const AddLink = ({ name, href }: { name: string; href: string }) => (
  <a href={href} className="btn btn-soft btn-neutral btn-sm shrink-0 gap-1.5">
    <Icons.externalLink size={16} aria-hidden />
    Add to {name}
  </a>
)

const ServerUrlField = ({ serverUrl }: { serverUrl: string }) => (
  <div>
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-base-content text-sm font-medium">MCP server URL</p>
      <a
        href={SETUP_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="link link-primary inline-flex items-center gap-1 text-xs no-underline hover:underline">
        Setup guide
        <Icons.externalLink size={12} aria-hidden />
      </a>
    </div>
    <CopyLine text={serverUrl} />
  </div>
)

function TabPanel({ tab, serverUrl }: { tab: ConnectTab; serverUrl: string }) {
  if (tab === 'Claude') {
    return (
      <>
        <PanelHeader
          app="claude"
          name="Claude"
          where="Web, desktop and phone"
          action={
            <OpenAndCopy
              label="Add to Claude"
              text={serverUrl}
              // Undocumented, but it filled both fields on 2026-09-28. The copied URL covers a
              // Claude that stops reading the parameters.
              href={`https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=docs.plus&connectorUrl=${encodeURIComponent(serverUrl)}`}
            />
          }
        />
        <Steps>
          <Step n={1}>
            Choose <Strong>Add to Claude</Strong>. Claude opens with docs.plus filled in, and the
            server URL is copied.
          </Step>
          <Step n={2}>
            In Claude, choose <Strong>Continue</Strong>, then <Strong>Connect</Strong>.
          </Step>
          <Step n={3}>
            On the docs.plus page, check that it says <Strong>Returns you to claude.ai</Strong>.
            Then choose <Strong>Allow</Strong>.
          </Step>
        </Steps>
      </>
    )
  }
  if (tab === 'ChatGPT') {
    return (
      <>
        <PanelHeader
          app="chatgpt"
          name="ChatGPT"
          where="Web, with Developer mode on"
          action={
            <OpenAndCopy
              label="Add to ChatGPT"
              text={serverUrl}
              href="https://chatgpt.com/plugins"
            />
          }
        />
        <Steps>
          <Step n={1}>
            In ChatGPT, open <Strong>Settings › Security and login</Strong> and turn on{' '}
            <Strong>Developer mode</Strong>.
          </Step>
          <Step n={2}>
            Choose <Strong>Add to ChatGPT</Strong>. ChatGPT Plugins opens, and the server URL is
            copied. You can also copy it here.
            <CopyLine text={serverUrl} />
          </Step>
          <Step n={3}>
            Choose <Strong>+</Strong>, paste the URL, choose <Strong>OAuth</Strong>, then{' '}
            <Strong>Create</Strong>.
          </Step>
          <Step n={4}>
            On the docs.plus page, check that it says <Strong>Returns you to chatgpt.com</Strong>.
            Then choose <Strong>Allow</Strong>.
          </Step>
        </Steps>
      </>
    )
  }
  if (tab === 'Claude Code') {
    return (
      <>
        <PanelHeader app="claudeCode" name="Claude Code" where="Terminal" />
        <Steps>
          <Step n={1}>
            Run this in a terminal.
            <CopyLine text={`claude mcp add --transport http ${SERVER_NAME} ${serverUrl}`} />
          </Step>
          <Step n={2}>
            In Claude Code, run <Strong>/mcp</Strong>, pick <Strong>{SERVER_NAME}</Strong>, and sign
            in.
          </Step>
          <Step n={3}>
            On the docs.plus page, choose <Strong>Allow</Strong>.
          </Step>
        </Steps>
      </>
    )
  }
  if (tab === 'Codex') {
    return (
      <>
        <PanelHeader app="codex" name="Codex" where="Terminal" />
        <Steps>
          <Step n={1}>
            Run this in a terminal.
            <CopyLine text={`codex mcp add ${SERVER_NAME} --url ${serverUrl}`} />
          </Step>
          <Step n={2}>
            Then run this to sign in.
            <CopyLine text={`codex mcp login ${SERVER_NAME}`} />
          </Step>
          <Step n={3}>
            On the docs.plus page, choose <Strong>Allow</Strong>.
          </Step>
        </Steps>
      </>
    )
  }
  const cursorConfig = encodeURIComponent(btoa(JSON.stringify({ url: serverUrl })))
  const vscodeConfig = encodeURIComponent(
    JSON.stringify({ name: SERVER_NAME, type: 'http', url: serverUrl })
  )
  return (
    <>
      <ul className="divide-base-300 divide-y">
        <OtherRow
          app="cursor"
          name="Cursor"
          note="Opens Cursor with docs.plus filled in."
          action={
            <AddLink
              name="Cursor"
              href={`cursor://anysphere.cursor-deeplink/mcp/install?name=${SERVER_NAME}&config=${cursorConfig}`}
            />
          }
        />
        <OtherRow
          app="vscode"
          name="VS Code"
          note="Opens VS Code with docs.plus filled in, for GitHub Copilot."
          action={<AddLink name="VS Code" href={`vscode:mcp/install?${vscodeConfig}`} />}
        />
      </ul>
      <div className="border-base-300 mt-4 border-t pt-4">
        <ServerUrlField serverUrl={serverUrl} />
        <p className="text-base-content/60 mt-2 text-xs">
          For any other AI app, paste this URL where it asks for a remote MCP server.
        </p>
      </div>
    </>
  )
}

const ConnectCard = () => {
  const [isPhone] = useState(() => typeof window !== 'undefined' && isMobileSurface())
  const [tab, setTab] = useState<ConnectTab>('Claude')
  const serverUrl = mcpServerUrl()

  return (
    <SettingsCard>
      <div className="mb-1 flex items-center gap-2">
        <LuPlug size={20} className="text-primary" />
        <h2 className="text-base-content text-base font-semibold">Add an AI app</h2>
      </div>
      {isPhone ? (
        // Phones cannot open editor links or run commands, and the Claude phone app cannot add a connector.
        <>
          <p className="text-base-content/60 text-xs sm:text-sm">
            Add apps from docs.plus on a computer. An app you add there, such as Claude, then works
            on your phone too.
          </p>
          <div className="mt-4">
            <ServerUrlField serverUrl={serverUrl} />
          </div>
        </>
      ) : (
        <>
          <p className="text-base-content/60 text-xs sm:text-sm">
            Pick your app, then follow its steps.
          </p>
          {/* Scrolls sideways instead of wrapping a tab label in a narrow window. */}
          <div className="mt-4 overflow-x-auto">
            <PanelTabBar tabs={TABS} activeTab={tab} onSelect={setTab} className="min-w-max p-0" />
          </div>
          <div role="tabpanel" aria-label={tab} className="mt-5">
            <TabPanel tab={tab} serverUrl={serverUrl} />
          </div>
        </>
      )}
    </SettingsCard>
  )
}

export default ConnectCard
