(function() {
  var chatHistory = [];
  var isWaiting = false;

  function addChatMessage(role, content) {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message ' + role;

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerText = role === 'bot' ? 'SB' : 'You';

    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.innerText = content;

    div.appendChild(avatar);
    div.appendChild(bubble);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;

    return bubble;
  }

  function showTyping() {
    var container = document.getElementById('chatMessages');
    var div = document.createElement('div');
    div.className = 'chat-message bot';
    div.id = 'typingIndicator';

    var avatar = document.createElement('div');
    avatar.className = 'chat-avatar';
    avatar.innerText = 'SB';

    var typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.innerHTML = '<span></span><span></span><span></span>';

    div.appendChild(avatar);
    div.appendChild(typing);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('typingIndicator');
    if (el) el.remove();
  }

  async function sendMessage() {
    var input = document.getElementById('chatInput');
    var message = input.value.trim();
    if (!message || isWaiting) return;

    isWaiting = true;
    input.value = '';
    input.style.height = 'auto';

    addChatMessage('user', message);
    chatHistory.push({ role: 'user', content: message });

    showTyping();

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message, history: chatHistory })
      });

      var data = await response.json();

      hideTyping();

      if (data.error) {
        addChatMessage('bot', 'Maaf, terjadi kesalahan: ' + data.error);
      } else {
        addChatMessage('bot', data.reply);
        chatHistory.push({ role: 'assistant', content: data.reply });
      }
    } catch (err) {
      hideTyping();
      addChatMessage('bot', 'Koneksi gagal. Pastikan server berjalan dan coba lagi.');
    }

    isWaiting = false;
  }

  window.initChat = function() {
    var input = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSendBtn');

    if (!input || !sendBtn) return;

    sendBtn.addEventListener('click', sendMessage);

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    input.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
  };

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('chatMessages')) {
      initChat();
    }
  });
})();
