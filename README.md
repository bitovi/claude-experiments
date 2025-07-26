# Claude Experiments

This project demonstrates how to integrate Claude with Jira using the Model Context Protocol (MCP) and the sooperset/mcp-atlassian Docker image. Claude can create, query, and manage Jira issues through natural language interactions.

## Prerequisites

Before setting up this project, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) (for running the MCP server)
- [Node.js](https://nodejs.org/) (v16 or higher)
- [ngrok](https://ngrok.com/download) (for creating HTTPS tunnels)
- A valid Jira Cloud instance with API access
- An Anthropic API key for Claude

## Quick Start

### 1. Clone and Setup Project

```bash
# Clone or download this project
cd claude-experiments

# Install dependencies
npm i
```

### 2. Create Environment Configuration

Copy the example environment file and fill in your details. More information below on how to get the values.

```bash
cp .env.example .env
```

Edit the `.env` file with your actual values:

```env
# Anthropic API Key for Claude
ANTHROPIC_API_KEY=sk-ant-api03-your_key_here

# Jira Configuration
JIRA_URL=https://your-company.atlassian.net
JIRA_USERNAME=your.email@company.com
JIRA_API_TOKEN=your_jira_api_token

# MCP Server Configuration
MCP_JIRA_ENDPOINT=https://your-ngrok-url.ngrok-free.app/mcp/
MCP_VERBOSE=true
MCP_LOGGING_STDOUT=true
```

#### Getting Your Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a label (e.g., "Claude MCP Integration")
4. Copy the generated token to your `.env` file

#### Getting Your Anthropic API Key

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Navigate to API Keys
3. Create a new API key
4. Copy it to your `.env` file

### 3. Test Claude

Before setting up the MCP integration, let's verify that your basic Claude connection works:

```bash
node example-simple.js
```

If your API key is correctly configured, you should see Claude respond with information about what it can help you with.

### 4. Start the MCP Server

Run the Docker container with the MCP Atlassian server:

```bash
docker run --rm -p 9000:9000 \
  --env-file .env \
  ghcr.io/sooperset/mcp-atlassian \
  --transport streamable-http --port 9000
```

You should see logs indicating the server is starting and connecting to Jira.

### 5. Create HTTPS Tunnel

**Important**: The Anthropic API requires HTTPS URLs for MCP servers. One way to do that is use ngrok.

```bash
ngrok http 9000
```

Note the HTTPS URL from the ngrok output (e.g., `https://abc123.ngrok-free.app`).

### 6. Update Environment Variable

Update your `.env` file with the ngrok HTTPS URL:

```env
MCP_JIRA_ENDPOINT=https://abc123.ngrok-free.app/mcp/
```

### 7. Run the Jira Integration

Test the integration with the example script:

```bash
node example-jira-mcp.js
```

If everything is configured correctly, Claude will create a test Jira issue and you'll see the full response including tool usage.

## Quick Start with Copilot

After doing steps 1 and 2, prompt copilot with:

> Can you perform the steps in the README.md starting with:
> 
> 3. Test Claude
>
> and ending with:
>
> 7. Run the Jira Integration
> ? 


## Project Structure

- `example-simple.js` - Simple Claude test script to verify API connection
- `example-jira-mcp.js` - Main Jira integration script that creates a test Jira issue
- `.env` - Environment configuration (create from `.env.example`)
- `.env.example` - Template for environment variables
- .claude.json - Example claude configuration json




## How It Works

1. **MCP Server**: The sooperset/mcp-atlassian Docker image runs a Model Context Protocol server that provides tools for interacting with Jira
2. **HTTPS Tunnel**: ngrok creates a secure tunnel to make the local MCP server accessible via HTTPS
3. **Claude Integration**: The Anthropic SDK connects Claude to the MCP server, allowing Claude to use Jira tools
4. **Natural Language**: You can ask Claude to create issues, search for tickets, update status, etc. in plain English

## Available Tools

The MCP Atlassian server provides various tools for Jira interaction:

- **Create Issues**: Create new Jira tickets with summaries, descriptions, and issue types
- **Search Issues**: Find issues using JQL (Jira Query Language)
- **Update Issues**: Modify existing issues (status, assignee, etc.)
- **Get Issue Details**: Retrieve full information about specific issues
- And more...

## Troubleshooting

### Common Issues

1. **"MCP_JIRA_ENDPOINT not found"**
   - Ensure your `.env` file contains the `MCP_JIRA_ENDPOINT` variable
   - Make sure you're using the HTTPS URL from ngrok, not HTTP

2. **"Failed to connect to MCP server"**
   - Check that the Docker container is running
   - Verify ngrok is forwarding to port 9000
   - Test the endpoint: `curl -I https://your-ngrok-url.ngrok-free.app/mcp/`

3. **Jira authentication errors**
   - Verify your Jira credentials in the `.env` file
   - Check that your API token is valid and has proper permissions
   - Ensure JIRA_URL includes the full domain (https://company.atlassian.net)

### Debugging Commands

Check if the MCP server is accessible:
```bash
curl -I https://your-ngrok-url.ngrok-free.app/mcp/
```

View Docker container logs:
```bash
docker logs $(docker ps -q --filter ancestor=ghcr.io/sooperset/mcp-atlassian)
```

Check environment variables in the container:
```bash
docker exec $(docker ps -q --filter ancestor=ghcr.io/sooperset/mcp-atlassian) env | grep JIRA
```

## Success Indicators

When everything is working correctly, you should see:

- Docker logs: "Using Jira Cloud Basic Authentication (API Token)"
- Docker logs: "Processing request of type CallToolRequest"
- Claude successfully creates Jira issues and provides detailed responses
- The Node.js script shows both tool usage and results in the output

## Further Development

You can extend this integration by:

- Adding more sophisticated Jira workflows
- Integrating with Confluence (also supported by mcp-atlassian)
- Creating custom prompts for specific use cases
- Building a web interface around the integration
- Adding error handling and retry logic

## References

- [Anthropic MCP Documentation](https://docs.anthropic.com/en/docs/build-with-claude/tool-use)
- [MCP Atlassian GitHub Repository](https://github.com/sooperset/mcp-atlassian)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
