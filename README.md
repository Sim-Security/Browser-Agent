# SentinelBrowser

AI-powered browser automation agent with self-healing capabilities. Built with TypeScript, Bun, LangGraph.js, and Playwright.

## Features

- **Natural Language Tasks**: Describe what you want to do in plain English
- **Self-Healing**: Automatically recovers from element detection failures using vision AI
- **LangGraph Orchestration**: Robust state machine workflow management
- **Built-in Evaluation**: Measure agent reliability with pass@k metrics

## Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/sentinel-browser.git
cd sentinel-browser

# Install dependencies
bun install

# Install Playwright browsers
bunx playwright install chromium
```

## Configuration

SentinelBrowser supports multiple LLM providers via OpenRouter (default) or Anthropic directly.

### OpenRouter (Recommended - Cost Effective)

```bash
export OPENROUTER_API_KEY=your-openrouter-key
```

**Supported models:**
- `x-ai/grok-4.1-fast` (default) - Fast, vision-capable
- `google/gemini-3-flash-preview` - Fast, good vision
- `anthropic/claude-sonnet-4` - High quality

### Anthropic Direct

```bash
export ANTHROPIC_API_KEY=your-anthropic-key
```

## Usage

### Run a Task

```bash
# Simple navigation (uses OpenRouter + Grok by default)
bun run dev run "Go to example.com and tell me the page title"

# Use Gemini 3 Flash
bun run dev run --model google/gemini-3-flash-preview "Search for 'TypeScript' on DuckDuckGo"

# Use Anthropic directly
bun run dev run -p anthropic --model claude-sonnet-4-20250514 "Go to github.com"

# With visible browser
bun run dev run --no-headless "Go to news.ycombinator.com and extract the top 3 headlines"

# Output as JSON
bun run dev run -o json "Go to github.com and extract the trending repositories"
```

### Run Evaluation

```bash
# Run default evaluation suite
bun run dev eval

# Custom evaluation with more runs
bun run dev eval --runs 10 --k 1,3,5,10

# Output markdown report
bun run dev eval --format markdown --output eval-report.md
```

## CLI Options

### `sentinel run <task>`

| Option | Description | Default |
|--------|-------------|---------|
| `-H, --headless` | Run browser in headless mode | `true` |
| `--no-headless` | Show browser UI | - |
| `-r, --retries <n>` | Max self-healing retries | `3` |
| `-t, --timeout <ms>` | Action timeout | `30000` |
| `-p, --provider` | LLM provider (openrouter/anthropic) | `openrouter` |
| `--model <model>` | LLM model to use | `x-ai/grok-4.1-fast` |
| `-o, --output <fmt>` | Output format (json/text) | `text` |

### `sentinel eval`

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --suite <path>` | Path to eval suite JSON | Built-in |
| `-k, --k <values>` | K values for pass@k | `1,3,5` |
| `-r, --runs <n>` | Runs per scenario | `5` |
| `-o, --output <path>` | Output file path | stdout |
| `--format <fmt>` | Report format (json/md) | `markdown` |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SentinelBrowser                         │
├─────────────────────────────────────────────────────────────┤
│  CLI → Task Planner → LangGraph State Machine → Browser     │
│                            ↓                                 │
│                    Self-Healing Layer                        │
│                   (Vision LLM + Retry)                       │
└─────────────────────────────────────────────────────────────┘
```

### Components

- **Task Planner**: Converts natural language to action sequences
- **LangGraph State Machine**: Orchestrates action execution
- **Action Nodes**: Navigate, Click, Fill, Extract
- **Self-Healing**: Vision-based element re-detection on failure
- **Evaluation Framework**: pass@k metrics and scenario testing

## Self-Healing Flow

When an action fails:

1. Capture screenshot of current page
2. Send to vision LLM with element description
3. LLM identifies alternative selector
4. Retry action with new selector
5. If still failing, try scroll/wait strategies
6. Repeat up to `maxRetries` times

## Evaluation Metrics

- **pass@1**: Success rate on first attempt
- **pass@3**: Success if any of first 3 attempts succeed
- **pass@5**: Success if any of first 5 attempts succeed

Target metrics:
- pass@1 > 75%
- pass@3 > 90%

## Development

```bash
# Run in development mode
bun run dev run "your task"

# Type check
bun run lint

# Run tests
bun test
```

## License

MIT
