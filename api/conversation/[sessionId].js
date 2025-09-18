const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get conversation history endpoint
app.get('/', async (req, res) => {
  try {
    const { sessionId } = req.query;

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
app.delete('/', async (req, res) => {
  try {
    const { sessionId } = req.query;
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('conversation_id', sessionId);
    
    if (error) {
      throw error;
    }
    
    res.json({ message: 'Conversation cleared' });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = app;
