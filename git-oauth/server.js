/**
 * OAuth-enabled Git MCP Service
 * Allows users to easily authorize GitHub access via OAuth
 */

import express from 'express';
import { Anthropic } from "@anthropic-ai/sdk";
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback';
const SERVICE_URL = process.env.SERVICE_URL || 'http://localhost:3000';

// In-memory store (use Redis/DB in production)
const userTokens = new Map();
const userSessions = new Map();

class GitOAuthService {
  
  /**
   * Step 1: Generate OAuth authorization URL
   */
  generateAuthUrl(userId, scopes = ['repo']) {
    const state = this.generateSecureState(userId);
    const scopeString = scopes.join(',');
    
    const authUrl = new URL('https://github.com/login/oauth/authorize');
    authUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', scopeString);
    authUrl.searchParams.append('state', state);
    authUrl.searchParams.append('allow_signup', 'false');
    
    return {
      authUrl: authUrl.toString(),
      state
    };
  }

  /**
   * Step 2: Exchange code for access token
   */
  async exchangeCodeForToken(code, state) {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`OAuth error: ${data.error_description}`);
    }

    return {
      access_token: data.access_token,
      scope: data.scope,
      token_type: data.token_type
    };
  }

  /**
   * Step 3: Configure Git credentials with the token
   */
  async configureGitCredentials(userId, accessToken) {
    // Store token securely
    userTokens.set(userId, {
      token: accessToken,
      timestamp: Date.now(),
      provider: 'github'
    });

    // Configure git credential helper for this user's session
    const credentialEntry = `https://${accessToken}@github.com`;
    
    // Create user-specific git credentials file
    const userCredFile = path.join('/tmp', `git-credentials-${userId}`);
    fs.writeFileSync(userCredFile, credentialEntry + '\n');
    
    // Set git config for this user session
    const gitConfig = {
      'credential.helper': `store --file=${userCredFile}`,
      'user.name': 'OAuth User',
      'user.email': 'oauth@your-service.com'
    };

    return { configured: true, credentialFile: userCredFile };
  }

  /**
   * Get user's GitHub info
   */
  async getUserInfo(accessToken) {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return await response.json();
  }

  /**
   * Generate secure state parameter
   */
  generateSecureState(userId) {
    const state = `${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    userSessions.set(state, { userId, timestamp: Date.now() });
    return state;
  }

  /**
   * Validate state parameter
   */
  validateState(state) {
    const session = userSessions.get(state);
    if (!session) return null;
    
    // Clean up used state
    userSessions.delete(state);
    
    // Check if not expired (5 minutes)
    if (Date.now() - session.timestamp > 5 * 60 * 1000) {
      return null;
    }
    
    return session.userId;
  }
}

const oauthService = new GitOAuthService();

// Routes

/**
 * Step 1: Initiate OAuth flow
 * GET /auth/github?userId=123
 */
app.get('/auth/github', (req, res) => {
  const userId = req.query.userId || 'anonymous';
  const scopes = req.query.scopes ? req.query.scopes.split(',') : ['repo'];
  
  const { authUrl, state } = oauthService.generateAuthUrl(userId, scopes);
  
  res.json({
    success: true,
    authUrl,
    instructions: `Visit this URL to authorize GitHub access: ${authUrl}`,
    state
  });
});

/**
 * Step 2: Handle OAuth callback
 * GET /auth/callback?code=xxx&state=xxx
 */
app.get('/auth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state parameter' });
    }

    // Validate state
    const userId = oauthService.validateState(state);
    if (!userId) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    // Exchange code for token
    const tokenData = await oauthService.exchangeCodeForToken(code, state);
    
    // Configure git credentials
    await oauthService.configureGitCredentials(userId, tokenData.access_token);
    
    // Get user info
    const userInfo = await oauthService.getUserInfo(tokenData.access_token);
    
    res.json({
      success: true,
      message: 'Successfully authorized!',
      user: {
        id: userId,
        github_login: userInfo.login,
        github_name: userInfo.name,
        scopes: tokenData.scope.split(',')
      },
      next_steps: `You can now use the Git service with userId: ${userId}`
    });
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ 
      error: 'OAuth authorization failed', 
      details: error.message 
    });
  }
});

/**
 * Step 3: Clone repository with OAuth credentials
 * POST /git/clone
 */
app.post('/git/clone', async (req, res) => {
  try {
    const { userId, repositoryUrl, targetPath } = req.body;
    
    if (!userId || !repositoryUrl) {
      return res.status(400).json({ error: 'Missing userId or repositoryUrl' });
    }

    // Check if user has valid token
    const tokenData = userTokens.get(userId);
    if (!tokenData) {
      return res.status(401).json({ 
        error: 'No GitHub authorization found',
        authUrl: `${SERVICE_URL}/auth/github?userId=${userId}`
      });
    }

    // Use the MCP server with user's credentials
    const mcpResponse = await cloneWithUserCredentials(userId, repositoryUrl, targetPath, tokenData.token);
    
    res.json({
      success: true,
      result: mcpResponse,
      user: userId
    });
    
  } catch (error) {
    console.error('Clone error:', error);
    res.status(500).json({ 
      error: 'Clone failed', 
      details: error.message 
    });
  }
});

/**
 * Clone repository using user's OAuth token
 */
async function cloneWithUserCredentials(userId, repositoryUrl, targetPath, accessToken) {
  // Configure environment for this specific clone operation
  const env = {
    ...process.env,
    GIT_ASKPASS: 'echo', // Disable interactive prompts
    GIT_USERNAME: accessToken,
    GIT_PASSWORD: '', // Token goes in username for GitHub
  };

  // Use authenticated URL
  const authenticatedUrl = repositoryUrl.replace('https://github.com/', `https://${accessToken}@github.com/`);
  
  // Call the MCP server (you'd integrate with your existing MCP setup)
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await anthropic.beta.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    system: "You can use Git tools to perform repository operations. Use the provided authenticated URL.",
    messages: [
      {
        role: "user",
        content: `Please clone the repository ${authenticatedUrl} to directory ${targetPath || 'repo-clone'}. Check the status after cloning.`,
      },
    ],
    mcp_servers: [
      {
        type: "url", 
        url: process.env.MCP_GIT_ENDPOINT,
        name: "git-mcp",
        authorization_token: null,
        tool_configuration: {
          enabled: true,
        },
      },
    ],
  }, {
    headers: {
      "anthropic-beta": "mcp-client-2025-04-04",
    },
  });

  return response;
}

/**
 * Get user's authorization status
 * GET /auth/status?userId=123
 */
app.get('/auth/status', (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId parameter' });
  }

  const tokenData = userTokens.get(userId);
  
  res.json({
    userId,
    authorized: !!tokenData,
    provider: tokenData?.provider || null,
    authorizedAt: tokenData?.timestamp || null,
    authUrl: tokenData ? null : `${SERVICE_URL}/auth/github?userId=${userId}`
  });
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'OAuth Git MCP Service',
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OAuth Git Service running on port ${PORT}`);
  console.log(`📝 Authorization URL: http://localhost:${PORT}/auth/github?userId=YOUR_USER_ID`);
  console.log(`🔧 Configure these environment variables:`);
  console.log(`   GITHUB_CLIENT_ID=your_github_client_id`);
  console.log(`   GITHUB_CLIENT_SECRET=your_github_client_secret`);
  console.log(`   OAUTH_REDIRECT_URI=http://localhost:${PORT}/auth/callback`);
});

export default app;
