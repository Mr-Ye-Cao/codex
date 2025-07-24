# codex-kimi-hardwarex

A complete standalone Codex CLI with automatic Kimi K2 model integration. No external dependencies needed!

## Installation

```bash
npm install -g codex-kimi-hardwarex
```

## No Prerequisites Required!

This package includes everything you need - no need to install the `codex` CLI separately. It's a complete standalone solution.

## Usage

After installation, use the `codex-kimi` command:

```bash
codex-kimi
```

This automatically:
- Sets the `MOONSHOT_API_KEY` environment variable (if not already set)
- Runs codex with the `--model kimi-k2-0711-preview` flag
- Passes through any additional arguments you provide

## Examples

```bash
# Basic usage
codex-kimi

# Ask a question
codex-kimi "Help me debug this Python code"

# Pass additional codex flags
codex-kimi --verbose "What does this code do?"

# Use with your own API key
MOONSHOT_API_KEY="your-key-here" codex-kimi
```

## Environment Variables

- `MOONSHOT_API_KEY`: Your Moonshot AI API key (defaults to the provided key if not set)

## What it does

This package essentially runs:
```bash
MOONSHOT_API_KEY="sk-4VjKuOMtb0WGhx3vY5Mm0Sw6YJLKviuTFtm2tgRQzyERJhZE" codex --model kimi-k2-0711-preview [your-arguments]
```

## Requirements

- Node.js 22 or higher
- That's it! Everything else is bundled.

## License

Apache-2.0