const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all conversations endpoint
app.get('/', async (req, res) => {
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

module.exports = app;
