const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check endpoint
app.get('/', async (req, res) => {
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

module.exports = app;
