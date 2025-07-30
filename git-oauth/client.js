/**
 * OAuth Git Service Client Example
 * Shows how users would interact with the OAuth-enabled service
 */

import fetch from 'node-fetch';

const SERVICE_URL = 'http://localhost:3000';
const USER_ID = 'user_' + Math.random().toString(36).substr(2, 9);

class GitServiceClient {
  constructor(serviceUrl = SERVICE_URL) {
    this.serviceUrl = serviceUrl;
  }

  /**
   * Step 1: Get authorization URL
   */
  async getAuthorizationUrl(userId, scopes = ['repo']) {
    const url = `${this.serviceUrl}/auth/github?userId=${userId}&scopes=${scopes.join(',')}`;
    const response = await fetch(url);
    return await response.json();
  }

  /**
   * Step 2: Check authorization status
   */
  async checkAuthStatus(userId) {
    const url = `${this.serviceUrl}/auth/status?userId=${userId}`;
    const response = await fetch(url);
    return await response.json();
  }

  /**
   * Step 3: Clone repository (after authorization)
   */
  async cloneRepository(userId, repositoryUrl, targetPath) {
    const response = await fetch(`${this.serviceUrl}/git/clone`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        repositoryUrl,
        targetPath,
      }),
    });
    
    return await response.json();
  }

  /**
   * Complete OAuth flow simulation
   */
  async demonstrateOAuthFlow() {
    console.log('🚀 Starting OAuth Demo Flow');
    console.log('👤 User ID:', USER_ID);
    console.log('');

    try {
      // Step 1: Check current auth status
      console.log('📋 Step 1: Checking authorization status...');
      const status = await this.checkAuthStatus(USER_ID);
      console.log('Status:', status);
      console.log('');

      if (!status.authorized) {
        // Step 2: Get authorization URL
        console.log('🔐 Step 2: Getting authorization URL...');
        const authData = await this.getAuthorizationUrl(USER_ID, ['repo', 'read:user']);
        console.log('Authorization required!');
        console.log('🌐 Visit this URL to authorize:');
        console.log(authData.authUrl);
        console.log('');
        console.log('⏳ Waiting for authorization...');
        console.log('   (The user would visit the URL, authorize on GitHub, and be redirected back)');
        console.log('');
        
        // Simulate waiting for authorization
        console.log('💡 In a real app, you would:');
        console.log('   1. Open the authorization URL in a browser');
        console.log('   2. User authorizes on GitHub');
        console.log('   3. GitHub redirects to your callback URL');
        console.log('   4. Your service exchanges the code for a token');
        console.log('   5. Service is now authorized to clone repos');
        console.log('');
        
        return {
          step: 'authorization_required',
          authUrl: authData.authUrl,
          userId: USER_ID
        };
      }

      // Step 3: Clone a repository
      console.log('📦 Step 3: Cloning repository...');
      const cloneResult = await this.cloneRepository(
        USER_ID,
        'https://github.com/octocat/Hello-World',
        'oauth-test-clone'
      );
      
      console.log('Clone result:', cloneResult);
      
      return {
        step: 'clone_completed',
        result: cloneResult,
        userId: USER_ID
      };

    } catch (error) {
      console.error('❌ Error:', error.message);
      return {
        step: 'error',
        error: error.message,
        userId: USER_ID
      };
    }
  }
}

// Example usage
async function runDemo() {
  const client = new GitServiceClient();
  
  console.log('🎯 OAuth Git Service Demo');
  console.log('='.repeat(50));
  
  const result = await client.demonstrateOAuthFlow();
  
  console.log('');
  console.log('📊 Demo Result:');
  console.log(JSON.stringify(result, null, 2));
}

// Docker/Container usage examples
function showContainerExamples() {
  console.log('');
  console.log('🐳 Container Usage Examples:');
  console.log('='.repeat(50));
  
  console.log(`
# 1. Basic OAuth service
docker run -p 3000:3000 \\
  -e GITHUB_CLIENT_ID=your_client_id \\
  -e GITHUB_CLIENT_SECRET=your_client_secret \\
  -e OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback \\
  your-oauth-git-service

# 2. With custom domain
docker run -p 3000:3000 \\
  -e GITHUB_CLIENT_ID=your_client_id \\
  -e GITHUB_CLIENT_SECRET=your_client_secret \\
  -e OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback \\
  -e SERVICE_URL=https://yourdomain.com \\
  your-oauth-git-service

# 3. With database for token storage
docker run -p 3000:3000 \\
  -e GITHUB_CLIENT_ID=your_client_id \\
  -e GITHUB_CLIENT_SECRET=your_client_secret \\
  -e DATABASE_URL=postgres://... \\
  -e REDIS_URL=redis://... \\
  your-oauth-git-service
`);

  console.log('');
  console.log('📋 User Experience Flow:');
  console.log(`
1. User calls: GET /auth/github?userId=abc123
2. Service responds with GitHub authorization URL
3. User visits URL, authorizes your app on GitHub
4. GitHub redirects back to /auth/callback with code
5. Service exchanges code for access token
6. User can now clone private repos: POST /git/clone
`);
}

// Run the demo
if (process.argv[2] === 'demo') {
  runDemo();
} else if (process.argv[2] === 'examples') {
  showContainerExamples();
} else {
  console.log('Usage:');
  console.log('  node client.js demo      # Run OAuth flow demo');
  console.log('  node client.js examples  # Show container examples');
}

export { GitServiceClient };
