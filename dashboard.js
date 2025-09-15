(function () {
  const API_BASE_URL = window.location.origin;
  
  // DOM elements
  const loadingEl = document.getElementById('loading');
  const conversationsListEl = document.getElementById('conversations-list');
  const noConversationsEl = document.getElementById('no-conversations');
  const totalConversationsEl = document.getElementById('total-conversations');
  const refreshBtn = document.getElementById('refresh-btn');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');
  const conversationDetailEl = document.getElementById('conversation-detail');
  const backBtn = document.getElementById('back-btn');
  const conversationTitleEl = document.getElementById('conversation-title');
  const conversationMessagesEl = document.getElementById('conversation-messages');
  const deleteConversationBtn = document.getElementById('delete-conversation-btn');
  const analyzeLeadBtn = document.getElementById('analyze-lead-btn');
  const leadAnalysisEl = document.getElementById('lead-analysis');
  const leadAnalysisContentEl = document.getElementById('lead-analysis-content');

  let currentConversationId = null;
  let conversations = [];
  let filtered = [];

  // Initialize dashboard
  function init() {
    loadConversations();
    setupEventListeners();
  }

  // Setup event listeners
  function setupEventListeners() {
    refreshBtn.addEventListener('click', loadConversations);
    searchInput.addEventListener('input', handleFilterSort);
    sortSelect.addEventListener('change', handleFilterSort);
    backBtn.addEventListener('click', showConversationsList);
    deleteConversationBtn.addEventListener('click', deleteCurrentConversation);
    analyzeLeadBtn.addEventListener('click', analyzeCurrentConversation);
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
      handleFilterSort();
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
    if ((filtered.length || 0) === 0) {
      showNoConversations();
      return;
    }

    conversationsListEl.innerHTML = filtered.map(conv => `
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
        <div class="conversation-actions">
          ${renderLeadBadge(conv)}
          <button class="btn btn-secondary analyze-inline" data-id="${conv.conversation_id}">Analyze</button>
        </div>
      </div>
    `).join('');

    // Add click listeners to conversation items
    conversationsListEl.querySelectorAll('.conversation-item').forEach(item => {
      item.addEventListener('click', () => {
        const conversationId = item.dataset.conversationId;
        selectListItem(item);
        showConversationDetail(conversationId);
      });
    });

    // Inline analyze buttons
    conversationsListEl.querySelectorAll('.analyze-inline').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        await analyzeById(id, btn);
      });
    });
  }

  function renderLeadBadge(conv) {
    if (!conv.lead_quality) return '';
    const quality = conv.lead_quality;
    const cls = quality === 'good' ? 'badge-good' : quality === 'ok' ? 'badge-ok' : 'badge-spam';
    const label = quality.charAt(0).toUpperCase() + quality.slice(1);
    const name = conv.customer_name ? ` • ${escapeHtml(conv.customer_name)}` : '';
    return `<span class="badge ${cls}">${label}${name}</span>`;
  }

  function handleFilterSort() {
    const q = (searchInput.value || '').toLowerCase();
    filtered = (conversations || []).filter(c => {
      const hay = [
        c.conversation_id,
        c.preview,
        c.customer_email,
        c.customer_name,
        c.lead_quality
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });

    const mode = sortSelect.value;
    filtered.sort((a, b) => {
      switch (mode) {
        case 'created_asc': return new Date(a.created_at) - new Date(b.created_at);
        case 'messages_desc': return b.message_count - a.message_count;
        case 'messages_asc': return a.message_count - b.message_count;
        case 'created_desc':
        default: return new Date(b.created_at) - new Date(a.created_at);
      }
    });

    renderConversations();
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
      renderLeadAnalysis(data.analysis);
      
      // Two-pane: keep list visible, always show detail pane
      conversationDetailEl.style.display = 'block';

      // Hide previous analysis
      leadAnalysisEl.style.display = 'none';
      
    } catch (error) {
      console.error('Error loading conversation detail:', error);
      showError('Failed to load conversation details.');
    }
  }

  // Analyze current conversation
  async function analyzeCurrentConversation() {
    if (!currentConversationId) return;

    try {
      analyzeLeadBtn.disabled = true;
      analyzeLeadBtn.textContent = 'Analyzing...';

      const response = await fetch(`${API_BASE_URL}/api/conversation/${currentConversationId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      renderLeadAnalysis(data.analysis);
      showSuccess('Lead analysis completed.');

    } catch (error) {
      console.error('Error analyzing conversation:', error);
      showError('Failed to analyze conversation.');
    } finally {
      analyzeLeadBtn.disabled = false;
      analyzeLeadBtn.textContent = 'Analyze Lead';
    }
  }

  function renderLeadAnalysis(analysis) {
    if (!analysis) {
      leadAnalysisContentEl.innerHTML = '<p class="text-muted">No analysis available.</p>';
      leadAnalysisEl.style.display = 'block';
      return;
    }

    const fields = [
      ['Name', analysis.customerName],
      ['Email', analysis.customerEmail],
      ['Phone', analysis.customerPhone],
      ['Industry', analysis.customerIndustry],
      ['Problems/Needs/Goals', analysis.customerProblem],
      ['Availability', analysis.customerAvailability],
      ['Booked Consultation', String(analysis.customerConsultation)],
      ['Special Notes', analysis.specialNotes],
      ['Lead Quality', analysis.leadQuality]
    ];

    leadAnalysisContentEl.innerHTML = `
      <div class="analysis-grid">
        ${fields.map(([label, value]) => `
          <div class="analysis-row">
            <div class="analysis-label">${escapeHtml(label)}</div>
            <div class="analysis-value">${escapeHtml(value ?? '')}</div>
          </div>
        `).join('')}
      </div>
    `;

    leadAnalysisEl.style.display = 'block';
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
    currentConversationId = null;
    clearSelection();
  }

  function selectListItem(el) {
    clearSelection();
    el.classList.add('selected');
  }

  function clearSelection() {
    document.querySelectorAll('.conversation-item.selected').forEach(el => el.classList.remove('selected'));
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
    showToast(message, 'error');
  }

  // Show success message
  function showSuccess(message) {
    showToast(message, 'success');
  }

  function showToast(message, type) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.remove();
    }, 3000);
  }

  async function analyzeById(conversationId, buttonEl) {
    try {
      if (buttonEl) { buttonEl.disabled = true; buttonEl.textContent = 'Analyzing...'; }
      const response = await fetch(`${API_BASE_URL}/api/conversation/${conversationId}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json();
      showSuccess('Lead analysis completed.');
      // Reload to fetch updated badges
      await loadConversations();
    } catch (e) {
      showError('Failed to analyze conversation.');
    } finally {
      if (buttonEl) { buttonEl.disabled = false; buttonEl.textContent = 'Analyze'; }
    }
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
