/**

This exports a function that gets a PKCE access token from an MCP endpoint.


See the specification here: https://modelcontextprotocol.io/specification/draft/basic/authorization

This is a generic function, but is intended to be used 
with: https://mcp.atlassian.com/v1/sse


 */

import { Issuer, generators } from 'openid-client';
import express from 'express';
import open from 'open';
import fetch from 'node-fetch';
import { URL } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Default configuration
const DEFAULT_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/callback';

/**
 * Extract port from redirect URI
 * @param {string} redirectUri - The redirect URI
 * @returns {number} The port number
 */
function getPortFromRedirectUri(redirectUri) {
  try {
    const url = new URL(redirectUri);
    return url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
  } catch (error) {
    console.warn('⚠️  Could not parse redirect URI, using default port 3000:', error.message);
    return 3000;
  }
}

/**
 * Get the OAuth authorization server discovery URL from MCP endpoint
 * @param {string} mcpUrl - The MCP endpoint URL
 * @returns {Promise<string>} The authorization server discovery URL
 */
async function getAuthorizationServerDiscoveryUrl(mcpUrl) {
  // First, try to get the metadata URL from WWW-Authenticate header (RFC9728)
  try {
    const res = await fetch(mcpUrl, { method: 'GET' });
    const wwwAuth = res.headers.get('www-authenticate');
    console.log('🔍 WWW-Authenticate header:', wwwAuth);
    
    if (wwwAuth) {
      // Look for resource parameter in WWW-Authenticate header
      const resourceMatch = wwwAuth.match(/resource="([^"]+)"/);
      if (resourceMatch) {
        console.log('✅ Found resource metadata URL in WWW-Authenticate header');
        return resourceMatch[1];
      }
    }
  } catch (error) {
    console.log('⚠️  Could not get resource metadata from WWW-Authenticate header:', error.message);
  }
  
  // Fallback: Try the standard OAuth Authorization Server Metadata endpoint
  const mcpUrlObj = new URL(mcpUrl);
  const authServerMetadataUrl = `${mcpUrlObj.protocol}//${mcpUrlObj.host}/.well-known/oauth-authorization-server`;
  console.log('🔍 Trying standard OAuth Authorization Server Metadata endpoint:', authServerMetadataUrl);
  
  try {
    const res = await fetch(authServerMetadataUrl);
    if (res.ok) {
      console.log('✅ Found OAuth Authorization Server Metadata endpoint');
      return authServerMetadataUrl;
    }
  } catch (error) {
    // Continue to other fallbacks
  }
  
  // Additional fallback: Try OpenID Connect Discovery
  const oidcDiscoveryUrl = `${mcpUrlObj.protocol}//${mcpUrlObj.host}/.well-known/openid-configuration`;
  console.log('🔍 Trying OpenID Connect Discovery endpoint:', oidcDiscoveryUrl);
  
  try {
    const res = await fetch(oidcDiscoveryUrl);
    if (res.ok) {
      console.log('✅ Found OpenID Connect Discovery endpoint');
      return oidcDiscoveryUrl;
    }
  } catch (error) {
    // Continue
  }
  
  throw new Error('Could not find OAuth Authorization Server Metadata or OpenID Connect Discovery endpoint');
}

/**
 * Gets a PKCE access token from an MCP endpoint
 * @param {string} mcpUrl - The MCP endpoint URL (e.g., 'https://mcp.atlassian.com/v1/sse')
 * @param {Object} options - Configuration options
 * @param {string} [options.redirectUri] - The redirect URI for the OAuth flow
 * @param {number} [options.port] - The port for the local callback server
 * @param {string} [options.scope] - The OAuth scope to request
 * @param {boolean} [options.openBrowser] - Whether to automatically open the browser
 * @returns {Promise<Object>} Token set containing access_token, id_token, etc.
 */
export async function getPkceAccessToken(mcpUrl, options = {}) {
  const {
    redirectUri = DEFAULT_REDIRECT_URI,
    port = getPortFromRedirectUri(options.redirectUri || DEFAULT_REDIRECT_URI),
    scope = 'read:jira-work',
    openBrowser = true
  } = options;

  try {
    // Step 1: Get OAuth authorization server discovery URL
    console.log('🔍 Getting OAuth authorization server discovery URL...');
    const discoveryUrl = await getAuthorizationServerDiscoveryUrl(mcpUrl);
    console.log('✅ Discovery URL:', discoveryUrl);

    // Step 2: Discover the OAuth issuer
    console.log('🔍 Discovering OAuth issuer...');
    const issuer = await Issuer.discover(discoveryUrl);
    console.log('✅ Discovered issuer:', issuer.issuer);

    // Step 3: Dynamic client registration
    console.log('🔍 Registering OAuth client...');
    const client = await issuer.Client.register({
      client_name: 'MCP OAuth Client',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // public client
    });

    console.log('✅ Registered client:', client.client_id);

    // Step 4: PKCE generation
    const code_verifier = generators.codeVerifier();
    const code_challenge = generators.codeChallenge(code_verifier);

    // Step 5: Generate authorization URL
    const authorizationUrl = client.authorizationUrl({
      scope,
      code_challenge,
      code_challenge_method: 'S256',
      redirect_uri: redirectUri,
    });

    console.log('🌐 Authorization URL generated:', authorizationUrl);
    
    if (openBrowser) {
      console.log('🌐 Opening browser...');
      await open(authorizationUrl);
    }

    // Step 6: Handle redirect via local server
    console.log(`🚪 Starting callback server on port ${port}...`);
    
    return new Promise((resolve, reject) => {
      const app = express();

      app.get('/callback', async (req, res) => {
        try {
          const params = client.callbackParams(req);
          
          if (params.error) {
            throw new Error(`Authorization error: ${params.error} - ${params.error_description}`);
          }
          
          if (!params.code) {
            throw new Error('Authorization code not received');
          }
          
          // Manual token exchange for pure OAuth 2.0
          const tokenResponse = await fetch(issuer.token_endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json'
            },
            body: new URLSearchParams({
              grant_type: 'authorization_code',
              code: params.code,
              redirect_uri: redirectUri,
              client_id: client.client_id,
              code_verifier: code_verifier
            })
          });
          
          if (!tokenResponse.ok) {
            const errorText = await tokenResponse.text();
            throw new Error(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText} - ${errorText}`);
          }
          
          const tokenSet = await tokenResponse.json();

          console.log('\n🎉 Authentication successful!');
          console.log('✅ Access Token received');
          
          res.send(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: green;">🎉 Authentication Successful!</h1>
                <p>You may close this tab and return to your application.</p>
              </body>
            </html>
          `);

          server.close(() => {
            resolve(tokenSet);
          });
        } catch (err) {
          console.error('❌ Error handling callback:', err);
          res.status(500).send(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: red;">❌ Authentication Failed</h1>
                <p>Please try again.</p>
                <pre>${err.message}</pre>
              </body>
            </html>
          `);
          server.close(() => {
            reject(err);
          });
        }
      });

      const server = app.listen(port, () => {
        console.log(`🚪 Callback server listening at ${redirectUri}...`);
      });

      server.on('error', (err) => {
        reject(new Error(`Failed to start callback server: ${err.message}`));
      });
    });

  } catch (error) {
    console.error('💥 Error getting PKCE access token:', error);
    throw error;
  }
}

// Export as default for convenience
export default getPkceAccessToken;