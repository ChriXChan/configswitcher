# configswitcher

[中文](./README.md) | [English](./README.en.md)

An interactive terminal tool for switching local configuration files safely.

Use cases:

- Maintain multiple config variants in the same directory
- Quickly switch between active and candidate configs
- Recover automatically on failure to avoid file loss
- Preview file differences in a TUI before switching

The current implementation uses content swapping instead of multi-file rename transactions:

- Create snapshots in a temp directory before switching
- Write snapshot content back to target files
- Restore from snapshots if any step fails

This is more suitable than chained multi-file renames for this problem.

## Features

- Scan active and candidate files from a target directory
- Detect candidate configs by filename prefix
- Prefer grouped variants first, then fallback to single-file variants
- Compare files one by one in a TUI
- Select which prefixes participate in the current switch
- Refresh directory state before execution
- Restore automatically from snapshots on failure
- Recover leftover transaction temp files on startup/refresh

## How It Works

Example files:

```text
auth.json
auth_2.json
config.toml
config_2.toml
```

When switching to another variant, the tool will:

1. Create a temp transaction directory like `change-config-temp-xxxx`
2. Copy the involved source files into that directory
3. Write snapshot content back to target files
4. Remove the temp directory on success
5. Restore original content from snapshots on failure

That means:

- Both `auth.json` and `auth_2.json` remain in place
- Their contents are swapped on success
- The tool tries to restore the original state on failure

## Installation

### Local development

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
npm start
```

### After publishing to npm

```bash
npx configswitcher
```

Or after global install:

```bash
cs
```

The command also supports directory and basenames:

```bash
cs .
cs . auth config
cs C:\\your\\config\\dir auth config
```

## Usage

### Start

Start in the current directory:

```bash
npm run dev
```

Or pass directory and basenames explicitly:

```bash
npm run dev -- . auth config
```

In PowerShell, if you prefer comma-separated basenames, quote them:

```powershell
npm run dev -- . "auth,config"
```

## UI Screenshots

Initial view with candidate schemes on the left and file comparison on the right:

![Initial view](./assets/p1-first-view.png)

Switch to the next file with `Tab` / `Right`:

![Next file](./assets/p2-right-switch-next-file.png)

Toggle whether the current prefix participates with `Space`:

![Toggle selection](./assets/p3-space-to-unselect.png)

Press `Enter` to execute the replacement:

![Execute replacement](./assets/p4-enter-to-replace-content.png)

## Candidate Detection Rules

Active files:

- Filename exactly matches the configured basename
- Example: `auth.json`, `config.toml`

Candidate files:

- Any filename that starts with the basename and is not the active file itself
- Example:
  - `auth_2.json`
  - `auth - x.json`
  - `auth-test.json`

## Replacement Scheme Rules

The tool first groups variants that share the same suffix across multiple basenames.

Example:

```text
auth.json
auth_2.json
config.toml
config_2.toml
```

This becomes one grouped scheme:

```text
auth_2.json  config_2.toml
```

If a candidate file has no matching grouped partner, it appears as a single-file scheme.

## Shortcuts

On the main screen:

- `Left`: previous file
- `Tab` / `Right`: next file
- `Space`: select/unselect current prefix
- `PgUp` / `PgDn`: page up/down
- `R`: refresh current directory state
- `Enter`: execute replacement
- `Esc`: return from result view
- `Q`: quit

On the result screen:

- `R`: refresh current directory state
- `Enter`: rescan
- `Esc`: go back to schemes

## Result View

On failure, the result view shows:

- failure reason
- failure stage
  - preflight
  - snapshot
  - staging
  - commit
- the failed step
- restored item count

## Testing

Run tests:

```bash
npm test
```

Current coverage includes:

- successful content swap
- restoration on write failure
- basic behavior on the real filesystem
- recovery of leftover snapshot/temp files

## Release Notes

Before publishing to GitHub:

```bash
npm test
npm run build
```

Before publishing to npm:

```bash
npm test
npm run build
npm publish
```

`package.json` already includes:

- `bin`
- `files`
- `prepublishOnly`

So npm publish will run test and build first.

## Known Limits

- This is a best-effort safe recovery model, not an OS-level multi-file atomic transaction
- If external processes keep modifying the same files during execution, switching can still fail
- Better suited for manual interactive switching than high-frequency concurrent automation

## License

This project is licensed under the [MIT License](./LICENSE).
