# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Obsidian Community Plugin using TypeScript. Entry point `src/main.ts` compiles to `main.js` which Obsidian loads.

## Toolchain Setup (mise + TAKUMI Guard)

Node.js / pnpm / direnv are pinned by `mise.toml`. Dependencies are fetched through the
TAKUMI Guard secure registry (`https://npm.flatt.tech/`).

```bash
# Install tools, allow direnv, install deps, set up Git hooks
mise run setup
```

**No token required.** `.npmrc` uses TAKUMI Guard's _anonymous mode_ — setting the registry
URL alone enables malicious-package blocking, so forks and fresh clones install normally.
A personal (`tg_anon_`) or org (`tg_org_`) token only adds download tracking and breach
notifications; if you want that, put it in your user-level `~/.npmrc`, never in this repo.

CI uses `flatt-security/setup-takumi-guard-npm@v1`, which mints a short-lived token per job
via OIDC — no long-lived GitHub Secret. To link runs to an organization, add
`permissions: id-token: write` and pass `with: bot-id`.

TAKUMI Guard is a read-only proxy, so `npm publish` cannot go through it. This plugin ships
via GitHub Releases, so that limitation does not apply here.

If `pnpm` is missing from your shell, run `mise install`, or prefix commands with
`mise exec -- pnpm ...`.

## Commands

```bash
# Install dependencies
pnpm install

# Development (watch mode)
pnpm dev

# Production build
pnpm build

# Run all tests
pnpm test

# Run tests once (no watch)
pnpm test:run

# Run single test file
pnpm test src/example.test.ts

# Linting (Oxlint + ESLint with obsidianmd plugin)
pnpm lint
pnpm lint:fix

# Type checking
pnpm typecheck

# Full validation (lint + typecheck + test + build)
pnpm validate
```

## Development Setup for Vault Testing

Create `.env` file to output directly to your Obsidian vault during development:

```bash
OBSIDIAN_PLUGIN_DIR=/path/to/YourVault/.obsidian/plugins/sample-plugin
```

When set, `pnpm dev` outputs `main.js` directly to the vault. Production build (`pnpm build`) always outputs to project root.

## Architecture

```
src/
  main.ts                      # Plugin entry point - keep minimal, lifecycle only
  settings.ts                  # Settings types, defaults, and the declarative SettingTab
  commands/index.ts            # Wiring: reads settings, assembles collaborators, opens the modal
  calendar/
    dateMath.ts                # Date arithmetic on local-midnight Dates
    monthGrid.ts               # The 6x7 grid for one month
    navigation.ts              # Where a key lands, and which way the grid travels
  dailyNote/
    coreSettings.ts            # Reads the core Daily notes plugin's folder/format/template
    notePath.ts                # Folder + formatted date -> vault path and its ancestors
    template.ts                # Expands {{date}} / {{time}} / {{title}}
    environment.ts             # DailyNoteEnvironment: what opening a note needs, as an interface
    obsidianEnvironment.ts     # The one adapter that talks to App/Vault/Notice
    openDailyNote.ts           # Decides create-or-open, ask-or-not, which message
  ui/
    keymap.ts                  # Keystroke -> CalendarAction
    CalendarModal.ts           # The grid's DOM and animation
    ConfirmModal.ts            # Yes/no dialog
  **/*.test.ts                 # Vitest, colocated with the module under test
```

**Key pattern**: `main.ts` should only handle plugin lifecycle (`onload`, `onunload`). Delegate feature logic to separate modules.

### Why modules avoid importing `obsidian`

The `obsidian` npm package is **types only** — its `package.json` has `"main": ""`, and
`vite.config.ts` externalises it for tests as well as for the build. So any module that
imports a _value_ from `obsidian` (`Notice`, `TFile`, `moment`, `normalizePath`, `Modal`)
is unreachable from Vitest and cannot be tested at all. A `import type` is erased, so it
costs nothing — which is why `coreSettings.ts` is testable despite taking an `App`.

The convention that follows: **push decisions away from the Obsidian surface.**

- `template.ts` takes `formatDate` / `formatTime` as arguments rather than importing `moment`.
- `openDailyNote.ts` states everything it needs as `DailyNoteEnvironment` and takes it as a
  parameter; `obsidianEnvironment.ts` is the only implementation and holds nothing but
  one-line delegations, because anything that can branch belongs on the testable side.
- `navigation.ts` holds the focus and paging rules that used to live inside `CalendarModal`.

