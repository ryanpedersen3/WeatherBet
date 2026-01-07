# OpenAI API Key Setup for NFL Chatbot

## What is it?

The chatbot uses OpenAI's GPT-4o-mini model to provide intelligent, conversational responses to your NFL data queries. Without the API key, the chatbot still works but uses basic pattern matching instead of AI.

## Getting an OpenAI API Key

### Step 1: Sign up for OpenAI
1. Go to [OpenAI Platform](https://platform.openai.com/signup)
2. Sign up for a free account (or sign in if you have one)
3. New accounts get **$5 in free credits** to try the API

### Step 2: Create an API Key
1. Go to [API Keys page](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Give it a name (e.g., "WeatherBet Chatbot")
4. Copy the key (starts with `sk-...`)
5. **⚠️ Save it somewhere safe - you can't view it again!**

## Setting up the Key in Your App

### For Production (Deployed Worker)

Run this command:

```bash
wrangler secret put OPENAI_API_KEY
```

When prompted, paste your API key and press Enter.

### For Local Development

Create a `.dev.vars` file in your project root:

```bash
# .dev.vars (already in .gitignore)
OPENAI_API_KEY=sk-your-api-key-here
```

Then run your dev server:

```bash
pnpm run dev
```

## Cost Information

The chatbot uses **GPT-4o-mini**, which is very cost-effective:

- **Input:** $0.15 per 1M tokens (~750,000 words)
- **Output:** $0.60 per 1M tokens (~750,000 words)

**Example costs:**
- 1,000 chatbot queries ≈ $0.10 - $0.50
- With $5 free credits, you get 10,000+ queries

## Testing

After setting up the key, test it:

```bash
# Test the chat endpoint
curl -X POST "https://weatherbet.ryanpedersen3.workers.dev/api/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What were the highest scoring games in 2025?"}'
```

Or just open the app and try the chatbot in the UI!

## Without an API Key

The chatbot still works without an OpenAI key:
- Uses pattern matching to understand queries
- Queries the database directly
- Returns data in a simple format
- Good for basic searches

**With the API key:**
- Natural language understanding
- Conversational responses
- Follow-up questions
- Data analysis and insights
- Much better user experience!

## Troubleshooting

### "Invalid API key"
- Make sure you copied the entire key (starts with `sk-`)
- Check if the key is active on the OpenAI dashboard

### "Rate limit exceeded"
- You've used your free credits
- Add a payment method to continue
- Or wait for the rate limit to reset

### "API key not found"
- Run `wrangler secret put OPENAI_API_KEY` again
- Make sure you're deploying after setting the secret

## Security

✅ **DO:**
- Use `wrangler secret put` for production
- Keep API keys in `.dev.vars` (ignored by git)
- Rotate keys regularly

❌ **DON'T:**
- Commit API keys to git
- Share API keys publicly
- Use API keys in frontend code

## Alternative: Use Without API Key

If you don't want to use OpenAI, the chatbot works fine in "basic mode":
- Pattern-based query understanding
- Direct database queries
- Simple text responses
- No cost, no setup needed

The AI enhancement is optional but recommended for the best experience!

