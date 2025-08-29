(function () {
  const messagesEl = document.getElementById('messages');
  const formEl = document.getElementById('chat-form');
  const inputEl = document.getElementById('chat-input');

  const FIXED_BOT_RESPONSE = "Update demo bot.\n\n- I currently send a fixed reply.\n- You can replace this with a real API later.";

  function appendMessage(text, role) {
    const bubble = document.createElement('div');
    bubble.className = `bubble ${role}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function handleSubmit(event) {
    event.preventDefault();
    const text = (inputEl.value || '').trim();
    if (!text) return;
    appendMessage(text, 'user');
    inputEl.value = '';

    setTimeout(() => {
      appendMessage(FIXED_BOT_RESPONSE, 'bot');
    }, 300);
  }

  // Seed a greeting
  appendMessage('Hello! Ask me anything to see a demo reply.', 'bot');

  formEl.addEventListener('submit', handleSubmit);
})();


