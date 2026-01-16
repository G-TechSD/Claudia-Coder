# Claudia Code Orchestrator Demo Workflow

This n8n workflow demonstrates the Claudia Coder orchestration pattern, allowing you to route prompts to different AI models using slash commands and leverage an orchestrator pattern with sub-agents.

## What This Workflow Does

1. **Multi-Model Routing**: Routes incoming prompts to different AI models based on slash command prefixes
2. **Orchestrator Pattern**: Demonstrates how to break complex tasks into sub-tasks using an orchestrator agent
3. **Conversation Logging**: Stores all conversations in a data table (Google Sheets) for history and analytics
4. **OpenWebUI Integration**: Designed to work seamlessly with OpenWebUI as a backend pipe

## Available Slash Commands

| Command | Model | Description |
|---------|-------|-------------|
| `/paid_claude:` | Claude Sonnet | Routes to Anthropic Claude API (paid) |
| `/paid_gpt:` | GPT-4o | Routes to OpenAI GPT-4o API (paid) |
| `/paid_gemini:` | Gemini Flash | Routes to Google Gemini API (paid) |
| `/primary_free:` | LM Studio | Routes to local LM Studio instance (free) |
| `/orchestrate:` | Claude Orchestrator | Uses orchestrator pattern to decompose tasks |
| (no prefix) | LM Studio | Default routing to local model |

### Usage Examples

```
/paid_claude: Explain quantum computing in simple terms
/paid_gpt: Write a Python function to sort a list
/paid_gemini: Summarize this article about AI
/primary_free: What is the capital of France?
/orchestrate: Build a complete REST API for a todo app
```

## Setup Instructions

### 1. Import the Workflow

1. Open your n8n instance
2. Go to **Workflows** > **Import from File**
3. Select `claudia-orchestrator-demo.json`
4. The workflow will be imported in inactive state

### 2. Configure Credentials

You need to set up the following credentials in n8n:

#### Anthropic API (for Claude)
1. Go to **Settings** > **Credentials** > **Add Credential**
2. Search for "Anthropic"
3. Enter your Anthropic API key from [console.anthropic.com](https://console.anthropic.com)
4. Name it descriptively (e.g., "Anthropic API - Production")
5. Update the credential reference in:
   - `PAID Claude Sonnet` node
   - `Orchestrator Agent` node

#### OpenAI API (for GPT)
1. Add a new "OpenAI" credential
2. Enter your OpenAI API key from [platform.openai.com](https://platform.openai.com)
3. Update the credential reference in the `PAID GPT-4o` node

#### Google Gemini API
1. Add a new "Google PaLM" credential
2. Enter your Google AI API key from [makersuite.google.com](https://makersuite.google.com)
3. Update the credential reference in the `PAID Gemini Flash` node

#### Google Sheets (for logging)
1. Add a new "Google Sheets OAuth2" credential
2. Follow the OAuth flow to authorize access
3. Create a Google Sheet with a "Conversations" tab
4. Update the `Log to Data Table` node with your Sheet ID

### 3. Configure LM Studio (Local Model)

1. Install [LM Studio](https://lmstudio.ai/)
2. Download a model (e.g., Llama 3, Mistral, Phi-3)
3. Start the local server on port 1234 (default)
4. The workflow is pre-configured to connect to `http://localhost:1234/v1`

### 4. Activate the Workflow

1. Review all nodes have valid credentials
2. Click the **Active** toggle to enable the workflow
3. Copy the webhook URL for integration

## OpenWebUI Integration

### Setting Up as a Pipe

1. In OpenWebUI, go to **Admin** > **Functions** > **Pipes**
2. Create a new pipe with the webhook URL from this workflow
3. Configure the pipe to forward requests to n8n

### Example Pipe Configuration

```python
class Pipeline:
    def __init__(self):
        self.n8n_webhook = "https://your-n8n-instance.com/webhook/claudia-orchestrator"

    def pipe(self, body):
        import requests
        response = requests.post(self.n8n_webhook, json=body)
        return response.json()["response"]
```

## Workflow Architecture

```
                                    +------------------+
                                    | Claude Chain     |--+
                                    +------------------+  |
                                                          |
+----------+    +-----------------+  +------------------+ |  +-----------+    +----------+
| Webhook  |--->| Route by        |->| GPT Chain        |-+->| Log to    |--->| Send     |
| Trigger  |    | Command         |  +------------------+ |  | Data Table|    | Response |
+----------+    +-----------------+  +------------------+ |  +-----------+    +----------+
                                    | Gemini Chain     |--+
                                    +------------------+  |
                                    +------------------+  |
                                    | Local LLM Chain  |--+
                                    +------------------+  |
                                    +------------------+  |
                                    | Orchestrator     |--+
                                    +------------------+
```

## Orchestrator Pattern Details

When using `/orchestrate:`, the workflow:

1. Receives the complex task
2. The Orchestrator Agent breaks it into sub-tasks
3. Each sub-task is assigned to a specialized "sub-agent" type:
   - **Researcher**: Gathers information
   - **Coder**: Writes code
   - **Reviewer**: Reviews and improves
   - **Tester**: Validates functionality
4. Results are synthesized into a coherent response

### Orchestrator System Prompt

The orchestrator uses a specialized system prompt:
> "You are an orchestrator AI. Your job is to break down complex tasks into sub-tasks and coordinate their execution. Think step by step and delegate work to specialized sub-agents."

## Data Table Schema

The Google Sheet logs conversations with these columns:

| Column | Description |
|--------|-------------|
| timestamp | ISO timestamp of the request |
| model_used | Which model/route was used |
| prompt | The original user prompt |
| response | The AI response |
| user_id | User identifier (if provided) |

## Troubleshooting

### Common Issues

1. **Webhook not responding**: Ensure the workflow is active and credentials are valid
2. **Local model not connecting**: Check LM Studio is running on port 1234
3. **Credential errors**: Verify API keys are correct and have sufficient quota
4. **Logging failures**: Ensure Google Sheets credential has write access

### Testing the Workflow

1. Use n8n's built-in test webhook feature
2. Send a test POST request:
```bash
curl -X POST https://your-n8n-instance.com/webhook/claudia-orchestrator \
  -H "Content-Type: application/json" \
  -d '{"prompt": "/paid_claude: Hello, world!"}'
```

## Customization

### Adding New Models

1. Add a new LLM Chat node for your model
2. Add a new Chain node
3. Update the Switch node with a new routing rule
4. Connect the chain to the logging and response nodes

### Modifying Commands

Edit the `Route by Command` switch node to change prefix patterns or add new commands.

## Support

For issues with this workflow:
- Visit [claudiacoder.com](https://claudiacoder.com)
- Check the Claudia Coder documentation
- Open an issue on the project repository

---

*This workflow is part of the Claudia Coder platform by G-Tech SD.*
