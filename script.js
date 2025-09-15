(function () {
  const messagesEl = document.getElementById('messages');
  const formEl = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = formEl.querySelector('.send-btn');

  let sessionId = null;
  let isProcessing = false;

  const API_BASE_URL = window.location.origin;

  function appendMessage(text, role, isError = false) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}${isError ? ' error' : ''}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function appendTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'bubble bot typing';
    indicator.textContent = 'AI is thinking...';
    indicator.setAttribute('data-typing', 'true');
    messagesEl.appendChild(indicator);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return indicator;
  }

  function removeTypingIndicator(indicator) {
    if (indicator && indicator.parentNode) {
      indicator.remove();
    }
  }

  function setFormState(disabled) {
    isProcessing = disabled;
    inputEl.disabled = disabled;
    sendBtn.disabled = disabled;
    sendBtn.textContent = disabled ? 'Sending...' : 'Send';
  }

  async function sendMessageToAPI(message) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message,
          sessionId: sessionId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      sessionId = data.sessionId;
      return data.response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    
    if (isProcessing) return;
    
    const text = (inputEl.value || '').trim();
    if (!text) return;

    // Add user message
    appendMessage(text, 'user');
    inputEl.value = '';
    setFormState(true);

    // Show typing indicator
    const typingEl = appendTypingIndicator();

    try {
      const response = await sendMessageToAPI(text);
      removeTypingIndicator(typingEl);
      appendMessage(response, 'bot');
    } catch (error) {
      removeTypingIndicator(typingEl);
      appendMessage(
        `Sorry, I encountered an error: ${error.message}\n\nPlease check that the server is running and your OpenAI API key is configured.`,
        'bot',
        true
      );
    } finally {
      setFormState(false);
      inputEl.focus();
    }
  }

  // Initialize the chat
  function initializeChat() {
    appendMessage('Hello! I\'m an AI assistant powered by OpenAI. How can I help you today?', 'bot');
    inputEl.focus();
  }

  // Check server health on load
  async function checkServerHealth() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);
      if (response.ok) {
        const data = await response.json();
        console.log('Server health check passed:', data);
      } else {
        throw new Error('Server health check failed');
      }
    } catch (error) {
      console.warn('Server health check failed:', error);
      appendMessage(
        'Warning: Unable to connect to the server. Please make sure the backend is running on port 3000.',
        'bot',
        true
      );
    }
  }

  // Event listeners
  formEl.addEventListener('submit', handleSubmit);

  // Allow Enter key to send message
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  });

  // Initialize
  checkServerHealth();
  initializeChat();
})();
