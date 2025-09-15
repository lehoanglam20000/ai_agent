const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Generate a simple session ID
function generateSessionId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Supabase conversation functions
async function getConversation(conversationId) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('conversation_id', conversationId)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }
    
    return data ? data.messages : [];
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
}

async function saveConversation(conversationId, messages) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .upsert({
        conversation_id: conversationId,
        messages: messages,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      })
      .select()
      .single();
    
    if (error) {
      throw error;
    }
    
    return data;
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

async function deleteConversation(conversationId) {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('conversation_id', conversationId);
    
    if (error) {
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting conversation:', error);
    throw error;
  }
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get or create conversation history
    const currentSessionId = sessionId || generateSessionId();
    let conversationHistory = await getConversation(currentSessionId);
    
    // Add user message to history
    conversationHistory.push({ role: 'user', content: message.trim() });
    
    // Prepare messages for OpenAI (include system message and conversation history)
   // Prepare messages for OpenAI (include system message and conversation history)
   const messages = [
    { role: 'system', content: `You are the GBS Virtual Assistant — a friendly and helpful support assistant representing Global Banking School.  
        Your goal is to guide students through a structured support conversation, helping them with booking 1-to-1 academic or wellbeing support, and answering questions about classes, rooms, and timetables.  
  
        💬 Always keep responses short, clear, and polite.  
        💬 Always reply in the same language the student speaks.  
        💬 Ask only one question at a time.  
  
        🔍 SUPPORT AREAS:  
        - 1-to-1 Support: Academic, wellbeing, or careers guidance.  
        - Class Information: Help with timetables, room numbers, and class schedules.  
        - General Support: Direct to the right department if unsure.  
  
        ✅ BENEFITS: Emphasize making student life easier, saving time, and providing quick answers.  
  
        🧠 CONVERSATION FLOW:  
        1. Ask if the student needs help with booking support or with class/timetable information.  
        2. If booking support → guide them to choose the type (academic, wellbeing, careers), then collect name → student ID → email (one at a time).  
        3. If timetable/class question → ask what course/module/year they are in, then provide the relevant information or direct them.  
        4. Confirm if they got what they needed.  
        5. If not, offer to connect them to the right GBS support team.  
        6. Finally, ask if they have any other questions before ending the chat.  
  
        ⚠️ OTHER RULES:  
        - Be friendly but concise.  
        - Do not ask multiple questions at once.  
        - Stay on-topic and professional throughout the conversation.  
        - If unsure, always advise: "Please contact the GBS Student Support Team at support@globalbanking.ac.uk or visit the Student Services Desk for further help."  
        - If asked something outside your scope (finance, admissions, visa, IT issues), guide them to the relevant GBS support team instead of answering directly.` },
    ...conversationHistory
  ];
  
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    });
    
    const botResponse = completion.choices[0].message.content;
    
    // Add bot response to history
    conversationHistory.push({ role: 'assistant', content: botResponse });
    
    // Keep only last 20 messages to prevent memory issues
    if (conversationHistory.length > 20) {
      conversationHistory.splice(0, conversationHistory.length - 20);
    }
    
    // Save updated conversation to Supabase
    await saveConversation(currentSessionId, conversationHistory);
    
    res.json({
      response: botResponse,
      sessionId: currentSessionId,
      conversationLength: conversationHistory.length
    });
    
  } catch (error) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to get response from AI',
      details: error.message 
    });
  }
});

