(function() {
  var chatHistory = [];
  var isWaiting = false;

  function addChatMessage(content, sender, actions) {
    var container = document.getElementById('chatMessages');
    if (!container) return;

    var message = createEl('div', { className: 'chat-message ' + sender });

    if (sender === 'bot') {
      renderMarkdownMessage(message, content);
    } else {
      message.textContent = content;
    }

    if (actions && actions.length > 0) {
      var actionsDiv = createEl('div', { className: 'chat-message-actions' });
      actions.forEach(function(action) {
        var btn = createEl('a', {
          className: action.className || 'btn primary',
          href: action.href || '#',
          text: action.text || 'Action'
        });
        actionsDiv.appendChild(btn);
      });
      message.appendChild(actionsDiv);
    }

    container.appendChild(message);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    var container = document.getElementById('chatMessages');
    if (!container || document.getElementById('chatTypingIndicator')) return;

    var indicator = createEl('div', { className: 'chat-message bot typing' }, [
      createEl('span'),
      createEl('span'),
      createEl('span'),
      ' SafeBot sedang mengetik...'
    ]);
    indicator.id = 'chatTypingIndicator';
    container.appendChild(indicator);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    var el = document.getElementById('chatTypingIndicator');
    if (el) el.remove();
  }

  async function sendMessage() {
    var input = document.getElementById('chatInput');
    if (!input || isWaiting) return;

    var message = input.value.trim();
    if (!message) return;

    isWaiting = true;
    input.value = '';
    input.style.height = 'auto';
    input.readOnly = true;

    var sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.innerText = 'Mengirim...';
    }

    addChatMessage(message, 'user');
    chatHistory.push({ role: 'user', content: message });

    showTyping();

    try {
      var response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message
        })
      });

      var data = await response.json();

      hideTyping();

      if (!response.ok) {
        if (response.status === 429 && data && data.message) {
          addChatMessage(data.message, 'bot');
        } else {
          addChatMessage('Maaf, lagi ada gangguan. Coba lagi sebentar ya.', 'bot');
        }
      } else {
        addChatMessage(data.reply, 'bot', data.actions || []);
        chatHistory.push({ role: 'assistant', content: data.reply });
      }
    } catch (err) {
      hideTyping();

      var riskScore = getRiskScore(message);
      if (riskScore.score >= 5 || riskScore.foundHighRisk) {
        addChatMessage('Maaf, SafeBot lagi nggak bisa dihubungi. Dari pesanmu, situasinya mungkin darurat. Cari tempat aman dulu, lalu hubungi kontak darurat kampus atau orang yang kamu percaya.', 'bot', [
          { href: '#kontak', text: 'Kontak darurat', className: 'btn danger' },
          { href: '#lapor', text: 'Buat laporan', className: 'btn primary' }
        ]);
      } else {
        addChatMessage('Maaf, SafeBot lagi nggak bisa dihubungi. Kalau darurat, segera hubungi kontak kampus atau orang terpercaya di sekitarmu.', 'bot');
      }
    }

    input.readOnly = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerText = 'Kirim';
    }
    isWaiting = false;
  }

  window.initChat = function() {
    var input = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSendBtn');

    if (!input || !sendBtn) return;

    var consentAccept = document.getElementById('consentAccept');
    var chatConsent = document.getElementById('chatConsent');
    var chatContainer = document.querySelector('.chat-container');

    if (sessionStorage.getItem('chatConsent')) {
      if (chatConsent) chatConsent.classList.add('hidden');
      if (chatContainer) chatContainer.classList.remove('hidden');
    } else {
      if (chatContainer) chatContainer.classList.add('hidden');
    }

    if (consentAccept) {
      consentAccept.addEventListener('click', function() {
        sessionStorage.setItem('chatConsent', 'true');
        if (chatConsent) chatConsent.classList.add('hidden');
        if (chatContainer) chatContainer.classList.remove('hidden');
      });
    }

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