`pnpm test:coverage` reports every file under `src/`, so the modules still stuck on the
Obsidian side of the line show up as 0% rather than disappearing from the summary. The
files legitimately left there are the DOM shells (`CalendarModal`, `ConfirmModal`), the
lifecycle (`main.ts`), the wiring (`commands/index.ts`), the declarative settings data, and
the single adapter. Covering the two modals would need a DOM environment plus a hand-written
`obsidian` stub; that trade has not been taken.

## Build System

**Vite+ (`vite-plus`) is the unified toolchain.** One dependency supplies the bundler,
test runner, linter, and formatter; `vite.config.ts` imports `defineConfig` from `vite-plus`.

- **Bundler**: Vite 8 + Rolldown, via Vite+ (`vp build`)
- **Testing**: Vitest, via Vite+ (`vp test`); tests import from `vite-plus/test`, not `vitest`
- **Linting**: Oxlint via Vite+ (`vp lint`) + ESLint (obsidianmd-specific rules only)
- **Formatting**: oxfmt via Vite+ (`vp fmt`; add `--write` to actually rewrite)

**Never call `oxlint` or `oxfmt` directly.** Vite+ replaces those bin names with shims that
print a redirect and exit 1. Use `vp lint` / `vp fmt` — this is why `lefthook.yml` calls
`pnpm exec vp lint` rather than `pnpm exec oxlint`.

`vp toolchain` prints the exact bundled tool versions. `vp check` runs format + lint + types
in one pass.

### pnpm Configuration

- `package.json` pins the package manager (`packageManager: pnpm@10.26.0`) and requires
  Node `>=20`, matching the CI matrix. `private: true` guards against accidental npm publish —
  this plugin ships via GitHub releases, never npm.
- `pnpm-workspace.yaml` holds pnpm settings (pnpm 10 reads settings from here, not `.npmrc`):
    - `onlyBuiltDependencies` — pnpm 10 blocks dependency build scripts by default.
      **lefthook must stay on this list**; its postinstall is what installs the Git hooks,
      so removing it silently disables `lefthook.yml`.
    - `minimumReleaseAge: 10080` — ignore package versions published within the last 7 days
      (value is in minutes). Applies at _resolution_ time only, so `--frozen-lockfile`
      installs are unaffected. Layers with TAKUMI Guard for supply-chain defense.
    - `minimumReleaseAgeExclude` — added by `vp migrate`. Exempts the Vite+ toolchain packages
      from the 7-day hold, since their releases are pinned as an interlocking set.
    - `catalog:` / `overrides` — also from `vp migrate`. `vite` and `vitest` resolve to the
      versions Vite+ bundles, so the toolchain cannot drift out of sync. This is why those
      entries in `package.json` read `catalog:` instead of a version range.

## Obsidian Plugin Constraints

- Bundle everything into single `main.js` (no unbundled runtime deps)
- Use `this.register*` helpers for cleanup (DOM events, intervals, workspace events)
- Command IDs are stable API - never rename after release
- `manifest.json` `id` is immutable after release
- Default to offline operation; network requests require explicit user consent and documentation

## TypeScript Configuration

Strict mode with `noUncheckedIndexedAccess`, `strictNullChecks`, `noImplicitAny`. Source in `src/`.
`moduleResolution` is `bundler`, matching the Vite build.

**TypeScript is held at 5.x on purpose.** TypeScript 7 is released, but `typescript-eslint`
declares `typescript: >=4.8.4 <6.1.0`, and `eslint-plugin-obsidianmd` depends on
typescript-eslint. Bumping to 7 makes `pnpm lint` fail outright with
"typescript-eslint does not support TS 7.0". Revisit once typescript-eslint ships TS 7 support.

## Skills

### `obsidian-plugin` Skill

Obsidianプラグイン開発のベストプラクティスを提供するSkill。以下の場面で**自動的に適用**される：

- プラグインコードの新規作成・修正
- コマンド、設定タブ、ビューの追加
- ファイル・フォルダ操作の実装
- UIコンポーネント（Modal、SettingTab等）の構築
- プラグインコードのレビュー

#### Skillが提供する知識

| ファイル           | 内容                                                       |
| ------------------ | ---------------------------------------------------------- |
| `api-patterns.md`  | Workspace、Vault、Editor、MetadataCacheのAPIパターン       |
| `ui-components.md` | SettingTab、Modal、View、CSSスタイリングのパターン         |
| `security.md`      | **必須**: DOM操作のセキュリティルール（`innerHTML`禁止等） |

#### 重要なルール

1. **`innerHTML`/`outerHTML`は使用禁止** → `createEl()`, `createDiv()`, `setText()` を使用
2. **グローバル`app`禁止** → `this.app` を使用
3. **`registerEvent()`でイベント登録** → アンロード時の自動クリーンアップのため
4. **ユーザーパスは`normalizePath()`で正規化**
