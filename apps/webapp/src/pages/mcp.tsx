import { LegalPage, LegalSection } from '@components/pages/legal/LegalPage'
import { MCP_GUIDE_URL } from '@components/settings/constants'
import { TextLink } from '@components/ui/TextLink'
import { AI_APP_BRANDS } from '@utils/aiAppBrands'
import { agentCommands, appLinks } from '@utils/connectTargets'
import { mcpServerUrl } from '@utils/mcpServerUrl'

const { claude, chatgpt, claudeCode } = AI_APP_BRANDS
const names = Object.values(AI_APP_BRANDS).map(({ name }) => name)

// A long command scrolls inside its own box, so a phone never scrolls the page sideways.
const CodeBox = ({ text }: { text: string }) => (
  <code className="bg-base-200 border-base-300 rounded-field text-base-content block overflow-x-auto border px-2 py-1.5 font-mono text-xs whitespace-nowrap">
    {text}
  </code>
)

// Text only, no app links: names and commands come from connectTargets, so nothing here can drift.
export default function McpPage() {
  const serverUrl = mcpServerUrl()

  return (
    <LegalPage
      title={`Use docs.plus from ${claude.name}, ${chatgpt.name} and other AI apps`}
      description={`Connect docs.plus to ${names.slice(0, -1).join(', ')} or ${names.at(-1)} with one MCP server URL.`}
      path="/mcp"
      showUpdated={false}>
      <LegalSection title="Server URL">
        <p>
          Add this MCP server URL to your AI app. The app can then read the documents you can open
          and create new ones. It can edit and chat only in documents you own.
        </p>
        <CodeBox text={serverUrl} />
      </LegalSection>

      <LegalSection title="Chat apps">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            In {claude.name}, open Customize › Connectors. Choose +, then Add custom connector, and
            paste the URL. On the page that opens, check that it says Returns you to claude.ai. Then
            choose Allow.
          </li>
          <li>
            In {chatgpt.name} on the web, turn on Developer mode in Settings › Security and login.
            Then open Plugins, choose +, paste the URL, choose OAuth, then Create. On the page that
            opens, check that it says Returns you to chatgpt.com. Then choose Allow.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Terminal agents">
        <ul className="space-y-3">
          {agentCommands(serverUrl).map(({ app, command }) => (
            <li key={app} className="space-y-1">
              <p>{AI_APP_BRANDS[app].name}</p>
              <CodeBox text={command} />
            </li>
          ))}
        </ul>
        <p>
          Then start sign-in in your agent, for example <code className="font-mono">/mcp</code> in{' '}
          {claudeCode.name}. On the page that opens, check that it says an app on this computer.
          Then choose Allow.
        </p>
      </LegalSection>

      <LegalSection title="Other apps">
        <ul className="list-disc space-y-2 pl-5">
          {appLinks(serverUrl).map(({ app }) => (
            <li key={app}>
              {AI_APP_BRANDS[app].name}: on a computer, use Add to {AI_APP_BRANDS[app].name} in
              docs.plus Settings › Connected apps.
            </li>
          ))}
        </ul>
        <p>
          For any other AI app, paste this URL where it asks for a remote MCP server. The page that
          opens may show a warning. Allow only if you started the connection.
        </p>
      </LegalSection>

      <LegalSection title="Full guide">
        <p>
          The <TextLink href={MCP_GUIDE_URL}>MCP setup guide</TextLink> covers each app in more
          detail.
        </p>
      </LegalSection>
    </LegalPage>
  )
}
