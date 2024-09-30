# 📚 docs.plus

[![Generic badge](https://img.shields.io/badge/version-2.0.0-green.svg)](https://docs.plus)
[![Apache License](https://img.shields.io/badge/License-Apache-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-green.svg)](https://github.com/docs-plus/docs.plus/pulls)

**docs.plus** is a free, real-time collaboration tool built on open-source technologies. It empowers communities to share and organize information logically and hierarchically, making teamwork and knowledge sharing straightforward and effective.

## 🚀 Quick Start

### Prerequisites

Ensure you have the following installed:

- **Node.js** (version `>=18.15.0`)
- **Yarn** - [Installation Guide](https://yarnpkg.com/getting-started/install)
- **PostgreSQL** - Download from the [official PostgreSQL website](https://www.postgresql.org/download/) or run via Docker.
- **Supabase** - You can choose between:
  - [Self-hosted](https://supabase.com/docs/guides/self-hosting/docker)
  - [Cloud-based](https://supabase.com/)
  - [CLI Installation](https://supabase.com/docs/guides/cli/getting-started)

### Development Environment Setup

Follow these steps to set up your development environment:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/docs-plus/docs.plus.git
   cd docs.plus
   ```

2. **Install Dependencies**

   ```bash
   yarn
   ```

3. **Build Dependencies**

   ```bash
   yarn build
   ```

4. **Install Supabase CLI**

   ```bash
   brew install supabase/tap/supabase
   ```

   > If you're using a different package manager, refer to the [Supabase CLI installation guide](https://supabase.com/docs/guides/cli/installation).

### Environment Configuration

Before starting the project, you need to create the `.env` files by following these steps:

1. **Locate the Example Files**: You will find `.env.example` files in the following directories:

   - `packages/webapp/.env.example`
   - `packages/supabase/.env.example`
   - `packages/hocuspocus.server/.env.example`

2. **Create .env Files**: Copy each `.env.example` to a new `.env` file in the same directory.

   ```bash
   cp packages/webapp/.env.example packages/webapp/.env
   cp packages/supabase/.env.example packages/supabase/.env
   cp packages/hocuspocus.server/.env.example packages/hocuspocus.server/.env
   ```

3. **Update Configurations**: Edit the `.env` files to replace placeholders with your actual configuration values.

### PostgreSQL Database Setup

You can set up PostgreSQL in your development environment by running the following Docker command:

```bash
docker run --name some-postgres -e POSTGRES_PASSWORD=mysecretpassword -d postgres
```

For more information on the PostgreSQL Docker image, refer to the [official Docker documentation](https://docs.docker.com/samples/postgres/).

### Running the Project

After setting up the environment and configuring the `.env` files, you can start the project in development mode using:

```bash
make local
```

This command will start the development server for the webapp, as well as the backend services (`hocuspocus` & `supabase`).

For more details on available commands, refer to the [Makefile](./Makefile).

## 📫 Connect With Us

We'd love to hear from you! You can reach out through the following channels:

- **Twitter**: [@docsdotplus](https://twitter.com/docsdotplus)
- **GitHub**: [docs.plus](https://github.com/nwspk/docs.plus)
- **Slack**: [docsplus](https://docsplus.slack.com)
- **Email**: [contact@newspeak.house](mailto:contact@newspeak.house)

## 📜 License

docs.plus is licensed under the [Apache License v2](http://www.apache.org/licenses/LICENSE-2.0.html). You are free to use, modify, distribute, and even sell your modifications under the same terms.

## 🙏 Support Our Project

docs.plus is a free and open-source project. To keep it running and continuously improving, we need your support. If you're able to contribute, we'd greatly appreciate it:

<a href="https://patreon.com/docsplus"><img src="https://img.shields.io/endpoint.svg?url=https%3A%2F%2Fshieldsio-patreon.vercel.app%2Fapi%3Fusername%3Ddocsplus%26type%3Dpatrons&style=for-the-badge" /> </a>

Your support helps maintain our servers and enhances the platform for everyone's benefit. Thank you for your generosity!
