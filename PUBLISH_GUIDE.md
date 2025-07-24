# Publishing Guide for @hardwarex/codex-kimi

## Ready to Publish! 🚀

Your npm package is configured and tested. Here's how to publish it:

### 1. Login to NPM
```bash
npm login
# Enter your npm credentials when prompted
```

### 2. Publish the Package
```bash
# Copy the npm configuration
cp npm-package.json package.json

# Publish to npm registry
npm publish

# Restore original package.json
git checkout HEAD -- package.json
```

### 3. Verify Publication
```bash
# Check if published successfully
npm view @hardwarex/codex-kimi
```

## After Publishing

### Users can install with:
```bash
npm install -g @hardwarex/codex-kimi
```

### Users can use with:
```bash
codex-kimi "Help me debug this code"
```

## Package Details
- **Name**: `@hardwarex/codex-kimi`
- **Version**: `1.0.0`
- **Author**: HardwareX <yecaoyc2019@gmail.com>
- **Command**: `codex-kimi`

## What it provides:
- Automatically sets `MOONSHOT_API_KEY` environment variable
- Uses `--model kimi-k2-0711-preview` by default
- Wraps the existing `codex` CLI command
- Requires users to have `codex` installed separately

## Files included in package:
- `bin/codex-kimi.js` - CLI entry point
- `npm-wrapper.js` - Main wrapper logic
- `README.md` - User documentation
- `LICENSE` - Apache 2.0 license

Ready to publish! 📦