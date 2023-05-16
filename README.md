[![Generic badge](https://img.shields.io/badge/version-2.0.0-green.svg)](https://docs.plus)
[![MIT license](https://img.shields.io/badge/License-Apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/docs-plus/docs.plus/pulls)

# 📚Docs.plus

Docs.plus is a free, real-time collaboration tool. It helps communities share and organize information logically and hierarchically. Simply put, it uses open-source technologies to make teamwork on documents and knowledge sharing straightforward and effective.


# 🚀 Getting Started

Docs.plus is organized as a monorepo and relies on Yarn [Workspaces](<https://yarnpkg.com/features/workspaces/#gatsby-focus-wrapper>) to manage dependencies and synchronize versions across different packages.

## Setting Up Your Development Environment
To get started with Docs.plus, follow these steps:

```bash
# Clone the repository
$ git clone https://github.com/docs-plus/docs.plus.git

# Install dependencies
$ yarn
```

### For Unix-based systems (macOS, Linux)

```bash
# Start the front-end and back-end development servers
$ make local
```

### For Windows systems
First, ensure you have PowerShell installed.

To start the development servers, open three separate PowerShell windows and run the following commands in each:

In the first PowerShell window:

```bash
cd .\packages\hocuspocus.server\
npm run dev:pg
```
In the second PowerShell window:

```bash
cd .\packages\hocuspocus.server\
npm run dev:ws
```
In the third PowerShell window:

```bash
cd .\packages\nextjs\
npm run dev
```
These commands start the SQLite database, WebSocket server, and the Next.js server respectively. Now you are ready to develop on Windows!
# 📫 Connect With Us

We're always excited to hear from our users! If you have questions, suggestions, or just want to chat, reach out to us through:

> Join our [Discussions](https://github.com/docs-plus/docs.plus/discussions) and help make docs.plus even better.


- Twitter: [@docsdotplus](https://twitter.com/docsdotplus)
- Github: [docs.plus](https://github.com/nwspk/docs.plus)
- Slack: [docsplus](docsplus.slack.com)
- Email: [contact@newspeak.house](mailto:contact@newspeak.house)

# 📜 License
Docs.plus is licensed under the [Apache License v2](http://www.apache.org/licenses/LICENSE-2.0.html). This permissive license grants you the freedom to use, modify, distribute, and even sell your modifications under the same terms.

# Support Our Project
Docs.plus is a free and open-source project. Keeping it running and constantly improving it requires resources. If you find our project valuable and are in a position to support us, we'd be extremely grateful:

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /> </a>

Your support enables us to maintain our servers and continue enhancing this platform for the benefit of all. Thank you in advance for your generosity.
