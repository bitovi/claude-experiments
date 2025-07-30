/**
The following commands run the Git MCP server that supports cloning repositories.

SETUP INSTRUCTIONS:

1. Start the Git MCP server with HTTP transport:
```
MCP_TRANSPORT_TYPE=http MCP_HTTP_PORT=9000 npx @cyanheads/git-mcp-server
```

2. In another terminal, create an HTTPS tunnel (required for Anthropic):
```
ngrok http 9000
```

3. Update your .env file with the ngrok HTTPS URL:
```
MCP_GIT_ENDPOINT=https://your-ngrok-url.ngrok-free.app/mcp
```

4. Run this script:
```
node example-git-mcp.js
```

AUTHENTICATION:
- The Git MCP server automatically uses your system's Git credentials
- Make sure you have GitHub access configured (SSH keys or credential helper)
- Private repositories will work if you have proper GitHub authentication set up

This Git MCP server supports comprehensive Git operations including:
- git_clone: Clone remote repositories ✅
- git_status, git_add, git_commit: Basic workflow
- git_push, git_pull, git_fetch: Remote operations  
- git_branch, git_checkout, git_merge: Branching
- git_log, git_diff, git_show: History and inspection
- And many more advanced Git operations

Run this script with `node example-git-mcp.js` after starting the MCP server.

Please see: https://github.com/anthropics/anthropic-sdk-typescript 
And https://github.com/cyanheads/git-mcp-server

For HTTP transport, the server endpoint will be available at http://localhost:9000/

 */

// claude-git-mcp.js
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
if (!process.env.MCP_GIT_ENDPOINT) {
  console.error('❌ Error: MCP_GIT_ENDPOINT not found in environment variables.');
  console.error('Please check your .env file and ensure MCP_GIT_ENDPOINT is set.');
  console.error('Example: MCP_GIT_ENDPOINT=http://localhost:9000/ (for HTTP transport)');
  console.error('Or use stdio transport if connecting directly to the MCP server process');
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
    system: "You can use Git tools to perform comprehensive repository operations including cloning, committing, branching, and remote operations. You have access to the full git_clone tool to clone repositories directly.",
    messages: [
      {
        role: "user",
        content: "Please clone the repository https://github.com/bitovi/bitovi-jira-redirect to a local directory called 'hello-world-clone'. After cloning, check the status of the repository, list the files in it, and show me the commit history.",
      },
    ],
    mcp_servers: [
      {
        type: "url", 
        url: process.env.MCP_GIT_ENDPOINT,
        name: "git-mcp",
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
