(function () {
  const API_BASE_URL = window.location.origin;
  
  // DOM elements
  const loadingEl = document.getElementById('loading');
  const conversationsListEl = document.getElementById('conversations-list');
  const noConversationsEl = document.getElementById('no-conversations');
  const totalConversationsEl = document.getElementById('total-conversations');
  const refreshBtn = document.getElementById('refresh-btn');
  const conversationDetailEl = document.getElementById('conversation-detail');
  const backBtn = document.getElementById('back-btn');
  const conversationTitleEl = document.getElementById('conversation-title');
  const conversationMessagesEl = document.getElementById('conversation-messages');
  const deleteConversationBtn = document.getElementById('delete-conversation-btn');

  let currentConversationId = null;
  let conversations = [];

  // Initialize dashboard
  function init() {
    loadConversations();
    setupEventListeners();
  }

  // Setup event listeners
  function setupEventListeners() {
    refreshBtn.addEventListener('click', loadConversations);
    backBtn.addEventListener('click', showConversationsList);
    deleteConversationBtn.addEventListener('click', deleteCurrentConversation);
  }

  // Load all conversations from API
  async function loadConversations() {
    try {
      showLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/conversations`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      conversations = data.conversations || [];
      
      renderConversations();
      updateStats();
      
    } catch (error) {
      console.error('Error loading conversations:', error);
      showError('Failed to load conversations. Please try again.');
    } finally {
      showLoading(false);
    }
  }

  // Render conversations list
  function renderConversations() {
    if (conversations.length === 0) {
      showNoConversations();
      return;
    }

    conversationsListEl.innerHTML = conversations.map(conv => `
      <div class="conversation-item" data-conversation-id="${conv.conversation_id}">
        <div class="conversation-header">
          <div class="conversation-id">${conv.conversation_id}</div>
          <div class="conversation-date">${formatDate(conv.created_at)}</div>
        </div>
        <div class="conversation-preview">${conv.preview}</div>
        <div class="conversation-meta">
          <span class="message-count">${conv.message_count} messages</span>
          <span>Last: ${conv.last_message ? formatTime(conv.last_message.timestamp || conv.created_at) : 'N/A'}</span>
        </div>
      </div>
    `).join('');

    // Add click listeners to conversation items
    conversationsListEl.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const conversationId = item.dataset.conversationId;
        showConversationDetail(conversationId);
      });
    });
  }

  // Show conversation detail view
  async function showConversationDetail(conversationId) {
    try {
      currentConversationId = conversationId;
      
      const response = await fetch(`${API_BASE_URL}/api/conversation/${conversationId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      const conversation = conversations.find(c => c.conversation_id === conversationId);
      
      // Update UI
      conversationTitleEl.textContent = `Conversation ${conversationId}`;
      renderConversationMessages(data.conversation);
      
      // Show detail view
      document.querySelector('.conversations-section').style.display = 'none';
      conversationDetailEl.style.display = 'block';
      
    } catch (error) {
      console.error('Error loading conversation detail:', error);
      showError('Failed to load conversation details.');
    }
  }

  // Render conversation messages
  function renderConversationMessages(messages) {
    if (!messages || messages.length === 0) {
      conversationMessagesEl.innerHTML = '<p class="text-muted">No messages in this conversation.</p>';
      return;
    }

    conversationMessagesEl.innerHTML = messages.map((message, index) => `
      <div class="message-bubble message-${message.role}">
        <div class="message-content">${escapeHtml(message.content)}</div>
        <div class="message-meta">
          ${message.role === 'user' ? 'You' : 'AI'} • ${formatTime(message.timestamp || new Date().toISOString())}
        </div>
      </div>
    `).join('');

    // Scroll to bottom
    conversationMessagesEl.scrollTop = conversationMessagesEl.scrollHeight;
  }

  // Show conversations list view
  function showConversationsList() {
    conversationDetailEl.style.display = 'none';
    document.querySelector('.conversations-section').style.display = 'block';
    currentConversationId = null;
  }

  // Delete current conversation
  async function deleteCurrentConversation() {
    if (!currentConversationId) return;

    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/conversation/${currentConversationId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove from local array
      conversations = conversations.filter(c => c.conversation_id !== currentConversationId);
      
      // Go back to list and refresh
      showConversationsList();
      renderConversations();
      updateStats();
      
      showSuccess('Conversation deleted successfully.');
      
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showError('Failed to delete conversation.');
    }
  }

  // Show loading state
  function showLoading(show) {
    loadingEl.style.display = show ? 'flex' : 'none';
    conversationsListEl.style.display = show ? 'none' : 'block';
  }

  // Show no conversations state
  function showNoConversations() {
    conversationsListEl.style.display = 'none';
    noConversationsEl.style.display = 'block';
  }

  // Update statistics
  function updateStats() {
    const count = conversations.length;
    totalConversationsEl.textContent = `${count} conversation${count !== 1 ? 's' : ''}`;
  }

  // Show error message
  function showError(message) {
    // Simple error display - you could enhance this with a toast notification
    alert(`Error: ${message}`);
  }

  // Show success message
  function showSuccess(message) {
    // Simple success display - you could enhance this with a toast notification
    console.log(`Success: ${message}`);
  }

  // Utility functions
  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Initialize when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
