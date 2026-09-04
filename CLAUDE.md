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
  obsidianMoment.ts            # The only module that touches `moment`; see the TS 7 note
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
lifecycle (`main.ts`), the wiring (`commands/index.ts`), the declarative settings data, the
single adapter, and `obsidianMoment.ts`. Covering the two modals would need a DOM
environment plus a hand-written `obsidian` stub; that trade has not been taken.

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

### Lint Configuration

**The Oxlint config lives in the `lint` block of `vite.config.ts`, and nowhere else.**
A root `oxlint.json` is _not_ read — Oxlint looks for `.oxlintrc.json` — and Vite+ asks
for the `lint` block anyway so all toolchain config stays in one file. This repo carried
a dead `oxlint.json` for a while; `vp lint --print-config` is what proves which rules are
actually live, and is worth running after any change here.

Two things about that block are easy to get wrong:

- **Do not set `plugins`.** Naming plugins _replaces_ the default set rather than adding
  to it, so `plugins: ["typescript"]` silently switches `unicorn` and `oxc` off.
- **`ignorePatterns` is for tracked files only.** Oxlint already skips anything in
  `.gitignore`, so `main.js` and `coverage/` need no entry.

**`options.typeAware` is on.** It enables the rules that need type information
(`no-floating-promises`, `no-unsafe-type-assertion`, `consistent-return`, …). The engine
is `oxlint-tsgolint`, bundled by Vite+ — that is the **TypeScript 7** native
implementation, and it runs independently of the `typescript` in `devDependencies`. Full
runs take well under a second, so `lefthook.yml` pays nothing for it.

**`options.typeCheck` is on too**, which adds tsgo's own compiler diagnostics. The effect
is that every `pnpm lint` type-checks the project twice — once as `tsc` 5.9 sees it, once
as TypeScript 7 does — so a construct that only breaks under 7 is caught the day it is
written rather than at upgrade time. Neither flag is measurable in the runtime: a full
`vp lint` stays around 0.5s.

This also means `tsconfig.json` must `include` every file Oxlint lints. `eslint.config.mts`
is in there for that reason; left out, tsgo checks it against defaults where `@types/node`'s
`ImportMeta` augmentation is missing and `import.meta.dirname` fails. Note the knock-on:
a file in `include` must _not_ also appear in `allowDefaultProject` in `eslint.config.mts`,
or typescript-eslint's project service errors on the duplicate.

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

**TypeScript is held at 5.x, and exactly one thing is still in the way.**

**typescript-eslint refuses to load under TS 7.** It declares `typescript: >=4.8.4 <6.1.0`,
and `eslint-plugin-obsidianmd` depends on it. This is not a peer warning: `dist/index.js`
throws on `versionMajor >= 7` before it exports anything, so `pnpm lint:eslint` exits 2 with
"typescript-eslint does not support TS 7.0". Still true as of typescript-eslint 8.69.0;
tracked in [typescript-eslint#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)
for TS >= 7.1. **When that ships, bump `typescript` and nothing else should need doing** —
`tsc --noEmit` from both `typescript@6.0.3` and `typescript@7.0.2` already passes clean
against this tsconfig, and `pnpm test:run` never depended on the version at all.

The source no longer breaks under 7 because of `src/obsidianMoment.ts`. **That file exists
solely to work around an upstream bug and should be deleted when the bug is fixed.** TS 7
_removed_ the option to turn `esModuleInterop` off (TS 6 merely deprecates it), so interop
is always on; `obsidian.d.ts` does `import * as Moment from 'moment'` and re-exports
`export const moment: typeof Moment`, and with interop on, a namespace import of a CJS
`export =` module has no call signatures. Every `moment(...)` became
`TS2349: This expression is not callable`. Property access such as `moment.weekdaysShort()`
was never affected, which is why only the call form needs a cast.

To check whether upstream has fixed the declaration: drop the cast in `obsidianMoment.ts`
and run `pnpm lint`. `typeCheck` is on, so tsgo — which _is_ TypeScript 7 — will say. If it
stays quiet, inline the three functions and delete the file.

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
