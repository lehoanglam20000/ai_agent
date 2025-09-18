const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get all conversations endpoint
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};