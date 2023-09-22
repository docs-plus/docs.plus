# 📚docs.plus

[![Generic badge](https://img.shields.io/badge/version-2.0.0-green.svg)](https://docs.plus)
[![Apache License](https://img.shields.io/badge/License-Apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/docs-plus/docs.plus/pulls)

docs.plus is a free, real-time collaboration tool built on open-source technologies. It empowers communities to share and organize information logically and hierarchically, making teamwork and knowledge sharing straightforward and effective.

## 🚀 Quick Start

**Prerequisites:**

- Node.js (version ">=18.15.0")
- [Yarn](https://yarnpkg.com/getting-started/install)
- PostgreSQL (downloadable from the [official PostgreSQL website](https://www.postgresql.org/download/)) or Docker for running a PostgreSQL container.

docs.plus is organized as a monorepo and uses Yarn [Workspaces](<https://yarnpkg.com/features/workspaces/#gatsby-focus-wrapper>) and [Lerna](https://lerna.js.org/) for managing dependencies and synchronizing versions across different packages.

## 🛠 Setting Up Your Development Environment

Follow these steps to get started with docs.plus:

```bash
# Clone the repository
$ git clone https://github.com/docs-plus/docs.plus.git

# Navigate to the project directory
$ cd docs.plus

# Install dependencies
$ yarn
```

### PostgreSQL Database Setup

Set up a PostgreSQL database accessible to your development environment. If using Docker, here's a basic command to start a PostgreSQL container:

```bash
docker run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -d postgres
```

More details on the PostgreSQL Docker image are available in the [official Docker documentation](https://docs.docker.com/samples/postgres/).
### Running the Project

**Unix-based systems (macOS, Linux):**

```bash
$ yarn start
```

**Windows systems:**
Ensure PowerShell is installed. Then, to start the development servers, open three separate PowerShell windows and run the following commands:

```bash
# PowerShell Window 1
cd .\packages\hocuspocus.server\
npm run dev

# PowerShell Window 2
cd .\packages\hocuspocus.server\
npm run dev:ws

# PowerShell Window 3
cd .\packages\webapp\
npm run dev
```

💡 We're actively seeking contributors to improve our Windows setup instructions. If you can assist, we'd be thrilled! Your contribution will enhance the accessibility of docs.plus for Windows users and foster our community's growth. All collaboration is warmly welcomed!

## Docker Deployment
```sh
$ docker-compose up
```

## 📫 Connect With Us

We'd love to hear from you! Join our [Discussions](https://github.com/docs-plus/docs.plus/discussions), or reach out through:

- Twitter: [@docsdotplus](https://twitter.com/docsdotplus)
- Github: [docs.plus](https://github.com/nwspk/docs.plus)
- Slack: [docsplus](docsplus.slack.com)
- Email: [contact@newspeak.house](mailto:contact@newspeak.house)

## 📜 License

docs.plus is under the [Apache License v2](http://www.apache.org/licenses/LICENSE-2.0.html), granting you freedom to use, modify, distribute, and even sell your modifications under the same terms.

## 🙏 Support Our Project

docs.plus is free and open-source. Keeping it running and

 continuously improving requires resources. If you're able to support us, we'd greatly appreciate it:

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /> </a>

Your support maintains our servers and enhances this platform for everyone's benefit. Thank you for your generosity!
