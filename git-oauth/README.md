# 🔐 OAuth Git Service

An OAuth-enabled Git MCP service that makes it easy for users to authorize GitHub access and clone repositories through a simple web interface.

## 🚀 Quick Start

### 1. Setup GitHub OAuth App

1. Go to [GitHub Settings → Developer settings → OAuth Apps](https://github.com/settings/applications/new)
2. Create a new OAuth App with these settings:
   - **Application name**: `Your Git Service`
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:3000/auth/callback`
3. Copy the **Client ID** and **Client Secret**

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your GitHub OAuth credentials
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Start the Service

```bash
npm start
```

The service will be available at `http://localhost:3000`

## 🎯 How It Works

### User Flow (Super Easy!)

1. **User requests authorization:**
   ```bash
   curl http://localhost:3000/auth/github?userId=user123
   ```

2. **Service responds with GitHub URL:**
   ```json
   {
     "authUrl": "https://github.com/login/oauth/authorize?client_id=...",
     "instructions": "Visit this URL to authorize GitHub access"
   }
   ```

3. **User visits URL and authorizes on GitHub**
   - Familiar GitHub interface
   - User clicks "Authorize"
   - No token copying needed!

4. **GitHub redirects back with authorization**
   - Service automatically exchanges code for token
   - Token stored securely
   - User gets confirmation

5. **User can now clone repositories:**
   ```bash
   curl -X POST http://localhost:3000/git/clone \
     -H "Content-Type: application/json" \
     -d '{"userId":"user123", "repositoryUrl":"https://github.com/private/repo"}'
   ```

## 📖 API Reference

### Authentication Endpoints

#### `GET /auth/github`
Initiate OAuth flow for a user.

**Parameters:**
- `userId` (required): Unique identifier for the user
- `scopes` (optional): Comma-separated GitHub scopes (default: `repo`)

**Example:**
```bash
curl "http://localhost:3000/auth/github?userId=user123&scopes=repo,read:user"
```

#### `GET /auth/callback`
OAuth callback endpoint (handled automatically by GitHub).

#### `GET /auth/status`
Check user's authorization status.

**Parameters:**
- `userId` (required): User identifier

**Example:**
```bash
curl "http://localhost:3000/auth/status?userId=user123"
```

### Git Operations

#### `POST /git/clone`
Clone a repository using user's OAuth credentials.

**Body:**
```json
{
  "userId": "user123",
  "repositoryUrl": "https://github.com/owner/repo",
  "targetPath": "my-clone" // optional
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/git/clone \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user123",
    "repositoryUrl": "https://github.com/bitovi/private-repo",
    "targetPath": "my-project"
  }'
```

## 🧪 Testing

### Run Demo Client

```bash
npm run demo
```

This will simulate the complete OAuth flow and show you how it works.

### Manual Testing

1. **Start the service:**
   ```bash
   npm start
   ```

2. **Get authorization URL:**
   ```bash
   curl "http://localhost:3000/auth/github?userId=testuser"
   ```

3. **Visit the returned URL in your browser**

4. **Authorize on GitHub**

5. **Try cloning a repository:**
   ```bash
   curl -X POST http://localhost:3000/git/clone \
     -H "Content-Type: application/json" \
     -d '{"userId":"testuser", "repositoryUrl":"https://github.com/octocat/Hello-World"}'
   ```

## 🐳 Docker Deployment

### Build Image

```bash
docker build -t oauth-git-service .
```

### Run Container

```bash
docker run -p 3000:3000 \
  -e GITHUB_CLIENT_ID=your_client_id \
  -e GITHUB_CLIENT_SECRET=your_client_secret \
  -e OAUTH_REDIRECT_URI=http://localhost:3000/auth/callback \
  -e ANTHROPIC_API_KEY=your_anthropic_key \
  -e MCP_GIT_ENDPOINT=https://your-mcp-server.com/mcp \
  oauth-git-service
```

### Production Deployment

```bash
docker run -p 3000:3000 \
  -e GITHUB_CLIENT_ID=your_client_id \
  -e GITHUB_CLIENT_SECRET=your_client_secret \
  -e OAUTH_REDIRECT_URI=https://yourdomain.com/auth/callback \
  -e SERVICE_URL=https://yourdomain.com \
  -e NODE_ENV=production \
  oauth-git-service
```

## 🔒 Security Features

- ✅ **No token exposure**: Users never see or handle tokens
- ✅ **Secure state validation**: CSRF protection with state parameters
- ✅ **Scoped permissions**: Request only needed GitHub permissions
- ✅ **Token isolation**: Each user's tokens stored separately
- ✅ **Automatic cleanup**: Used state parameters are cleaned up
- ✅ **Revocable access**: Users can revoke access anytime on GitHub

## 🌟 Benefits Over Manual Tokens

| Manual Tokens | OAuth Flow |
|---------------|------------|
| ❌ Users must create tokens manually | ✅ Automatic token creation |
| ❌ Users must copy/paste tokens | ✅ No token handling needed |
| ❌ Tokens never expire | ✅ Proper token lifecycle |
| ❌ Hard to revoke access | ✅ Easy revocation on GitHub |
| ❌ No audit trail | ✅ GitHub tracks app access |
| ❌ Scope management complex | ✅ Clear permission requests |

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID | Required |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app secret | Required |
| `OAUTH_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/auth/callback` |
| `SERVICE_URL` | Base URL of your service | `http://localhost:3000` |
| `PORT` | Server port | `3000` |
| `ANTHROPIC_API_KEY` | Anthropic API key for MCP | Required |
| `MCP_GIT_ENDPOINT` | Git MCP server endpoint | Required |

### GitHub Scopes

Common scopes you might request:

- `repo` - Full repository access (public and private)
- `public_repo` - Public repository access only
- `read:user` - Read user profile information
- `user:email` - Access user email addresses

## 🚧 Production Considerations

### Token Storage

The current implementation uses in-memory storage. For production:

```javascript
// Use Redis or database
import Redis from 'ioredis';
const redis = new Redis(process.env.REDIS_URL);

// Store tokens in Redis with expiration
await redis.setex(`token:${userId}`, 3600, JSON.stringify(tokenData));
```

### Security Headers

Add security middleware:

```javascript
import helmet from 'helmet';
app.use(helmet());
```

### Rate Limiting

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/auth', limiter);
```

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

- Create an issue for bugs or feature requests
- Check the API documentation for usage questions
- See the demo client for implementation examples
