# Use docs.plus from Claude or ChatGPT

How to connect docs.plus to Claude or ChatGPT, and what the AI app can then do with your documents. It does not explain the protocol or the tool inputs. For those, see [MCP connector reference](reference.md).

You add docs.plus as a connector in the AI app. Then you sign in to docs.plus as yourself, and the AI app acts as you. docs.plus calls it a connected app.

## Connect from docs.plus Settings

<!-- PENDING-HOST-TEST: Cursor, VS Code, Codex, Copilot CLI, Cline, LM Studio, Replit, agent prompt -->

This is the easiest way. One docs.plus page gives the steps for each AI app.

1. Sign in to docs.plus. Open **Settings** and choose **Connected apps**. The direct link is [docs.plus/#settings?tab=connected-apps](https://docs.plus/#settings?tab=connected-apps).
2. Pick the way that fits your AI app.
   - **An agent in a terminal**: under **Set up from a terminal agent**, choose **Claude Code**, **Codex**, **Copilot CLI** or **Cline**. That copies one command. Run it in a terminal. The Codex command also starts the sign-in.
   - **Any other agent**, such as Warp, Kiro or OpenCode: choose **Any other agent**. That copies a short prompt. Paste it into the agent. The agent shows you each change and waits for your yes.
   - **Claude**: under **Add an AI app**, choose **Add to Claude**. Claude's **Add custom connector** dialog opens with docs.plus filled in, and the server URL is copied. Claude warns that an external link suggested the connector. Check that the URL is the docs.plus server URL, then choose **Continue** and **Connect**.
   - **ChatGPT**: turn on **Developer mode** first, as the tab says. Then choose **Open ChatGPT**. ChatGPT Plugins opens, and the server URL is copied. Choose **+**, paste the URL, choose **OAuth**, then **Create**.
   - **Other**: choose **Add to Cursor**, **Add to VS Code** or **Add to LM Studio**, and the app opens with docs.plus filled in. **Add to Replit** opens Replit in a new tab. For any other AI app, copy the **MCP server URL** and paste it where the app asks for a remote MCP server.
   - The sections below give the steps for each AI app in full.
3. Start the sign-in. Claude and ChatGPT start it for you. In Claude Code, run `/mcp`. Other agents name their own step.
4. A docs.plus page opens. Check the address it returns you to, as [Check the consent page](#check-the-consent-page) explains. Then choose **Allow**.
   - Claude: **Returns you to claude.ai**. ChatGPT: **Returns you to chatgpt.com**.
   - Claude Code: `http://localhost:<port>`. Codex: `http://127.0.0.1:<port>`. The `<port>` is a number the app picks.
   - VS Code: `http://127.0.0.1:33418` or `https://vscode.dev`.
   - Cursor and other AI apps do not document their address yet. Allow only if you started the connection in that app yourself.

The tab opens with a short note on what the docs.plus MCP server lets an AI app do, and a **Setup guide** link to this page. Next to the title, **Online** means your browser reached the MCP server. **Unreachable** means it did not; the page checks again every 30 seconds. The terminal agents sit in the same card, under the note. The **MCP server URL** and its **Copy** button are in the **Other** tab, and also in ChatGPT step 2. On a phone, **Add an AI app** shows no tabs, only the MCP server URL, and the terminal agents are hidden. Add apps from docs.plus on a computer. Claude added on the web or in Claude Desktop then works in the Claude phone app too.

## Connect in claude.ai, Claude Desktop, or Claude mobile

<!-- PENDING-HOST-TEST: claude.ai -->

1. In claude.ai, open [Customize > Connectors](https://claude.ai/customize/connectors). Choose **+**, then **Add custom connector**.
2. Name it `docs.plus`. For the URL, paste `https://prodback.docs.plus/api/mcp` exactly, with no `/` at the end.
3. If Claude asks how to register, choose **Register automatically**. Leave any OAuth fields empty. Then choose **Add** or **Continue**.
4. Choose **Connect**. A docs.plus page opens. Sign in if it asks.
5. Check that the page says **Returns you to claude.ai**. Then choose **Allow**.
6. In a chat, choose **+**, then **Connectors**, and check that docs.plus is on.
7. Use docs.plus in claude.ai, Claude Desktop, or Claude mobile. A connector you add in claude.ai shows in all three.

On a Team or Enterprise plan, an Owner adds the connector in **Organization settings > Connectors**. Members then choose **Connect**.

## Connect in ChatGPT

<!-- PENDING-HOST-TEST: ChatGPT -->

1. In ChatGPT on the web, open **Settings > Security and login** and turn on **Developer mode**. OpenAI's [developer mode guide](https://developers.openai.com/api/docs/guides/developer-mode) says which plans have it.
2. Open [ChatGPT Plugins](https://chatgpt.com/plugins) and choose **+**.
3. Name it `docs.plus`. Under **Connection**, paste `https://prodback.docs.plus/api/mcp`. If ChatGPT asks for authentication, choose **OAuth**.
4. Create the connection. A docs.plus page opens. Sign in if it asks.
5. Check that the page says **Returns you to chatgpt.com**. Then choose **Allow**.
6. In a new chat, turn on docs.plus from the tools menu.

ChatGPT keeps the tool list it saw when you connected. When docs.plus adds a tool, open [ChatGPT Plugins](https://chatgpt.com/plugins), pick docs.plus, and choose **Refresh**.

## Connect in Claude Code

<!-- PENDING-HOST-TEST: Claude Code -->

1. Run this in the folder where you use Claude Code. It adds docs.plus for that folder only.

   ```bash
   claude mcp add --transport http docs-plus https://prodback.docs.plus/api/mcp
   ```

   To add it for every folder instead, run this in any folder.

   ```bash
   claude mcp add --scope user --transport http docs-plus https://prodback.docs.plus/api/mcp
   ```

2. In Claude Code, run `/mcp`, pick `docs-plus`, and choose to sign in. A docs.plus page opens in your browser.
3. Check that the page returns you to `http://localhost:<port>`, an app on this computer. The `<port>` is a number Claude Code picks. Then choose **Allow**.

## Connect in other AI apps on your computer

Each AI app below runs on your computer. You add docs.plus with one command or one settings entry. Then you sign in to docs.plus in your browser.

These steps use the docs.plus server at `https://prodback.docs.plus/api/mcp`. If you run your own docs.plus server, use its MCP server URL instead.

### Codex

<!-- PENDING-HOST-TEST: Codex -->

1. Run this in a terminal.

   ```bash
   codex mcp add docs-plus --url https://prodback.docs.plus/api/mcp
   ```

2. Run this to sign in. A docs.plus page opens in your browser.

   ```bash
   codex mcp login docs-plus
   ```

3. Check that the page returns you to `http://127.0.0.1:<port>`, an app on this computer. The `<port>` is a number Codex picks. Then choose **Allow**.

### GitHub Copilot CLI

<!-- PENDING-HOST-TEST: GitHub Copilot CLI -->

1. Run this in a terminal.

   ```bash
   copilot mcp add --transport http docs-plus https://prodback.docs.plus/api/mcp
   ```

2. Start Copilot CLI. The first time it connects, a docs.plus page opens in your browser. If it does not open, run `/mcp auth` in Copilot CLI.
3. Check that the page returns you to `http://127.0.0.1:<port>`, an app on this computer. The `<port>` is a number Copilot CLI picks. Then choose **Allow**.

### Cline

<!-- PENDING-HOST-TEST: Cline CLI -->

1. Run this in a terminal.

   ```bash
   cline mcp add docs-plus https://prodback.docs.plus/api/mcp --transport http --yes
   ```

2. Run `cline mcp`, pick `docs-plus`, and choose **Authorize OAuth**. A docs.plus page opens in your browser.
3. Check that the page returns you to `http://127.0.0.1:1456`, an app on this computer. If that port is busy, Cline uses the next free port. Then choose **Allow**.

### Qwen Code

<!-- PENDING-HOST-TEST: Qwen Code -->

1. Run this in a terminal. If Qwen Code is already running, restart it.

   ```bash
   qwen mcp add --transport http docs-plus https://prodback.docs.plus/api/mcp
   ```

2. In Qwen Code, run `/mcp`, select `docs-plus`, and choose **Auth**. A docs.plus page opens in your browser. Sign in from this dialog, because the automatic sign-in can fail.
3. Check that the page returns you to `http://localhost:7777`, an app on this computer. Then choose **Allow**.

### Devin CLI

<!-- PENDING-HOST-TEST: Devin CLI -->

1. Run this in a terminal. To add docs.plus for every folder, add `-s user` after `add`.

   ```bash
   devin mcp add docs-plus https://prodback.docs.plus/api/mcp
   ```

2. Run this to sign in. A docs.plus page opens in your browser.

   ```bash
   devin mcp login docs-plus
   ```

3. Devin does not document the address it returns you to. Choose **Allow** only if you just ran the command.

### OpenCode

<!-- PENDING-HOST-TEST: OpenCode -->

1. Add this to your `opencode.json` file.

   ```json
   {
     "mcp": {
       "docs-plus": { "type": "remote", "url": "https://prodback.docs.plus/api/mcp" }
     }
   }
   ```

2. Run this to sign in. A docs.plus page opens in your browser.

   ```bash
   opencode mcp auth docs-plus
   ```

3. Check that the page returns you to `http://127.0.0.1:19876`, an app on this computer. Then choose **Allow**.

### Kimi Code

<!-- PENDING-HOST-TEST: Kimi Code -->

1. Add this to `~/.kimi-code/mcp.json`.

   ```json
   { "mcpServers": { "docs-plus": { "url": "https://prodback.docs.plus/api/mcp" } } }
   ```

2. In Kimi Code, run `/mcp-config login docs-plus`. A docs.plus page opens in your browser.
3. Check that the page returns you to `http://127.0.0.1:<port>`, an app on this computer. The `<port>` is a number Kimi Code picks. Then choose **Allow**.

## Check the consent page

The docs.plus page asks, for example, **Allow Claude to use your docs.plus account?** It shows the account you are signed in with, what the app will be able to do, and where it returns you.

Any app can register itself with docs.plus under any name, so the name alone proves nothing. docs.plus checks the address the app returns you to instead. Only the real site can receive a sign-in sent to its address. The page shows one of three cases.

- **Claude or ChatGPT.** The page names the app and says **Returns you to claude.ai** or **Returns you to chatgpt.com**.
- **An app on your computer**, such as Claude Code. The page shows an address like `http://localhost:<port>`. Any program on your computer can use that address, so allow it only if you just started the app.
- **Any other app.** The page puts the name in quotes and shows a warning with the address. Allow it only if you trust that address.

Each Connect section above says which address to expect. If the address is not the one you expect, choose **Cancel**.

## What you can ask for

You ask in your own words. To point at one document, paste its link or give its title. The AI app picks the tool, and it may show the tool name when it asks for your permission.

| Tool                 | What it does                                                                | You could ask                                                          |
| -------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `find_documents`     | Lists or finds your documents, or searches public ones, by title            | "Find my docs.plus document called Launch plan."                       |
| `create_document`    | Makes a new document that you own                                           | "Create a docs.plus document called Trip plan and write an outline."   |
| `get_outline`        | Shows the headings of a document                                            | "Show me the outline of my launch plan."                               |
| `read_document`      | Reads a whole document, or one section                                      | "Summarize the Budget section."                                        |
| `append_to_document` | Adds text at the end of a document you own                                  | "Add a Next steps section at the end."                                 |
| `replace_text`       | Changes words inside one paragraph, in a document you own                   | "In the Budget section, change 'high' to 'low'."                       |
| `edit_blocks`        | Adds, replaces or removes paragraphs at one spot in a section you own       | "Add a paragraph about catering after the second paragraph of Budget." |
| `list_chat_rooms`    | Lists the headings that have a chat                                         | "Which sections have a discussion?"                                    |
| `read_chat_thread`   | Reads the chat under one heading                                            | "What did people say about the Timeline?"                              |
| `post_chat_message`  | Posts a message in the chat under one heading, as you, in your own document | "Post a short summary of this thread in its chat."                     |

**If the AI app opens docs.plus in a browser instead,** stop it. That browser is not signed in as you, so a document it makes does not belong to you. Check that docs.plus is on for this chat: in Claude, **+ › Connectors**; in ChatGPT, the tools menu. Then ask it to use the docs.plus tools.

## What the AI app can and cannot do

- It reads only documents you can open in docs.plus yourself. A private document opens for its owner only.
- It writes and posts in chat only in documents you own. It refuses any other document, even a public one you can edit.
- It can create a new document. You own it. Like any new docs.plus document, it is public: other people can find it by title, open it and edit it. Make it private in docs.plus if you need to.
- It edits only the spot it names. It reads the section first, then changes words inside one paragraph, or adds, replaces or removes whole paragraphs at one numbered position.
- It never changes a heading. So the chat and the links on that heading stay in place.
- It can add a [diagram](../diagrams.md), such as a flowchart or a timeline. It writes the Mermaid text, and the pad draws it. docs.plus checks each diagram first and refuses one that does not parse or is too large.
- It never deletes a picture, video or file, including the name of an attached file. An edit that would remove one is refused.
- If someone changed a section after the AI app read it, the edit is refused. The AI app must read the section again first.
- A chat post can notify room members who follow every message and are away. The post has every `@` removed, so it never sends a mention or `@everyone` notification.
- It can see your name, profile picture and email address. It never gets a phone number.
- Pictures, videos and other media show as a placeholder such as `[image]`. The AI app never gets a media link.
- Text the AI app reads leaves docs.plus. The AI app's provider handles it under its own terms. docs.plus does not control that.

## Disconnect

1. In docs.plus, open **Settings** and choose **Connected apps**.
2. Under **Apps with access**, find the AI app and choose **Disconnect**. Choose **Disconnect** again to confirm.
3. Remove the docs.plus connector in the AI app too.

The AI app may keep what it already read. To delete that, use the AI app's own settings.

A Claude or ChatGPT row says where the app returns you, such as **Returns you to claude.ai**. An app on your computer is marked **On this computer**. Any other app is marked **Unverified app**, because any app can register itself under any name. An AI app that connected more than once shows the count on its row, such as `· 3 connections`. **Disconnect** ends all of them.

## If something goes wrong

When a tool fails, docs.plus sends the AI app a message. The AI app may show it word for word or in its own words. Here `…` stands for your document or heading. The last two rows are titles on the docs.plus consent page.

| What you see                                                                                                                                          | What to do                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `slug: "…" belongs to another person.`                                                                                                                | Make the change in docs.plus yourself. The AI app writes only in documents you own.                                                              |
| `slug: "…" is private. Only its owner can open it.`                                                                                                   | Only the owner can open it. The owner can make it public in docs.plus.                                                                           |
| `slug: no document "…" is open to you.`                                                                                                               | Paste the document link. The document may be deleted, or the title may not match.                                                                |
| `section_id: no chat room "…" in this document yet.`                                                                                                  | Open that heading's chat in docs.plus once, then ask again.                                                                                      |
| `remove_blocks: block(s) … hold a picture, video or file`                                                                                             | The AI app tried to remove media. Change those blocks in docs.plus yourself, or ask it to leave them.                                            |
| `old_text: it appears … times` or `old_text: it is not in this section`                                                                               | Ask again. The AI app should read the section again and quote more nearby words.                                                                 |
| `markdown: the diagram cannot be drawn.`, `markdown: diagram 2 cannot be drawn.` or `new_text: after this change, the diagram cannot be drawn.`       | Ask again. The AI app should use the reason to fix the diagram text, or pick a diagram type docs.plus draws.                                     |
| `docs.plus could not confirm the write.` or `docs.plus could not confirm the post.`                                                                   | It may already be saved. For a write, wait about a minute. Then check the document or chat before you ask again, or the text may be added twice. |
| `Another write to this document is running.`, `docs.plus could not open the document, so nothing was saved.`, or `docs.plus failed to run this tool.` | Ask again in a moment.                                                                                                                           |
| `Too many docs.plus tool calls.`, `429`, or the AI app cannot reach docs.plus                                                                         | Wait a few minutes, then ask again. The tool-call message gives the exact seconds.                                                               |
| **This request has ended**                                                                                                                            | The link is missing, has expired, or was already used. Go back to the AI app and connect again.                                                  |
| **We couldn’t load this request**                                                                                                                     | docs.plus could not reach the sign-in service. Choose **Try again**.                                                                             |
