# Codex Kimi HardwareX

A complete standalone Codex CLI with Kimi K2 model integration. No external dependencies required - just install and use!

## Quick Start

1. **Install the package:**

```bash
npm install -g codex-kimi-hardwarex
```

2. **Get your API key:**
   - Visit [https://platform.moonshot.cn](https://platform.moonshot.cn)
   - Create an account if you don't have one
   - Generate your API key from the dashboard

3. **Set your API key:**

```bash
export MOONSHOT_API_KEY="sk-your-actual-api-key-here"
```

4. **Start using it:**

```bash
codex-kimi
```

## Features

- ✅ **Complete standalone package** - No external dependencies needed
- ✅ **Automatic Kimi K2 configuration** - Pre-configured with `--provider moonshot --model kimi-k2-0711-preview`
- ✅ **Node.js compatibility** - Works with Node.js v18+ (bypasses v22 requirement)
- ✅ **16MB complete bundle** - Includes entire codex-cli with all dependencies

## Usage

### Basic usage:
```bash
codex-kimi
```

### With custom API key:
```bash
MOONSHOT_API_KEY="your-key" codex-kimi
```

### With additional arguments:
```bash
codex-kimi --help
codex-kimi "Write a hello world program"
```

## Configuration

The package automatically configures:
- `--provider moonshot` 
- `--model kimi-k2-0711-preview`
- Uses your `MOONSHOT_API_KEY` environment variable

## Requirements

- Node.js 18.0.0 or higher
- Valid Moonshot AI API key from https://platform.moonshot.cn

## Troubleshooting

### API Key Issues
If you see "Invalid Authentication" errors:
1. **Verify your API key is valid:**
   - Login to https://platform.moonshot.cn
   - Check your API key in the dashboard
   - Make sure it hasn't expired
2. **Check your environment variable:**
   ```bash
   echo $MOONSHOT_API_KEY  # Should show your key
   ```
3. **Re-export if needed:**
   ```bash
   export MOONSHOT_API_KEY="sk-your-actual-key"
   ```

### Installation Issues
If you get permission errors during installation:
```bash
sudo npm install -g codex-kimi-hardwarex
```

## License

Apache-2.0

## Author

HardwareX <yecaoyc2019@gmail.com>