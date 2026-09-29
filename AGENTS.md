# AGENTS.md

Static-export personal blog: Next.js 16 (`output: 'export'`) + React 19 + Tailwind 4 + react-markdown + Pagefind, pnpm. UI copy, comments, and docs are in Chinese; conventional commits.

## Commands

- `pnpm dev` — binds `0.0.0.0`; `predev` rebuilds the content manifest. LAN origins hardcoded in next.config.ts, override via `ALLOWED_DEV_ORIGINS`
- `pnpm build` — manifest → `next build` → Pagefind index into `out/pagefind/`; output in `out/`
- `pnpm test [path]` — Vitest (e.g. `pnpm test src/lib/content.test.ts`)
- Typecheck: `pnpm exec tsc --noEmit`. **No lint/format toolchain** — don't introduce one
- `scripts/*.ts` run via `node --experimental-strip-types` with explicit `.ts` import extensions; excluded from tsconfig

## Architecture

- **Static-export red line**: no Server Actions / ISR / image optimization; `node:fs` only in `src/lib/content.ts` (build-time reads); clients never fetch content
- **Directory ownership**: `src/app/` = thin routes only (params + build-time data + assembly; dynamic routes need `generateStaticParams`); `src/components/` by domain (`chrome/` = layout shell, `player/`, `reading/`, `listing/`, `primitives/` = only after second reuse, `ui/` = frozen shadcn vendor, `test-utils/` = tests only); `src/lib/` = content layer + markdown pipeline; `utils.ts` holds only `cn`
- rss/sitemap/robots read `NEXT_PUBLIC_SITE_URL` (placeholder default `https://orange.example.com`) — must be set in production

## Content pipeline (main footgun zone)

- One md = one entry, **filename is the slug** (`YYYY-MM-DD-<slug>.md`). **Exception: skills** = directory with required `SKILL.md` (`content/skills/<slug>/`), siblings shown as-is
- **Zod schemas in `src/lib/content.ts` are frontmatter's single source of truth**: invalid/missing fields fail the build naming the file; no schema-less field access in pages
- **Manifest cache**: `predev`/`prebuild` write `.generated/content-manifest.json` (gitignored); content APIs prefer it with a module cache — **editing `content/` while dev runs has no effect; restart `pnpm dev`**; 改清单结构要把 `MANIFEST_VERSION` +1
- Enabled collection with bad content must never be swallowed (missing dir = not-yet-enabled type, that's different)
- **Categories are content-declared, zero code changes**: English slug `[\w-]+`, schema-enforced, aggregated at build into `/category/<name>`; category (navigation) vs tags (search) are separate concerns
- New routed types must be registered in `TAGGED_TYPES` (`src/app/tags/[tag]/page.tsx`) or their tags have no landing page
- **New content type SOP** (zero changes to pipeline/theme/components): `content/<type>/` → zod schema → `src/app/<type>/[slug]/page.tsx` → if routed: `TAGGED_TYPES` + `TypeBadge` label. posts/life detail pages reuse `readEntry`/`entryMetadata`/`EntryView`; 新详情页还要渲染 `PagefindFilters`、把额外路由登记进 `sitemap.ts`
- **No JSX/HTML in content files**: custom blocks via remark-directive (`:::note`, `:::demo`) + components mapping; mermaid renders to SVG at build
- Binaries in `public/media/<type>/`, md holds references only; **one music md = one album**, `tracks` order = play queue, `file`/`cover` allow full `https://` URLs
- Slugs must match `[\w-]+` (path-traversal guard), else 404

## Theme rules (mandatory)

1. **Semantic tokens only** in components (`bg-background`, `text-foreground`, `bg-primary`, ...); **no hardcoded colors** (no `bg-white`, `text-zinc-500`, `#fff`, arbitrary values)
2. New semantic variables must be added to **every theme, both light and dark blocks** in `src/styles/theme.css` (the only place theme variables live) before use
3. Two orthogonal axes: theme name `data-theme` + mode `html.dark`; one variable pair per theme; pure client switch via `dataset.theme`/`classList` + localStorage
4. Shiki dual theme (`--shiki-light/--shiki-dark`) toggled by `html.dark`; no runtime re-highlighting
5. **Icon-only buttons**: only for action UI with an industry-standard metaphor, in a compact toolbar, where the current value needn't always show; content text never hidden. `aria-label` = tooltip text; tooltip on hover **and** focus, `aria-hidden`; touch targets ≥36px, tooltips auto-hidden on `any-pointer: coarse`, never hover-only. **Reuse `primitives/icon-button.tsx` + `primitives/tip.tsx`**

## Layout rules (mandatory)

1. **Global skeleton is constant**: header (sticky, z-40) / main (flex-1, width owned by each page) / footer + player bar (fixed bottom, z-50) + search (toolbar button + Ctrl/Cmd+K). Pages only swap main content
   - 顶栏恒为单行：移动端 4 个栏目收进 `MobileNavDrawer`，`sm` 起换行内 `HeaderNav`；`--header-height` 是顶栏高度的唯一来源，sticky 偏移与锚点避让都读它
2. **Page-owned widths**: default `max-w-2xl`, prose `max-w-prose`; posts/skills index dual-column `max-w-5xl`; skills detail is a 3-pane explorer at `max-w-7xl`. Chrome (header/footer) is full-bleed at `px-4 sm:px-6` — it never inherits a page's width
   - 技能包每个文件一个静态页：`SKILL.md` = `/skills/<slug>`，其余 = `/skills/<slug>/<path 去扩展名>`（映射与撞车检查见 `src/lib/skill-routes.ts`）
3. **Player bar is global chrome**: `PlayerProvider` in layout owns queue + singleton Audio — **components must never create their own `Audio`**; playback survives navigation; renders nothing when queue empty. 播放条 `fixed` 不占流，其占位块由 `PlayerBarLoader` 负责，main 不留常驻底部内边距
4. **Root `/` = posts list**: category list left (build-time, click = client-side filter on inlined data, no requests) + entries right. No cross-type homepage; article details live at `/posts/<slug>` (bare `/posts` is not a page)
5. **Search**: results from the build-time Pagefind index (only exists after `pnpm build`); UI drawn with semantic tokens; **the "no index in dev" fallback message is expected**, not a bug (`src/lib/pagefind.ts` → null). 范围过滤下推 `filters: { type }`，所以每个详情页都要渲染 `PagefindFilters`；输入框是 `combobox`，结果是 `listbox`

## React discipline

1. `'use client'` only for real interactivity
2. **Complex interaction primitives come from `src/components/ui/` (shadcn vendor)** — never hand-write Portal/focus trap/keyboard nav; vendor files may only adjust semantic tokens, never behavior. **shadcn CLI can't run here (zod conflict with pnpm store) — vendor by hand, don't run `init`/`add`**

## Testing (red-green-refactor)

1. **Write tests first**, covering normal render + abnormal boundaries (empty data, missing frontmatter fields); one test green at a time; no features beyond what tests demand
2. Vitest defaults to `environment: 'node'` — **DOM tests need `// @vitest-environment jsdom` on line 1**
3. Content-layer tests use temp-dir fixtures (`GetOptions.contentDir`) + `clearContentCache()` — **never depend on real `content/`**
4. Server components: assert HTML via `test-utils/render-server.ts`; Audio: `test-utils/mock-audio.ts`; stub jsdom gaps (`matchMedia`/`scrollIntoView`/`ResizeObserver`/`navigator.clipboard`) — `Not implemented: navigation / scrollTo` noise is expected