// Get conversation history endpoint
app.get('/api/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data, error } = await supabase
      .from('conversations')
      .select('conversation_id, messages, lead_analysis, lead_quality, customer_email, customer_name, customer_phone, created_at')
      .eq('conversation_id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data || !data.messages || data.messages.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      conversation: data.messages,
      analysis: data.lead_analysis || null,
      meta: {
        conversationId: data.conversation_id,
        leadQuality: data.lead_quality || null,
        customerEmail: data.customer_email || null,
        customerName: data.customer_name || null,
        customerPhone: data.customer_phone || null,
        createdAt: data.created_at
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// Clear conversation endpoint
app.delete('/api/conversation/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await deleteConversation(sessionId);
    res.json({ message: 'Conversation cleared' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// Get all conversations endpoint
app.get('/api/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, conversation_id, created_at, messages, lead_quality, customer_email, customer_name')
      .order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    // Transform data to include message count and last message preview
    const conversations = data.map(conv => ({
      id: conv.id,
      conversation_id: conv.conversation_id,
      created_at: conv.created_at,
      message_count: conv.messages.length,
      last_message: conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null,
      preview: conv.messages.length > 0 ? 
        (conv.messages[conv.messages.length - 1].content || '').substring(0, 100) + '...' : 
        'No messages',
      lead_quality: conv.lead_quality || null,
      customer_email: conv.customer_email || null,
      customer_name: conv.customer_name || null
    }));
    
    res.json({ conversations });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test Supabase connection
    const { data, error } = await supabase
      .from('conversations')
      .select('id', { count: 'exact' })
      .limit(1);
    
    if (error) {
      throw error;
    }
    
    res.json({ 
      status: 'OK', 
      timestamp: new Date().toISOString(),
      supabase: 'Connected',
      totalConversations: data?.length || 0
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      supabase: 'Connection failed',
      error: error.message
    });
  }
});

// Analyze conversation for lead extraction
app.post('/api/conversation/:sessionId/analyze', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Fetch conversation messages
    const messages = await getConversation(sessionId);
    if (!messages || messages.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Build transcript text
    const transcript = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const system_prompt = `Extract the following customer details from the transcript:\n- Name\n- Email address\n- Phone number\n- Industry\n- Problems, needs, and goals summary\n- Availability\n- Whether they have booked a consultation (true/false)\n- Any special notes\n- Lead quality (categorize as 'good', 'ok', or 'spam')\nFormat the response using this JSON schema:\n{\n  "type": "object",\n  "properties": {\n    "customerName": { "type": "string" },\n    "customerEmail": { "type": "string" },\n    "customerPhone": { "type": "string" },\n    "customerIndustry": { "type": "string" },\n    "customerProblem": { "type": "string" },\n    "customerAvailability": { "type": "string" },\n    "customerConsultation": { "type": "boolean" },\n    "specialNotes": { "type": "string" },\n    "leadQuality": { "type": "string", "enum": ["good", "ok", "spam"] }\n  },\n  "required": ["customerName", "customerEmail", "customerProblem", "leadQuality"]\n}\nIf the user provided contact details, set lead quality to "good"; otherwise, "spam".`;

    // Call OpenAI to extract JSON
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system_prompt },
        { role: 'user', content: `Transcript:\n\n${transcript}\n\nReturn only minified JSON with no extra text.` }
      ],
      temperature: 0,
      max_tokens: 500
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Try to salvage JSON if model wrapped in code fences
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    }

    // Persist analysis into conversations table
    const { data, error } = await supabase
      .from('conversations')
      .update({
        lead_analysis: parsed,
        lead_quality: parsed.leadQuality || null,
        customer_email: parsed.customerEmail || null,
        customer_name: parsed.customerName || null,
        customer_phone: parsed.customerPhone || null
      })
      .eq('conversation_id', sessionId)
      .select('conversation_id, lead_analysis, lead_quality, customer_email, customer_name, customer_phone')
      .single();

    if (error) {
      throw error;
    }

    res.json({ analysis: data.lead_analysis, meta: {
      leadQuality: data.lead_quality,
      customerEmail: data.customer_email,
      customerName: data.customer_name,
      customerPhone: data.customer_phone
    }});
  } catch (error) {
    console.error('Error analyzing conversation:', error);
    res.status(500).json({ error: 'Failed to analyze conversation' });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OpenAI API Key configured: ${process.env.OPENAI_API_KEY ? 'Yes' : 'No'}`);
  console.log(`Supabase URL configured: ${process.env.SUPABASE_URL ? 'Yes' : 'No'}`);
  console.log(`Supabase Service Role Key configured: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes' : 'No'}`);
});
