const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

// Chat endpoint
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
};