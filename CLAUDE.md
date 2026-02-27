# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Production build
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:push` - Push schema changes to database
- `npm run db:generate` - Generate migrations
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Drizzle Studio

## Architecture

This is a Next.js 16 project using the App Router with TypeScript and Tailwind CSS v4.

**Key conventions:**

- Source code lives in `src/`
- App Router pages in `src/app/`
- Import alias: `@/*` maps to `./src/*`
- Uses Geist font family (sans and mono variants)

**Database:**

- Uses Drizzle ORM with PostgreSQL
- Schema defined in `src/lib/db/schema.ts`
- To modify database: update schema.ts then run `npm run db:push`

**Context:**

Always use Context7 MCP when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

Use Playwright MCP for testing, evaluation and development. Everytime you modify or implement a new feature, you should write tests for it.
