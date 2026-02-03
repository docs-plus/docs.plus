# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities by emailing:

📧 **security@docs.plus**

### What to Include

Please include the following in your report:

- **Description** of the vulnerability
- **Steps to reproduce** the issue
- **Potential impact** of the vulnerability
- **Suggested fix** (if you have one)
- **Your contact information** for follow-up questions

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
2. **Assessment**: We will investigate and assess the vulnerability within **7 days**.
3. **Resolution**: We aim to release a fix within **30 days** for critical issues.
4. **Disclosure**: We will coordinate with you on public disclosure timing.

### Scope

The following are in scope for security reports:

- **docs.plus web application** (docs.plus)
- **Backend API** (prodback.docs.plus)
- **WebSocket server** (Hocuspocus)
- **Authentication/Authorization** issues
- **Data exposure** vulnerabilities
- **Injection** vulnerabilities (SQL, XSS, etc.)

The following are **out of scope**:

- Denial of Service (DoS) attacks
- Social engineering attacks
- Physical security issues
- Issues in third-party dependencies (report to the upstream project)
- Issues requiring physical access to a user's device

### Safe Harbor

We consider security research conducted in accordance with this policy to be:

- Authorized concerning any applicable anti-hacking laws
- Authorized concerning any relevant anti-circumvention laws
- Exempt from restrictions in our Terms of Service that would interfere with conducting security research

We will not pursue civil action or initiate a complaint to law enforcement for accidental, good-faith violations of this policy.

### Recognition

We appreciate the security research community's efforts in helping keep docs.plus safe. Reporters of valid vulnerabilities will be:

- Acknowledged in our security advisories (unless you prefer to remain anonymous)

## Security Best Practices for Contributors

If you're contributing to docs.plus, please follow these guidelines:

### Code Security

- Never commit secrets, API keys, or credentials
- Use parameterized queries (Prisma handles this)
- Validate and sanitize all user input
- Use Zod schemas for input validation
- Follow the principle of least privilege

### Dependencies

- Keep dependencies up to date
- Run `bun pm audit` before submitting PRs
- Review security advisories for dependencies

### Authentication

- Use Supabase Auth for all authentication
- Verify JWT tokens on all protected endpoints
- Use service role keys only in backend services

### Data Protection

- Use HTTPS for all communications
- Encrypt sensitive data at rest
- Follow GDPR guidelines for user data

## Severity Classification

| Severity | Response Time | Examples                            |
| -------- | ------------- | ----------------------------------- |
| Critical | 24 hours      | RCE, Auth bypass, Data breach       |
| High     | 7 days        | Privilege escalation, SQL injection |
| Medium   | 30 days       | XSS, CSRF, Information disclosure   |
| Low      | 90 days       | Minor issues, Hardening suggestions |

## Security Features

docs.plus implements the following security measures:

- ✅ TLS encryption in transit (Traefik)
- ✅ JWT-based authentication (Supabase)
- ✅ Row-Level Security (Supabase RLS)
- ✅ Rate limiting (Redis-backed)
- ✅ Security headers (Hono secureHeaders)
- ✅ Input validation (Zod schemas)
- ✅ Parameterized queries (Prisma)
- ✅ Dependency scanning in CI
- ✅ No exposed internal endpoints (pgmq queue architecture)

---

Thank you for helping keep docs.plus and our users safe!
