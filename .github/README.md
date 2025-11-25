# GitHub Actions Workflows

## Available Workflows

### Production Deployment (`prod.docs.plus.yml`)

**Triggers:**

```bash
git commit -m "Feature update (build front back)"
git push origin main
```

**What it does:**

- Blue-green deployment with zero downtime
- Deploys frontend + backend using Docker Compose
- Automated health checks
- Switches Nginx between blue/green stacks
- Removes old deployment

**Runner:** `prod.docs.plus` (self-hosted)

---

### Staging Deployment (`stage.docs.plus.yml`)

**Triggers:**

```bash
git commit -m "Test feature (build front back)"
git push origin dev
```

**What it does:**

- Simple stop/start deployment
- Faster iteration for testing
- Same Docker Compose structure as production

**Runner:** `stage.docs.plus` (self-hosted)

---

## Commit Message Keywords

**Required keywords in commit message:**

- `build` + `front` → Deploys full stack
- `build` + `back` → Deploys full stack
- `build` + `uptime-kuma` → Deploys monitoring

**Examples:**

```bash
git commit -m "New feature (build front back)"
git commit -m "API fix (build back)"
git commit -m "UI update (build front)"
git commit -m "Deploy monitoring (build uptime-kuma)"
```

---

## Monitoring Deployments

**Via GitHub UI:**

1. Go to repository → Actions tab
2. Click on running workflow
3. Watch logs in real-time

**Via Server:**

```bash
ssh user@prod.docs.plus
make status-prod
```

---

## Quick Links

- **Full Documentation:** [../DEPLOYMENT.md](../DEPLOYMENT.md)
- **Production Workflow:** [prod.docs.plus.yml](workflows/prod.docs.plus.yml)
- **Staging Workflow:** [stage.docs.plus.yml](workflows/stage.docs.plus.yml)
