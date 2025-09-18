const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check endpoint
module.exports = async (req, res) => {
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
};