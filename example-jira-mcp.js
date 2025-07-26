/**
The following command runs the MCP server for Jira integration.

```
docker run --rm -p 9000:9000 \
  --env-file .env \
  ghcr.io/sooperset/mcp-atlassian \
  --transport streamable-http --port 9000

```

Run this script with `node example-jira-mcp.js` after starting the MCP server.

Please see: https://github.com/anthropics/anthropic-sdk-typescript 
And https://github.com/sooperset/mcp-atlassian

Remember that the MCP server endpoint will be available at /mcp/ for streamable-http transport.

 */


// claude-jira-mcp.js
import { Anthropic } from "@anthropic-ai/sdk";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if API key is available
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in environment variables.');
  console.error('Please check your .env file and ensure ANTHROPIC_API_KEY is set.');
  process.exit(1);
}

// Check if MCP endpoint is configured
if (!process.env.MCP_JIRA_ENDPOINT) {
  console.error('❌ Error: MCP_JIRA_ENDPOINT not found in environment variables.');
  console.error('Please check your .env file and ensure MCP_JIRA_ENDPOINT is set.');
  console.error('Example: MCP_JIRA_ENDPOINT=https://your-ngrok-url.ngrok-free.app/mcp/');
  process.exit(1);
}

// Instantiate the SDK client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  // Use the beta.messages API for MCP support
  const response = await anthropic.beta.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: "You can use Jira tools to create or query issues.",
    messages: [
      {
        role: "user",
        content: "Please create a new Jira issue in the FE project with summary 'Test MCP Integration' and description 'This is a test issue created via the MCP integration to verify it works properly.' Use issue type 'Task' if available.",
      },
    ],
    mcp_servers: [
      {
        type: "url",
        url: process.env.MCP_JIRA_ENDPOINT,
        name: "jira-mcp",
        authorization_token: null, // Optional for local server with no auth
        tool_configuration: {
          enabled: true,
          // removed allowed_tools to allow all tools
        },
      },
    ],
  }, {
    headers: {
      "anthropic-beta": "mcp-client-2025-04-04", // REQUIRED for MCP tool use
    },
  });

  console.log("Claude's response:");
  console.log("=".repeat(50));
  
  // Log the full response structure to see all content blocks
  console.log("Full response content:");
  console.log(JSON.stringify(response.content, null, 2));
  
  console.log("\n" + "=".repeat(50));
  console.log("Text content only:");
  response.content.forEach((block, index) => {
    if (block.type === 'text') {
      console.log(`Block ${index}: ${block.text}`);
    } else if (block.type === 'mcp_tool_use') {
      console.log(`Block ${index}: MCP Tool Use - ${block.name}`);
      console.log(`  Server: ${block.server_name}`);
      console.log(`  Input: ${JSON.stringify(block.input, null, 2)}`);
    } else if (block.type === 'mcp_tool_result') {
      console.log(`Block ${index}: MCP Tool Result`);
      console.log(`  Tool Use ID: ${block.tool_use_id}`);
      console.log(`  Is Error: ${block.is_error}`);
      console.log(`  Content: ${JSON.stringify(block.content, null, 2)}`);
    } else {
      console.log(`Block ${index}: ${block.type}`);
      console.log(JSON.stringify(block, null, 2));
    }
  });
}

main().catch(console.error);