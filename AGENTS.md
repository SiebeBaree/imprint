# Imprint

Imprint creates Instagram campaigns for physical product brands. Users add a public Instagram profile, brand guidelines and product reference images, review an evidence-backed brand profile and generate six feed and story visuals with captions and suggested posting times. Individual images support prompt-based edits, version history and downloads.

The PoC has one brand per user and Google sign-in through Clerk. Private media lives in R2. Trigger.dev runs Instagram imports, brand analysis and campaign generation. Astra plans and reviews campaigns through OpenRouter Flex, with Nano Banana Pro for human scenes and Sunburst for product rendering and edits.

## This codebase

Turborepo monorepo: a Vite + React Router SPA (`apps/web`), a Fastify api (`apps/api`) and shared packages under `packages/`. The two apps deploy separately (on Vercel) and talk cross-origin.

## Principles

- Yagni. Fight for the smallest change that makes the behavior correct. Do not add abstractions for imagined futures and do not preserve complexity just because it exists.
- Typesafety over defensiveness. `any` is banned (lint enforced). The contract schemas are the single source of truth; if web and api disagree about a shape, the fix is in `@repo/contracts`, never a local cast.
- Comments only for what the code cannot show: framework magic, security trade-offs, policy, traps. Never restate the code. No em-dashes and no oxford commas anywhere, including comments.
- Run `pnpm typecheck && pnpm lint && pnpm test && pnpm format` at the repo root before finishing any change. Lint warnings fail the build on purpose.
- Do not create documentation files (README, docs/) unless explicitly asked.

## Glossary

- **Contract**: a Zod schema in `@repo/contracts` describing the wire format of one api input or output (dates travel as ISO strings). The api validates requests and serializes responses against it; the web parses every response against it. Both sides import the same object.
- **Module** (api): a vertical slice under `apps/api/src/modules/` with routes (schemas from contracts), a service (logic and not-found semantics) and a repo (database access). Registered as an encapsulated Fastify plugin.
- **Feature** (web): the mirror slice under `apps/web/src/features/`, owning its TanStack Query hooks (`api.ts`) and components. Routes compose features, never implement them.
- **Internal package**: a `@repo/*` workspace package that ships raw TypeScript source, compiled by whoever consumes it. Nothing under `packages/` has a build step.
- **Endpoint**: one route in an api module, defined by its contract schemas. Adding an endpoint means contract first, then route, service and repo.
- **Hook**: a TanStack Query hook in a feature's `api.ts`. Components never fetch directly, they call hooks.

## How a change flows

Contracts first, then api, then web. Add or change the Zod schema in `@repo/contracts`, implement the module route against it, then consume it from the web feature through the api-client. The type provider makes an api handler that violates its declared response schema a compile error and response serialization validates it again at runtime. For breaking contract changes use expand-contract: add the new field alongside the old one, deploy, remove the old field only after old bundles have drained. A one-step rename is exactly the deploy-skew bug the Sentry report exists to catch.

## Testing: when and what

The api's real surface is HTTP, so modules are tested by injecting requests into a fully built app backed by PGlite (an in-memory Postgres running the real migrations). That covers routing, validation, serialization and SQL in one honest test; write one per meaningful behavior of an endpoint, including the interesting rejections. A service function earns its own unit test only when it contains logic worth isolating, a passthrough does not. On the web, test contract schemas at their edges, real logic in lib and dumb components with behavior worth pinning; hooks wired to TanStack Query are covered by the e2e journey, not by mocking the query client. The root Playwright suite runs against the real running app. Set E2E_STORAGE_STATE to a Clerk-authenticated Playwright state file and E2E_CAMPAIGN_ID to a completed test campaign. It makes real provider calls and stays out of automatic CI. Do not write smoke tests that assert a page renders, regression tests for deleted features or tests that mock half the app; if a test needs heavy mocking, the seam is wrong.

## Things you need to know

- The api is built for dependency injection: `buildApp` receives the database, logger and config, which is what lets tests swap in PGlite. Keep new cross-cutting concerns injectable the same way.
- Fastify scoping matters: cross-cutting plugins use `fastify-plugin` to escape encapsulation and the error handler must be registered before the route modules, or child scopes keep the default handler.
- The web is a pure SPA (`ssr: false`). No server code, no secrets; everything prefixed `VITE_` is inlined into the public bundle at build time.
- The api has no build step. Locally tsx runs the TS source; on Vercel the Fastify preset compiles the source in place and invokes the handler default-exported from `app.ts` (the builder's entrypoint), while `listen` only runs when `server.ts` is executed directly.
- Shared dependency versions live in the pnpm catalog; new packages that also use them should reference `catalog:` instead of pinning their own copy.
- Production api logs are plain JSON on stdout for the Vercel Axiom drain; pretty printing exists only under `NODE_ENV=development`. Never add a log shipper to the code.
- Builds without an environment use `SKIP_ENV_VALIDATION=1` (api) and `VITE_SKIP_ENV_VALIDATION=1` (web). Never weaken a required env var to optional to make a build pass; the fail-fast is the point.
- Formatting is oxfmt's job from the repo root, including import order and Tailwind class order. Lint rules live in `@repo/oxlint-config` so all packages stay on one rule set.
- Clerk tokens are verified in the injected auth plugin. Every product module protects its routes and scopes records to the authenticated owner. The web uses a custom Google-only sign-in flow.
- `pnpm db:migrate` loads the database URL from `apps/api/.env`. Run it after adding the environment variables. `pnpm dev` starts the web, API and Trigger.dev worker together. `pnpm jobs:dev` runs only the worker if needed. Tests use PGlite through dependency injection, never through an alternate application runtime.
