(function() {
  window.sanitizeInput = function(text) {
    var element = document.createElement('div');
    element.appendChild(document.createTextNode(text || ''));
    return element.innerHTML;
  };

  window.showTopSystemAlert = function(message) {
    var alertDiv = document.createElement('div');
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%)';
    alertDiv.style.background = '#fee2e2';
    alertDiv.style.color = '#991b1b';
    alertDiv.style.padding = '14px 24px';
    alertDiv.style.borderRadius = '10px';
    alertDiv.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    alertDiv.style.zIndex = '9999';
    alertDiv.style.fontWeight = '600';
    alertDiv.style.fontSize = '14px';
    alertDiv.style.border = '1px solid #fecaca';
    alertDiv.innerText = message;
    alertDiv.setAttribute('role', 'status');
    alertDiv.setAttribute('aria-live', 'polite');

    document.body.appendChild(alertDiv);
    setTimeout(function() { alertDiv.remove(); }, 3500);
  };

  window.createEl = function(tag, options, children) {
    options = options || {};
    children = children || [];
    var element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.text !== undefined) element.textContent = options.text;
    if (options.style) {
      if (typeof options.style === 'string') element.setAttribute('style', options.style);
      else Object.assign(element.style, options.style);
    }
    if (options.type) element.type = options.type;
    if (options.href) element.href = options.href;
    if (options.onClick) element.addEventListener('click', options.onClick);
    children.forEach(function(child) {
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return element;
  };

  window.clearElement = function(element) {
    if (!element) return;
    while (element.firstChild) element.removeChild(element.firstChild);
  };

  window.setChildren = function(element, children) {
    clearElement(element);
    children.forEach(function(child) {
      element.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
  };

  window.appendBr = function(element) {
    element.appendChild(document.createElement('br'));
  };

  window.appendInlineMarkdown = function(parent, text) {
    var pattern = /\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`/g;
    var lastIndex = 0;
    var match;

    while ((match = pattern.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parent.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      if (match[1]) {
        parent.appendChild(createEl('strong', { text: match[1] }));
      } else if (match[2]) {
        parent.appendChild(createEl('em', { text: match[2] }));
      } else if (match[3]) {
        parent.appendChild(createEl('code', { text: match[3] }));
      }

      lastIndex = pattern.lastIndex;
    }

    if (lastIndex < text.length) {
      parent.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
  };

  window.renderMarkdownMessage = function(element, content) {
    clearElement(element);
    var lines = String(content || '').replace(/\r\n/g, '\n').split('\n');
    var paragraphLines = [];
    var list = null;

    function flushParagraph() {
      if (paragraphLines.length === 0) return;
      var p = createEl('p');
      appendInlineMarkdown(p, paragraphLines.join(' '));
      element.appendChild(p);
      paragraphLines = [];
    }

    function flushList() {
      if (!list) return;
      element.appendChild(list);
      list = null;
    }

    lines.forEach(function(line) {
      var trimmed = line.trim();
      var listMatch = trimmed.match(/^[-*]\s+(.+)$/);
      var numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

      if (!trimmed) {
        flushParagraph();
        flushList();
        return;
      }

      if (listMatch || numberedMatch) {
        flushParagraph();
        if (!list) list = createEl(numberedMatch ? 'ol' : 'ul');
        var li = createEl('li');
        appendInlineMarkdown(li, listMatch ? listMatch[1] : numberedMatch[1]);
        list.appendChild(li);
        return;
      }

      flushList();
      paragraphLines.push(trimmed.replace(/^#{1,6}\s+/, ''));
    });

    flushParagraph();
    flushList();
  };
})();
