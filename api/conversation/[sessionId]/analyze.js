const express = require('express');
const cors = require('cors');
require('dotenv').config();
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// Analyze conversation for lead extraction
app.post('/', async (req, res) => {
  try {
    const { sessionId } = req.query;

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

module.exports = app;
