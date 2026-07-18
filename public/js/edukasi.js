(function() {
  var scenarios = [];
  var scenariosLoaded = false;

  var STORAGE_KEY = 'safesphere_edu_progress';
  var currentScenarioScore = 0;

  function getProgress() {
    var progress = { completed: [], totalXP: 0, scenarioScores: {} };
    try {
      var data = localStorage.getItem(STORAGE_KEY);
      if (!data) return progress;

      var stored = JSON.parse(data);
      if (Array.isArray(stored.completed)) progress.completed = stored.completed;
      if (typeof stored.totalXP === 'number') progress.totalXP = stored.totalXP;
      if (stored.scenarioScores && typeof stored.scenarioScores === 'object') {
        progress.scenarioScores = stored.scenarioScores;
      }
    } catch (e) {}
    return progress;
  }

  function saveProgress(scenarioId, scoreBonus) {
    var progress = getProgress();
    if (progress.completed.indexOf(scenarioId) === -1) {
      progress.completed.push(scenarioId);
      var bonus = (typeof scoreBonus === 'number') ? Math.max(0, Math.floor(scoreBonus / 2)) : 0;
      progress.totalXP += 20 + bonus;
      if (typeof scoreBonus === 'number') {
        progress.scenarioScores[scenarioId] = scoreBonus;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      } catch (e) {}
    }
    return progress;
  }

  function isScenarioCompleted(scenarioId) {
    return getProgress().completed.indexOf(scenarioId) !== -1;
  }

  function getCompletedCount() {
    return getProgress().completed.length;
  }

  function renderProgressBar() {
    var bar = document.getElementById('eduProgressBar');
    var text = document.getElementById('eduProgressText');
    var badge = document.getElementById('eduChampionBadge');
    if (!bar || !text) return;

    var progress = getProgress();
    var completed = getCompletedCount();
    var total = scenarios.length;
    var pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    bar.style.width = pct + '%';
    text.textContent = completed + '/' + total + ' skenario selesai (XP: ' + progress.totalXP + ')';

    if (badge) {
      if (total > 0 && completed >= total) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }
  }

  function updateScenarioScoreDisplay() {
    var el = document.getElementById('scenarioCurrentScore');
    if (el) el.textContent = currentScenarioScore;
  }

  function renderTrustedFeedback(element, feedback) {
    clearElement(element);
    if (!feedback) return;

    if (typeof feedback === 'string') {
      var legacy = String(feedback).match(/^<strong>(.*?)<\/strong>\s*(.*)$/);
      if (legacy) {
        element.appendChild(createEl('strong', { text: legacy[1] }));
        if (legacy[2]) element.appendChild(document.createTextNode(' ' + legacy[2]));
      } else {
        element.textContent = String(feedback).replace(/<[^>]+>/g, '');
      }
      return;
    }

    if (feedback.title) {
      element.appendChild(createEl('strong', { text: feedback.title }));
      if (feedback.message) element.appendChild(document.createTextNode(' ' + feedback.message));
    } else if (feedback.message) {
      element.textContent = feedback.message;
    }
  }

  function renderScenarioList() {
    var listEl = document.getElementById('scenarioList');
    var detailEl = document.getElementById('scenarioDetail');
    if (!listEl || !detailEl) return;

    listEl.classList.remove('hidden');
    detailEl.classList.add('hidden');
    clearElement(listEl);

    if (!scenariosLoaded) {
      listEl.appendChild(createEl('p', {
        className: 'muted',
        style: 'text-align:center; padding:20px;',
        text: 'Memuat skenario edukasi...'
      }));
      return;
    }

    if (scenarios.length === 0) {
      listEl.appendChild(createEl('p', {
        className: 'muted',
        style: 'text-align:center; padding:20px;',
        text: 'Skenario edukasi belum tersedia.'
      }));
      return;
    }

    scenarios.forEach(function(scenario, index) {
      var completed = isScenarioCompleted(scenario.id);
      var card = createEl('div', { className: 'scenario-card' + (completed ? ' completed' : '') });

      card.appendChild(createEl('div', { className: 'scenario-card-header' }, [
        createEl('span', { className: 'scenario-number', text: String(index + 1) }),
        createEl('span', {
          className: 'scenario-status ' + (completed ? 'status-done' : 'status-new'),
          text: completed ? 'Selesai' : 'Belum'
        })
      ]));
      card.appendChild(createEl('h4', { className: 'scenario-card-title', text: scenario.title }));
      card.appendChild(createEl('p', { className: 'scenario-card-desc', text: scenario.description }));
      if (completed) {
        card.appendChild(createEl('div', { className: 'scenario-badge-earned', text: scenario.badge }));
        var sc = getProgress().scenarioScores && getProgress().scenarioScores[scenario.id];
        if (typeof sc === 'number') {
          card.appendChild(createEl('div', { style: 'font-size:11px; color:var(--primary); margin-top:4px;', text: 'Skor: ' + sc }));
        }
      }

      card.onclick = function() { loadScenario(scenario.id); };
      listEl.appendChild(card);
    });
  }

  function findScenario(scenarioId) {
    for (var i = 0; i < scenarios.length; i++) {
      if (scenarios[i].id === scenarioId) return scenarios[i];
    }
    return null;
  }

  function loadScenario(scenarioId) {
    var scenario = findScenario(scenarioId);
    if (!scenario) return;

    var listEl = document.getElementById('scenarioList');
    var detailEl = document.getElementById('scenarioDetail');
    var detailTitle = document.getElementById('scenarioDetailTitle');
    var backBtn = document.getElementById('scenarioBackBtn');

    if (listEl) listEl.classList.add('hidden');
    if (detailEl) detailEl.classList.remove('hidden');
    if (detailTitle) detailTitle.textContent = scenario.title;
    if (backBtn) backBtn.onclick = function() { renderScenarioList(); renderProgressBar(); };
    if (detailEl) detailEl.setAttribute('data-scenario-id', scenarioId);

    currentScenarioScore = 0;
    updateScenarioScoreDisplay();
    renderStoryNode(scenarioId, 'start');
  }

  function renderStoryNode(scenarioId, nodeId) {
    if (nodeId === '_back') {
      currentScenarioScore = 0;
      renderScenarioList();
      renderProgressBar();
      return;
    }

    var scenario = findScenario(scenarioId);
    if (!scenario) return;

    var node = scenario.nodes[nodeId];
    if (!node) return;

    var textEl = document.getElementById('gameText');
    var optionsEl = document.getElementById('gameOptions');
    var feedbackEl = document.getElementById('gameFeedback');
    var sceneEl = document.getElementById('gameScene');
    if (!textEl || !optionsEl || !feedbackEl || !sceneEl) return;

    if (node.feedback && node.feedback.type === 'success') {
      saveProgress(scenarioId, currentScenarioScore);
      renderProgressBar();
    }

    sceneEl.classList.add('is-fading');

    setTimeout(function() {
      textEl.textContent = node.text;
      clearElement(optionsEl);

      node.options.forEach(function(opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = opt.text;
        if (opt.isSuccess === true) btn.className = 'quiz-option-success';
        if (opt.isRestart) btn.className = 'quiz-option-restart';
        btn.onclick = function() {
          if (typeof opt.scoreDelta === 'number') {
            currentScenarioScore += opt.scoreDelta;
            updateScenarioScoreDisplay();
          }
          if (opt.isSuccess === true) {
            saveProgress(scenarioId, currentScenarioScore);
            renderProgressBar();
          }
          renderStoryNode(scenarioId, opt.nextNode);
        };
        optionsEl.appendChild(btn);
      });

      if (node.feedback) {
        feedbackEl.className = 'result ' + node.feedback.type;
        renderTrustedFeedback(feedbackEl, node.feedback);
        feedbackEl.classList.remove('hidden');
      } else {
        feedbackEl.className = 'result hidden';
        clearElement(feedbackEl);
      }

      sceneEl.classList.remove('is-fading');
    }, 300);
  }

  function loadScenarios() {
    return fetch('/edukasi/scenarios.json')
      .then(function(response) {
        if (!response.ok) throw new Error('Gagal memuat skenario');
        return response.json();
      })
      .then(function(data) {
        scenarios = Array.isArray(data.scenarios) ? data.scenarios : [];
        scenariosLoaded = true;
        renderProgressBar();
        renderScenarioList();
      })
      .catch(function() {
        scenarios = [];
        scenariosLoaded = true;
        renderProgressBar();
        renderScenarioList();
      });
  }

  window.renderStoryNode = renderStoryNode;
  window.loadScenario = loadScenario;
  window.renderScenarioList = renderScenarioList;
  window.renderProgressBar = renderProgressBar;

  document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('scenarioList') || document.getElementById('gamificationContainer')) {
      loadScenarios();
    }
  });
})();