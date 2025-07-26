import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Check if API key is available
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not found in environment variables.');
  console.error('Please set your API key in the .env file:');
  console.error('ANTHROPIC_API_KEY=your_api_key_here');
  process.exit(1);
}

// Initialize the client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY, // Store your API key in environment variables
});

async function chatWithClaude() {
  try {
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: "Hello, Claude! Can you explain what you can help me with?"
        }
      ],
    });

    console.log('Claude says:', message.content[0].text);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
chatWithClaude();
