# codex-kimi-cli

A simple npm wrapper for the Codex CLI with automatic Kimi K2 model support.

## Installation

```bash
npm install -g codex-kimi-cli
```

## Prerequisites

This package requires the `codex` CLI to be installed separately. You can install it from:
- https://github.com/anthropics/claude-code

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
- The `codex` CLI installed and available in your PATH

## License

Apache-2.0