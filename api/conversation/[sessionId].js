const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get conversation history endpoint
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const sessionId = req.query.sessionId;

  if (req.method === 'GET') {
    try {
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
  } else if (req.method === 'DELETE') {
    try {
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
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};