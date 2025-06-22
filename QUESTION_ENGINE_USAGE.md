# Question Engine Usage Guide

The Question Engine is an experimental feature that enables Codex to autonomously explore your system and generate its own research questions.

## Quick Start

1. **Create an exploration policy** (required for safety):
   ```bash
   cp example-exploration-policy.yaml ~/.codex/exploration-policy.yaml
   ```

2. **Edit the policy** to enable exploration and set boundaries:
   ```yaml
   exploration:
     enabled: true  # Must be explicitly enabled
     allowed_paths:
       - "~/Downloads"  # Add paths you want to explore
   ```

3. **Run exploration with a prompt**:
   ```bash
   codex --explore "explore my Downloads folder and tell me what you learn about me"
   ```

## How It Works

Instead of executing specific tasks, the Question Engine:
1. Interprets your prompt to understand what to explore
2. Generates its own questions about what to investigate
3. Explores within the boundaries you've set
4. Synthesizes observations from what it discovers
5. Continues generating new questions based on findings

## Example Prompts

```bash
# Explore a specific folder
codex --explore "explore my Downloads folder"

# Learn about your development environment
codex --explore "discover what programming languages I use"

# General system exploration
codex --explore "learn about how I organize my files"
```

## Privacy & Safety

- **No file contents are read** - only metadata and filenames
- **Sensitive patterns are automatically redacted** (emails, phone numbers, etc.)
- **Explicit boundaries** - only explores paths you allow
- **Complete audit trail** - all actions are logged
- **Local only** - no data is sent externally

## Customizing Exploration

Edit `~/.codex/exploration-policy.yaml` to:
- Add or remove allowed paths
- Exclude sensitive directories
- Set time and resource limits
- Configure privacy patterns
- Control observation types

## Viewing Results

The exploration will show:
- Questions being investigated
- Findings with confidence levels
- Synthesized observations about patterns
- Complete summary at the end

This feature represents a new paradigm where AI agents generate their own research questions rather than just answering yours.