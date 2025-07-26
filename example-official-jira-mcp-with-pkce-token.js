/**
 * This script demonstrates how to use the Anthropic SDK to create a Jira issue.
 * Where `example-jira-mcp.js` uses a 3rd party MCP server,
 * this script uses a provided authorization token to connect directly to 
 * Jira's MCP server at https://mcp.atlassian.com/v1/sse.
 *
 * This will prove that if we are able to get an auth token from `get-pkce-token.js`,
 * Anthropic will be able use the auth token to create a Jira issue.
 */

import { Anthropic } from "@anthropic-ai/sdk";
import { getPkceAccessToken } from './get-pkce-token.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Check if API key is available
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in environment variables.');
  console.error('Please check your .env file and ensure ANTHROPIC_API_KEY is set.');
  process.exit(1);
}

// Instantiate the SDK client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    // Step 1: Get PKCE access token from the official Jira MCP server
    console.log('🔐 Getting PKCE access token for Jira MCP server...');
    const tokenSet = await getPkceAccessToken('https://mcp.atlassian.com/v1/sse', {
      scope: 'read:jira-work write:jira-work',
      openBrowser: true
    });
    
    console.log('✅ Successfully obtained access token!');
    console.log(`⏰ Token expires in: ${tokenSet.expires_in} seconds\n`);

    // Step 2: Use the access token to authenticate with Claude's MCP client
    console.log('🤖 Using Claude to create a Jira issue via official MCP server...');
    
    const response = await anthropic.beta.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: "You can use Jira tools to create or query issues. You are authenticated with the official Atlassian Jira MCP server.",
      messages: [
        {
          role: "user",
          content: "Please create a new Jira issue with summary 'Test Official MCP Integration with PKCE' and description 'This is a test issue created via the official Atlassian MCP server using PKCE authentication to verify the integration works properly.' Use issue type 'Task' if available. If you need to specify a project, please list the available projects first.",
        },
      ],
      mcp_servers: [
        {
          type: "url",
          url: "https://mcp.atlassian.com/v1/sse",
          name: "official-jira-mcp",
          authorization_token: tokenSet.access_token, // Use the PKCE access token
          tool_configuration: {
            enabled: true,
            // Allow all tools - let Claude discover and use available Jira tools
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
    console.log("Detailed response breakdown:");
    response.content.forEach((block, index) => {
      if (block.type === 'text') {
        console.log(`Block ${index}: Text Content`);
        console.log(`  ${block.text}`);
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

    console.log("\n✅ Successfully demonstrated PKCE authentication with official Jira MCP server!");
    
  } catch (error) {
    console.error('💥 Error:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);