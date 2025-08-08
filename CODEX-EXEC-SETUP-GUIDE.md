# Codex Exec Non-Interactive Mode - Complete Setup Guide

## Overview

This guide documents the complete setup process for running Codex in non-interactive mode using `codex-exec`, including configuration for alternative model providers like Moonshot AI (Kimi).

## Table of Contents
1. [Understanding Codex Architecture](#understanding-codex-architecture)
2. [Building Codex Exec](#building-codex-exec)
3. [Configuration](#configuration)
4. [Running Codex Exec](#running-codex-exec)
5. [Setting Up Alternative Model Providers](#setting-up-alternative-model-providers)
6. [Performance Optimization](#performance-optimization)
7. [Troubleshooting](#troubleshooting)

---

## Understanding Codex Architecture

### Repository Structure
The Codex repository contains two main components:
- **codex-cli/** - TypeScript/Node.js interactive TUI client
- **codex-rs/** - Rust implementation including the `codex-exec` binary for non-interactive mode

### Key Components of Codex Exec

1. **Entry Point** (`codex-rs/exec/src/main.rs`)
   - Handles CLI argument parsing
   - Supports dual-mode operation (can act as `codex-linux-sandbox` when invoked with that name)

2. **Core Execution Logic** (`codex-rs/exec/src/lib.rs`)
   - Manages prompt input from CLI args or stdin
   - Configures session with `approval_policy: Never` (no user interaction)
   - Supports two output modes: human-readable and JSON
   - Handles the event loop for agent communication

3. **Event Processors**
   - **Human Output** (`event_processor_with_human_output.rs`): Timestamped, colored console output
   - **JSON Output** (`event_processor_with_json_output.rs`): JSONL format for machine parsing

4. **CLI Options** (`codex-rs/exec/src/cli.rs`)
   - `--model/-m`: Model selection
   - `--oss`: Use open-source models
   - `--sandbox/-s`: Sandbox policy configuration
   - `--full-auto`: Low-friction sandboxed automatic execution
   - `--dangerously-bypass-approvals-and-sandbox`: Skip all safety checks
   - `--json`: Output events as JSON Lines
   - `--output-last-message`: Save final agent response to file
   - `--cd/-C`: Set working directory
   - Prompt as positional argument or via stdin with `-`

---

## Building Codex Exec

### Prerequisites
```bash
# Install Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"
rustup component add rustfmt clippy
```

### Build Commands

#### Debug Build (faster compilation, larger binary ~144MB)
```bash
cd /path/to/codex/codex-rs
cargo build --bin codex-exec
# Binary location: target/debug/codex-exec
```

#### Release Build (optimized, smaller binary ~11MB)
```bash
cd /path/to/codex/codex-rs
cargo build --release --bin codex-exec
# Binary location: target/release/codex-exec
```

**Note:** The release build is 13x smaller and significantly faster than the debug build.

---

## Configuration

Codex uses a TOML configuration file located at `~/.codex/config.toml`. This file controls model selection, provider configuration, and behavior settings.

### Basic Configuration Structure
```toml
# Model selection
model = "model-name"
model_provider = "provider-id"

# Sandbox configuration
[sandbox]
mode = "workspace-write"  # Options: read-only, workspace-write, danger-full-access

# Approval policy
[approval]
mode = "never"  # For non-interactive mode

# Shell environment
[shell_environment]
inherit_parent = false
allowed_vars = ["PATH", "HOME", "USER", "LANG", "LC_ALL"]
```

---

## Running Codex Exec

### Basic Usage
```bash
# Using full path
/path/to/codex-rs/target/release/codex-exec "Your prompt here"

# With stdin
echo "Your prompt" | /path/to/codex-rs/target/release/codex-exec -

# With options
/path/to/codex-rs/target/release/codex-exec \
  --model gpt-4o-mini \
  -c model_provider=openai \
  --json \
  "Your prompt"
```

### Setting Up Quick Access

#### Option 1: Create an Alias
```bash
# Add to ~/.bashrc or ~/.zshrc
echo "alias cx='/path/to/codex-rs/target/release/codex-exec'" >> ~/.bashrc
source ~/.bashrc

# Now use:
cx "Your prompt"
```

#### Option 2: Create a System-wide Symlink
```bash
sudo ln -sf /path/to/codex-rs/target/release/codex-exec /usr/local/bin/cx

# Now use from anywhere:
cx "Your prompt"
```

---

## Setting Up Alternative Model Providers

### Moonshot AI (Kimi) Configuration

One of the key discoveries is that **you don't need to modify any source code** to use alternative model providers. You only need to add configuration to `~/.codex/config.toml`.

#### Step 1: Add Provider Configuration
```toml
# ~/.codex/config.toml

# Set default model and provider
model = "kimi-k2-0711-preview"
model_provider = "moonshot"

# Define the Moonshot provider
[model_providers.moonshot]
name = "Moonshot AI (Kimi)"
base_url = "https://api.moonshot.ai/v1"
env_key = "MOONSHOT_API_KEY"
wire_api = "chat"  # Uses OpenAI-compatible chat completions API
```

#### Step 2: Set API Key
```bash
export MOONSHOT_API_KEY="your-moonshot-api-key"
```

#### Step 3: Run with Moonshot
```bash
cx "Your prompt"  # Will use Moonshot by default
```

### Other Provider Examples

#### Ollama (Local Models)
```toml
[model_providers.ollama]
name = "Ollama"
base_url = "http://localhost:11434/v1"
# No env_key needed for local Ollama
```

#### Mistral AI
```toml
[model_providers.mistral]
name = "Mistral"
base_url = "https://api.mistral.ai/v1"
env_key = "MISTRAL_API_KEY"
```

#### Azure OpenAI
```toml
[model_providers.azure]
name = "Azure"
base_url = "https://YOUR_PROJECT_NAME.openai.azure.com/openai"
env_key = "AZURE_OPENAI_API_KEY"
query_params = { api-version = "2025-04-01-preview" }
```

### Key Discovery
The provider system is **completely configuration-driven**. Any provider that implements an OpenAI-compatible API can be added without code changes. You only need:
1. A base URL for the API endpoint
2. An environment variable name for the API key
3. The wire protocol type (usually "chat" for OpenAI-compatible APIs)

---

## Performance Optimization

### Build Optimization
- **Always use release builds for production**: 13x smaller, significantly faster
- Debug build: ~144MB, unoptimized
- Release build: ~11MB, optimized

### Execution Modes

#### JSON Mode (Best for Automation)
```bash
cx --json "Your prompt" | jq '.msg.message'
```

#### Output Caching
```bash
cx --output-last-message response.txt "Your prompt"
```

### Sandbox Modes

1. **read-only**: Default, safest option
2. **workspace-write**: Allows writes to current directory
3. **danger-full-access**: No restrictions (use with caution)

```bash
# Safe mode
cx --sandbox read-only "Analyze this code"

# Allow file creation
cx --sandbox workspace-write "Create a Python script"

# Bypass all restrictions (dangerous!)
cx --dangerously-bypass-approvals-and-sandbox "System command"
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Sandbox Execution Errors
**Problem:** Commands fail with "No such file or directory" or "File name too long"
```
thread 'main' panicked at linux-sandbox/src/linux_run_main.rs:53:5:
Failed to execvp echo: No such file or directory (os error 2)
```

**Cause:** Linux sandbox (Landlock/seccomp) doesn't handle shell operations well. Commands are passed literally to execvp instead of through a shell.

**Solution:** Use `--dangerously-bypass-approvals-and-sandbox` for commands requiring shell features, or run in a containerized environment.

#### 2. Model Provider Not Found
**Problem:** Error about unknown model provider

**Solution:** Ensure the provider is defined in `~/.codex/config.toml`:
```toml
[model_providers.your-provider]
name = "Provider Name"
base_url = "https://api.example.com/v1"
env_key = "YOUR_API_KEY"
```

#### 3. API Key Issues
**Problem:** Authentication failures

**Solution:** 
- Verify environment variable is set: `echo $YOUR_API_KEY`
- Check the `env_key` field matches your environment variable name
- Ensure the API key has proper permissions

#### 4. Timeout Issues
**Problem:** Commands timeout after 10 seconds

**Solution:** Adjust timeout in the command:
```bash
cx --timeout 60000 "Long running task"  # 60 second timeout
```

---

## Testing Your Setup

### Quick Test Suite
```bash
# Test 1: Basic functionality
cx "What is 2 + 2?"

# Test 2: JSON output
cx --json "List 3 colors" | jq '.'

# Test 3: File output
cx --output-last-message test.txt "Write a haiku"
cat test.txt

# Test 4: Stdin input
echo "Explain REST API in one sentence" | cx -

# Test 5: Model override
cx --model gpt-4o-mini -c model_provider=openai "Hello"
```

### Verify Installation
```bash
# Check binary location
which cx

# Check configuration
cat ~/.codex/config.toml

# Test with verbose logging
RUST_LOG=debug cx "Test prompt"
```

---

## Key Learnings

1. **Configuration-Driven Architecture**: The entire model provider system is configuration-driven, requiring no code changes to add new providers.

2. **Sandbox Limitations**: Linux sandboxing (Landlock/seccomp) has limitations with shell operations. Complex commands may need to bypass the sandbox.

3. **Performance Matters**: Release builds are crucial for production use - 13x smaller and much faster.

4. **Flexibility**: The system supports multiple input methods (CLI args, stdin), output formats (human, JSON), and can work with any OpenAI-compatible API.

5. **Non-Interactive Design**: The `approval_policy: Never` setting is critical for automation scenarios.

---

## CI/CD Integration Example

```yaml
# GitHub Actions example
- name: Run Codex Analysis
  run: |
    # Install Codex
    curl -L https://github.com/openai/codex/releases/latest/download/codex-exec > /usr/local/bin/cx
    chmod +x /usr/local/bin/cx
    
    # Configure
    mkdir -p ~/.codex
    echo 'model = "gpt-4o-mini"' > ~/.codex/config.toml
    echo 'model_provider = "openai"' >> ~/.codex/config.toml
    
    # Run analysis
    export OPENAI_API_KEY="${{ secrets.OPENAI_KEY }}"
    cx --json --output-last-message analysis.txt "Analyze code quality"
```

---

## Summary

Codex exec provides a powerful non-interactive interface for AI-assisted automation. The key insight is that the system is highly configurable through simple TOML files, requiring no code modifications to support new model providers. With proper setup, you can use various AI models (OpenAI, Moonshot, Ollama, etc.) seamlessly for automation tasks.

The combination of a fast Rust implementation, flexible configuration system, and multiple output modes makes it suitable for everything from simple CLI usage to complex CI/CD pipelines.

---

*Document created: August 2025*
*Based on: Codex v0.0.0 (research preview)*