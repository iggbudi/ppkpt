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

    document.body.appendChild(alertDiv);
    setTimeout(function() { alertDiv.remove(); }, 3500);
  };
})();
