# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Initial setup (install deps + generate Prisma client + run migrations)
npm run setup

# Development server (Next.js 15 + Turbopack)
npm run dev

# Build
npm run build

# Lint
npm run lint

# Tests (Vitest)
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Reset the database
npm run db:reset

# Regenerate Prisma client after schema changes
npx prisma generate

# Run migrations
npx prisma migrate dev
```

## Environment

Copy `.env` and set `ANTHROPIC_API_KEY`. Without it, the app runs with a `MockLanguageModel` that returns static component code instead of calling Claude.

The model used for generation is `claude-haiku-4-5` (set in `src/lib/provider.ts`).

## Architecture

UIGen is an AI-powered React component generator. Users describe components in a chat; Claude generates code into a **virtual file system** (in-memory, never written to disk); and a live preview renders the result in an iframe.

### Data flow

1. User sends a message via `ChatInterface`
2. `ChatProvider` (`src/lib/contexts/chat-context.tsx`) calls `/api/chat` via Vercel AI SDK's `useChat`, passing the serialized virtual FS and optional `projectId`
3. The API route (`src/app/api/chat/route.ts`) streams back tool calls using `streamText` with two tools: `str_replace_editor` and `file_manager`
4. Tool calls are intercepted client-side by `onToolCall` → `handleToolCall` in `FileSystemContext`, which mutates the in-memory VFS
5. `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`) watches `refreshTrigger` from `FileSystemContext` and re-renders the iframe by:
   - Transforming all `.jsx/.tsx/.ts/.js` files with `@babel/standalone`
   - Building an ES module import map (with blob URLs for local files, `esm.sh` for third-party packages)
   - Writing the full HTML to `iframe.srcdoc`

### Virtual File System

`src/lib/file-system.ts` — `VirtualFileSystem` class. Stores all files in a `Map<string, FileNode>`. Key operations: `createFile`, `updateFile`, `deleteFile`, `rename`, `serialize`/`deserializeFromNodes`.

`FileSystemContext` (`src/lib/contexts/file-system-context.tsx`) wraps the VFS in React state. The `refreshTrigger` counter is incremented on every mutation to trigger preview re-renders.

### AI Tools

- `str_replace_editor` (`src/lib/tools/str-replace.ts`) — creates files and performs targeted string replacements inside the VFS
- `file_manager` (`src/lib/tools/file-manager.ts`) — renames and deletes files in the VFS

The system prompt (`src/lib/prompts/generation.tsx`) instructs the model to:
- Always create `/App.jsx` as the entry point
- Use Tailwind CSS for styling (no hardcoded styles)
- Use `@/` as the import alias for all non-library imports (maps to the VFS root `/`)

### Persistence

Authenticated users' projects are persisted in SQLite via Prisma. The schema (`prisma/schema.prisma`) has two models: `User` and `Project`. A `Project` stores chat `messages` and file system `data` as JSON strings. The Prisma client is generated to `src/generated/prisma`.

Always reference `prisma/schema.prisma` to understand the structure of data stored in the database.

Auth uses JWT stored in an httpOnly cookie (`auth-token`), signed with `JWT_SECRET` env var. `src/lib/auth.ts` is server-only.

### Routing

- `/` — anonymous users see the editor; authenticated users are redirected to their most recent project (or a new one is created)
- `/[projectId]` — loads a specific project with its saved messages and file system state

Anonymous work is tracked in `src/lib/anon-work-tracker.ts` (localStorage) so it can be preserved on sign-up.

### Testing

Tests use Vitest + `@testing-library/react` with jsdom. Test files are colocated in `__tests__` directories next to the source. The Vitest config is in `vitest.config.ts`.

## Code Style

- Use comments sparingly. Only comment complex code. When commenting complex logic, make comments descriptive and use simple English.
