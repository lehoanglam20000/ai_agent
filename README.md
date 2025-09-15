# Web Chatbot with OpenAI & Supabase Integration

A full-stack web chatbot that uses OpenAI's API through a Node.js backend and stores conversation history in Supabase database.

## Features

- 🤖 **OpenAI Integration**: Powered by GPT-4o-mini for intelligent responses
- 💾 **Persistent Storage**: Conversations stored in Supabase PostgreSQL database
- 💬 **Conversation Memory**: Maintains chat history per session across browser refreshes
- 🎨 **Modern UI**: Clean, responsive design with typing indicators
- 🔒 **Secure Backend**: API keys stored server-side in environment variables
- 📱 **Mobile Friendly**: Responsive design that works on all devices

## Project Structure

```
Web_ai_agent/
├── server.js          # Node.js Express backend with Supabase integration
├── index.html         # Frontend HTML
├── styles.css         # Frontend styling
├── script.js          # Frontend JavaScript
├── package.json       # Node.js dependencies
├── .env               # Environment variables (API keys)
├── .env.example       # Environment variables template
├── .gitignore         # Git ignore file
└── README.md          # This file
```

## Database Schema

Your Supabase table should have the following structure:

```sql
CREATE TABLE conversations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  conversation_id TEXT UNIQUE NOT NULL,
  messages JSONB NOT NULL,
  -- Optional lead analysis fields
  lead_analysis JSONB,
  lead_quality TEXT CHECK (lead_quality IN ('good','ok','spam')),
  customer_email TEXT,
  customer_name TEXT,
  customer_phone TEXT
);
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your credentials:
   ```
   # OpenAI API Configuration
   OPENAI_API_KEY=your_actual_openai_api_key_here
   
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   
   # Server Configuration
   PORT=3000
   ```

### 3. Set Up Supabase Database

1. Create a new table in your Supabase project:
   ```sql
   CREATE TABLE conversations (
     id BIGSERIAL PRIMARY KEY,
     created_at TIMESTAMPTZ DEFAULT NOW(),
     conversation_id TEXT UNIQUE NOT NULL,
     messages JSONB NOT NULL,
     lead_analysis JSONB,
     lead_quality TEXT CHECK (lead_quality IN ('good','ok','spam')),
     customer_email TEXT,
     customer_name TEXT,
     customer_phone TEXT
   );
   ```

2. Enable Row Level Security (RLS) if needed:
   ```sql
   ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
   ```

3. Create a policy for service role access:
   ```sql
   CREATE POLICY "Service role can manage conversations" ON conversations
   FOR ALL USING (true);
   ```

### 4. Start the Server

```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

### 5. Open the Chatbot

Navigate to `http://localhost:3000` in your browser.

## API Endpoints

- `POST /api/chat` - Send a message and get AI response
- `GET /api/conversation/:sessionId` - Get conversation history
- `DELETE /api/conversation/:sessionId` - Clear conversation history
- `POST /api/conversation/:sessionId/analyze` - Extract customer info and lead quality
- `GET /api/health` - Check server health and Supabase connection

## How It Works

1. **Frontend**: User types a message in the web interface
2. **Backend**: Express server receives the message via POST request
3. **Database**: Server fetches conversation history from Supabase
4. **OpenAI API**: Server sends message + history to OpenAI
5. **Response**: AI response is sent back to frontend and displayed
6. **Storage**: Updated conversation is saved to Supabase database

## Data Flow

```
User Input → Frontend → Backend → Supabase (fetch history) → OpenAI API → Backend → Supabase (save) → Frontend → User
```

## Security Notes

- ✅ API keys are stored server-side in `.env` file
- ✅ CORS is configured for frontend-backend communication
- ✅ Input validation and error handling included
- ✅ Service role key used for database access (bypasses RLS)
- ⚠️ `.env` file should be added to `.gitignore` in production

## Customization

### Changing the AI Model

Edit `server.js` and modify the model parameter:
```javascript
const completion = await openai.chat.completions.create({
  model: 'gpt-4', // Change to gpt-4, gpt-3.5-turbo, etc.
  // ... other options
});
```

### Modifying System Prompt

Update the system message in `server.js`:
```javascript
const messages = [
  { role: 'system', content: 'You are a helpful assistant specialized in...' },
  // ... conversation history
];
```

### Database Schema Changes

If you modify the database schema, update the corresponding functions in `server.js`:
- `getConversation()`
- `saveConversation()`
- `deleteConversation()`

To add lead analysis support to an existing `conversations` table, run:

```sql
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS lead_analysis JSONB,
  ADD COLUMN IF NOT EXISTS lead_quality TEXT CHECK (lead_quality IN ('good','ok','spam')),
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS customer_name TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;
```

## Troubleshooting

### Common Issues

1. **"Unable to connect to server"**
   - Make sure the Node.js server is running (`npm start`)
   - Check that port 3000 is not in use by another application

2. **"Supabase connection failed"**
   - Verify your Supabase URL and service role key in `.env`
   - Check that your table exists and has the correct schema
   - Ensure RLS policies allow service role access

3. **"OpenAI API error"**
   - Verify your API key is correct in `.env`
   - Check your OpenAI account has sufficient credits
   - Ensure you have access to the GPT-4o-mini model

4. **Database errors**
   - Check Supabase logs in your project dashboard
   - Verify table permissions and RLS policies
   - Ensure the `messages` column accepts JSONB data

### Development Tips

- Use `npm run dev` for development (auto-restart on file changes)
- Check browser console for frontend errors
- Check terminal for backend errors
- Use the `/api/health` endpoint to verify server and database status
- Monitor Supabase logs for database issues

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENAI_API_KEY` | Your OpenAI API key | `sk-...` |
| `SUPABASE_URL` | Your Supabase project URL | `https://xyz.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `PORT` | Server port (optional) | `3000` |

## Next Steps

- Add user authentication with Supabase Auth
- Implement conversation search and filtering
- Add file upload capabilities
- Create multiple chat rooms
- Add message analytics and insights
- Implement conversation export functionality