#!/usr/bin/env node

/**
 * Example usage of the getPkceAccessToken function
 * 
 * Usage: node example-get-token.js <mcp-url>
 * Example: node example-get-token.js https://mcp.atlassian.com/v1/sse
 */

import { getPkceAccessToken } from './get-pkce-token.js';

async function main() {
  const mcpUrl = process.argv[2];
  
  if (!mcpUrl) {
    console.error('❗ Please provide the MCP endpoint URL');
    console.error('Usage: node example-get-token.js <mcp-url>');
    console.error('Example: node example-get-token.js https://mcp.atlassian.com/v1/sse');
    process.exit(1);
  }

  try {
    console.log(`🚀 Starting PKCE OAuth flow for: ${mcpUrl}`);
    
    const tokenSet = await getPkceAccessToken(mcpUrl, {
      scope: 'read:jira-work',
      openBrowser: true
    });
    
    console.log('\n🎉 Success! Token details:');
    console.log('📄 Access Token:', tokenSet.access_token ? '✅ Received' : '❌ Missing');
    console.log('🪪 ID Token:', tokenSet.id_token ? '✅ Received' : '❌ Missing');
    console.log('⏰ Expires in:', tokenSet.expires_in ? `${tokenSet.expires_in} seconds` : 'Unknown');
    
    // You can now use the access token to make authenticated requests to the MCP endpoint
    console.log('\n💡 You can now use the access token to authenticate with the MCP endpoint.');
    
  } catch (error) {
    console.error('💥 Failed to get access token:', error.message);
    process.exit(1);
  }
}

main().catch(console.error);
