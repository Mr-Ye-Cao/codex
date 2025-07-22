# Kimi Model Integration with Codex Agentic Infrastructure

This document describes how we integrated the Kimi model (Moonshot AI) with the Codex agentic infrastructure.

## Overview

We successfully integrated Kimi's language models (moonshot-v1-auto, kimi-chat-pro, and kimi-k2-0711-preview) into the Codex agentic infrastructure, enabling it to execute tasks using Moonshot AI's API.

## Integration Steps

### 1. TypeScript/JavaScript Configuration

We added Kimi support to the TypeScript side of Codex by modifying two key files:

#### Added Moonshot Provider (`codex-cli/src/utils/providers.ts`)
```typescript
moonshot: {
  name: "Moonshot AI",
  baseURL: "https://api.moonshot.cn/v1",
  envKey: "MOONSHOT_API_KEY",
},
```

#### Added Kimi Models (`codex-cli/src/utils/model-info.ts`)
```typescript
"kimi-chat-pro": {
  label: "Kimi Chat Pro",
  maxContextLength: 128000,
},
"moonshot-v1-auto": {
  label: "Moonshot v1 Auto",
  maxContextLength: 128000,
},
"kimi-k2-0711-preview": {
  label: "Kimi K2 Preview",
  maxContextLength: 128000,
},
```

### 2. Rust Configuration

The Rust side configuration is handled through the `~/.codex/config.toml` file:

```toml
# Default model configuration
model = "kimi-k2-0711-preview"  # Can also use "moonshot-v1-auto" or "kimi-chat-pro"
model_provider = "moonshot"

# Kimi-K2 Model Provider Configuration
[model_providers.moonshot]
name = "Moonshot AI (Kimi-K2)"
base_url = "https://api.moonshot.ai/v1"
env_key = "MOONSHOT_API_KEY"
env_key_instructions = "Get an API key from https://platform.moonshot.ai and export it as MOONSHOT_API_KEY"
wire_api = "chat"  # Kimi-K2 uses OpenAI-compatible chat completions API

# History configuration (required)
[history]
enabled = true
location = "~/.codex/history.jsonl"
persistence = "save-all"
```

### 3. Building the Changes

After modifying the TypeScript files, we built the changes:
```bash
cd codex-cli
npm run build
```

## How to Use Kimi with Codex

### Prerequisites
1. Obtain a Moonshot AI API key from https://platform.moonshot.ai
2. Export the API key: `export MOONSHOT_API_KEY="your-api-key"`

### Running Kimi

There are several ways to use Kimi with Codex:

1. **Using exec command (non-interactive)**:
   ```bash
   MOONSHOT_API_KEY="your-key" codex exec "Your prompt here"
   ```

2. **With the API key already exported**:
   ```bash
   export MOONSHOT_API_KEY="your-key"
   codex exec "Your prompt here"
   ```

3. **Specifying a different model**:
   ```bash
   codex exec --model kimi-k2-0711-preview "Your prompt here"
   codex exec --model moonshot-v1-auto "Your prompt here"
   codex exec --model kimi-chat-pro "Your prompt here"
   ```

### Example Usage

We tested the integration by asking Kimi to count files:
```bash
codex exec "Count ONLY regular files (not directories) in the current directory"
```

## Key Findings

1. **Model Names**: The working model names are:
   - `kimi-k2-0711-preview` (Latest Kimi K2 model, recommended)
   - `moonshot-v1-auto` (Auto-selects best available model)
   - `kimi-chat-pro` (Specific model, but may require permissions)

2. **Provider Specification**: Unlike some expectations, Codex doesn't parse "provider:model" syntax. Instead:
   - Provider is set via `model_provider` in config or defaults
   - Model is set via `model` in config or `--model` flag

3. **Wire API**: Kimi uses the "chat" wire API (OpenAI-compatible chat completions)

4. **Context Window**: Both models support 128,000 token context windows

## Troubleshooting

1. **404 Model Not Found**: Use `kimi-k2-0711-preview` or `moonshot-v1-auto` instead of `kimi-chat-pro` if you get permission errors

2. **Missing persistence field**: Ensure your config.toml has:
   ```toml
   [history]
   persistence = "save-all"  # or "none"
   ```

3. **API Key Issues**: 
   - Verify the key is exported: `echo $MOONSHOT_API_KEY`
   - Check key validity at https://platform.moonshot.ai

## Direct API Usage (JavaScript/Node.js)

You can also use the Kimi K2 model directly with the OpenAI SDK:

```javascript
const OpenAI = require("openai")
 
const client = new OpenAI({
    apiKey: process.env.MOONSHOT_API_KEY,
    baseURL: "https://api.moonshot.ai/v1",
})
 
async function main(){
    const completion = await client.chat.completions.create({
        model: "kimi-k2-0711-preview",
        messages: [
            {"role": "system", "content": "You are Kimi, an AI assistant provided by Moonshot AI."},
            {"role": "user", "content": "Hello!"}
        ],
        temperature: 0.6,
    })
     
    console.log(completion.choices[0].message.content)
}
 
main()
```

## Architecture Notes

The integration leverages Codex's existing model provider system:
- **TypeScript Side**: Defines providers and model metadata
- **Rust Side**: Handles the actual API calls and sandboxing
- **Configuration**: TOML-based config allows runtime provider definitions
- **Security**: API keys are handled via environment variables, never stored in configs

## Future Improvements

1. Add support for "provider:model" syntax parsing in the CLI
2. Implement Kimi-specific tool calling format handling
3. Add more Moonshot AI models as they become available