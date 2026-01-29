# StableNet Explorer QA

QA automation tools for StableNet Explorer testing.

## Screenshot Capture Tool

Automatically capture full-page screenshots of Explorer URLs using Playwright.

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
npm install
```

This will install Playwright and its browser binaries.

**Note for corporate networks:** If you encounter certificate errors during browser installation, you may need to run:

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx playwright install chromium
```

### Usage

#### Method 1: Pipe JSON array via stdin

```bash
echo '[{"env":"wemix-testnet","menu":"dashboard","url":"https://scan.wemix.com/wemixTestnet/dashboard"}]' | npm run capture
```

#### Method 2: Provide JSON file

Create a file `urls.json`:

```json
[
  {"env":"wemix-testnet","menu":"dashboard","url":"https://scan.wemix.com/wemixTestnet/dashboard"},
  {"env":"wemix-testnet","menu":"blocks","url":"https://scan.wemix.com/wemixTestnet/blocks"}
]
```

Then run:

```bash
npm run capture urls.json
```

#### Method 3: Direct JSON argument

```bash
npm run capture '[{"env":"wemix-testnet","menu":"dashboard","url":"https://..."}]'
```

### Input Format

The script expects a JSON array with objects containing:
- `env`: Environment name (e.g., "wemix-testnet", "stablenet-testnet")
- `menu`: Menu/category name (e.g., "dashboard", "blocks", "transactions")
- `url`: Full URL to capture

### Output Structure

Screenshots are saved to:

```
evidence/
  {env}/
    {menu}/
      {menu}__{timestamp}__{title-slug}.png
```

Example:
```
evidence/
  wemix-testnet/
    dashboard/
      dashboard__2026-01-29_143022__wemix-testnet-dashboard.png
```

### Filename Convention

- Format: `<menu>__<yyyy-mm-dd_HHMMSS>__<slugified-title>.png`
- If "Connected" indicator is not found within 10 seconds, filename includes `__NOT_CONNECTED` suffix
- If page title cannot be fetched, URL path segment is used instead

### Features

- ✅ Full-page screenshots (equivalent to Chrome DevTools "Capture full size screenshot")
- ✅ Waits for `networkidle` + 1 second extra delay
- ✅ Checks for "Connected" indicator (10s timeout)
- ✅ Automatic folder structure creation
- ✅ Error handling and summary report

### Example

Capture screenshots for multiple URLs:

```bash
cat > urls.json << EOF
[
  {"env":"wemix-testnet","menu":"dashboard","url":"https://scan.wemix.com/wemixTestnet/dashboard"},
  {"env":"wemix-testnet","menu":"blocks","url":"https://scan.wemix.com/wemixTestnet/blocks"},
  {"env":"wemix-testnet","menu":"transactions","url":"https://scan.wemix.com/wemixTestnet/txs"}
]
EOF

npm run capture urls.json
```
