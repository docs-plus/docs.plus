# Source Directory (`/src`)

This directory contains all application source code organized by responsibility.

## 📁 Structure

```
src/
├── api/          # HTTP routes & controllers
├── config/       # Application configuration
├── extensions/   # Hocuspocus extensions
├── lib/          # Core libraries & integrations
├── middleware/   # Hono middleware
├── schemas/      # Zod validation schemas
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
├── index.ts      # Main REST API server
└── hocuspocus.server.ts  # WebSocket server
```

## 🎯 Quick Reference

### Adding New Features

**New API Endpoint?**
→ Add to `api/`

**New Validation?**
→ Add to `schemas/`

**New Service Integration?**
→ Add to `lib/`

**New Middleware?**
→ Add to `middleware/index.ts`

**New Type?**
→ Add to `types/index.ts`

**New Utility?**
→ Add to `utils/index.ts`

## 📖 Documentation

See [PROJECT_STRUCTURE.md](../PROJECT_STRUCTURE.md) for detailed architecture documentation.
