# Calendar palette

An Obsidian plugin that pops a calendar over whatever you are doing. Move with the
arrow keys, press Enter, and you are in that day's daily note.

No sidebar view to keep open, no pane to reserve — it is a command you can trigger
from any note and dismiss with Escape.

## Usage

Run **Calendar palette: Open calendar** from the command palette (or bind it to a
hotkey — the command ID is `calendar-palette:open-calendar`).

| Key                               | Action                     |
| --------------------------------- | -------------------------- |
| `←` / `→`                         | Previous / next day        |
| `↑` / `↓`                         | Previous / next week       |
| `Page Up` / `Page Down`           | Previous / next month      |
| `Shift` + `Page Up` / `Page Down` | Previous / next year       |
| `Home` or `T`                     | Jump back to today         |
| `Enter`                           | Open that day's daily note |
| `Ctrl` / `Cmd` + `Enter`          | Open it in a new tab       |
| `Escape`                          | Close                      |

Clicking a day works too. A dot under a day means a note already exists for it;
picking a day without one asks before creating it.

### Vim and Emacs keys

The **Key bindings** setting layers a second key set on top of the table above.
The arrows, `Home`/`T`, `Enter` and `Escape` keep working in every mode.

| Vim                          | Emacs                        | Action                |
| ---------------------------- | ---------------------------- | --------------------- |
| `h` / `l`                    | `Ctrl` + `b` / `f`           | Previous / next day   |
| `k` / `j`                    | `Ctrl` + `p` / `n`           | Previous / next week  |
| `Ctrl` + `b` / `f`           | `Alt` + `v` / `Ctrl` + `v`   | Previous / next month |
| `Ctrl` + `Shift` + `b` / `f` | `Alt`/`Ctrl` + `Shift` + `v` | Previous / next year  |
|                              | `.`                          | Jump back to today    |

Both modes use `Ctrl` literally, never `Cmd`, so macOS keeps `Cmd` free for
Obsidian's own hotkeys.

## Settings

| Setting                                 | Default       | Description                                                         |
| --------------------------------------- | ------------- | ------------------------------------------------------------------- |
| First day of the week                   | Follow locale | Sunday, Monday, or whatever your Obsidian locale says               |
| Confirm before creating a note          | On            | Turn off to create missing daily notes without asking               |
| Key bindings                            | Arrows only   | Add the Vim or Emacs key set on top of the arrows                   |
| Modal title                             | Month, left   | Where the month is written, and what the modal's title says         |
| Month transition                        | Slide         | Full-height directional slide, a shorter throw, or no motion at all |
| Higher contrast weekday headers         | On            | Draws them at `--text-muted`, which clears the WCAG AA threshold    |
| Dim the note dot on adjacent-month days | On            | Matches the dot to the greyed-out date it belongs to                |

Month transitions are skipped entirely when the system asks for reduced motion,
whatever the setting says.

Everything else — the folder, the filename format, and the template — comes from
the core **Daily notes** plugin, so there is nothing to configure twice. Slashes in
the filename format (`YYYY/MM/YYYY-MM-DD`) are honoured, and missing folders are
created on demand.

The template understands the same placeholders core daily notes does:
`{{date}}`, `{{time}}`, `{{title}}`, and their `{{date:YYYY}}` formatted variants.
Anything else is left untouched so Templater and friends can still expand it.

This plugin makes no network requests and reads nothing outside your vault.

## Development

Node.js, pnpm, and direnv are pinned by `mise.toml`; dependencies are fetched
through the TAKUMI Guard secure registry. See `CLAUDE.md` for the details.

```bash
mise run setup      # install tools, allow direnv, install deps, set up Git hooks
pnpm dev            # watch build
pnpm validate       # lint + typecheck + test + build
```

To build straight into a vault while developing, create a `.env`:

```bash
OBSIDIAN_PLUGIN_DIR=/path/to/YourVault/.obsidian/plugins/calendar-palette
```

### Layout

```
src/
  main.ts                    # plugin lifecycle only
  settings.ts                # settings + settings tab
  commands/index.ts          # command registration and wiring
  calendar/dateMath.ts       # pure date arithmetic
  calendar/monthGrid.ts      # pure 6x7 grid generation
  dailyNote/coreSettings.ts  # reads the core Daily notes configuration
  dailyNote/notePath.ts      # pure path resolution
  dailyNote/template.ts      # pure placeholder expansion
  dailyNote/openDailyNote.ts # find / create / open
  ui/CalendarModal.ts        # the grid, its headings, and its paging
  ui/keymap.ts               # pure keystroke -> action matching (arrows, vim, emacs)
  ui/ConfirmModal.ts         # create-note confirmation
```

`calendar/` and the pure modules under `dailyNote/` never import `obsidian`, which
is what makes them testable under the node-based test runner: `moment` is
re-exported by `obsidian` and the bundler marks that module external.

### Known unofficial API use

Obsidian exposes no public API for reading another plugin's settings, but the daily
note folder, format, and template live only in the core Daily notes plugin. Like
Calendar and Periodic Notes, this plugin reads
`app.internalPlugins.getPluginById("daily-notes").instance.options`. That cast is
confined to `src/dailyNote/coreSettings.ts` and falls back to Obsidian's own
defaults if the internals move.

## License

0BSD
