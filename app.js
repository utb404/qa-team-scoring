'use strict';

/* ---------- Состояние ---------- */

const state = {
  projectName: '',
  assessmentDate: '',
  answers: Object.create(null) // itemId -> true
};

let radarChart = null;

/* ---------- Утилиты ---------- */

function itemId(levelId, blockId, index) {
  return 'L' + levelId + '-' + blockId + '-' + index;
}

function todayISO() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now - tz).toISOString().slice(0, 10);
}

function formatDateRu(iso) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return parts[2] + '.' + parts[1] + '.' + parts[0];
}

function pct(value) {
  return Math.round(value * 100);
}

/* ---------- Расчет метрик ---------- */

function levelStats(levelId, blockId) {
  const level = LEVELS.find(function (l) { return l.id === levelId; });
  const items = level.blocks[blockId];
  let done = 0;
  items.forEach(function (item, index) {
    if (state.answers[itemId(levelId, blockId, index)]) done += 1;
  });
  const ratio = items.length ? done / items.length : 1;
  return {
    levelId: levelId,
    total: items.length,
    done: done,
    ratio: ratio,
    achieved: ratio >= THRESHOLD
  };
}

function blockStats(blockId) {
  const levels = LEVELS.map(function (level) {
    return levelStats(level.id, blockId);
  });

  // Уровень зрелости блока: максимальный уровень, для которого достигнуты
  // все уровни начиная с первого (пороговое значение 80% пунктов).
  let maturity = 0;
  for (let i = 0; i < levels.length; i += 1) {
    if (levels[i].achieved) maturity = levels[i].levelId;
    else break;
  }

  const total = levels.reduce(function (sum, l) { return sum + l.total; }, 0);
  const done = levels.reduce(function (sum, l) { return sum + l.done; }, 0);

  return {
    blockId: blockId,
    levels: levels,
    maturity: maturity,
    total: total,
    done: done,
    ratio: total ? done / total : 0
  };
}

function computeResults() {
  const blocks = BLOCKS.map(function (block) { return blockStats(block.id); });
  const overall = blocks.reduce(function (min, b) {
    return Math.min(min, b.maturity);
  }, 5);
  return { blocks: blocks, overall: overall };
}

/* ---------- Отрисовка чек-листа ---------- */

function buildChecklist() {
  const root = document.getElementById('checklist');
  const fragment = document.createDocumentFragment();

  LEVELS.forEach(function (level) {
    const section = document.createElement('section');
    section.className = 'level';

    const heading = document.createElement('h3');
    heading.className = 'level__title';
    heading.textContent = level.title;
    section.appendChild(heading);

    const table = document.createElement('table');
    table.className = 'grid';

    const thead = document.createElement('thead');
    thead.innerHTML =
      '<tr>' +
      '<th class="grid__col-criterion">Что оцениваем</th>' +
      '<th class="grid__col-check">Как проверяем</th>' +
      '<th class="grid__col-status">Текущий статус</th>' +
      '</tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    BLOCKS.forEach(function (block) {
      const items = level.blocks[block.id];

      const blockRow = document.createElement('tr');
      blockRow.className = 'grid__block-row';

      const blockCell = document.createElement('th');
      blockCell.colSpan = 2;
      blockCell.className = 'grid__block-title';
      blockCell.textContent = block.title;
      blockRow.appendChild(blockCell);

      const selectAllCell = document.createElement('td');
      selectAllCell.className = 'grid__select-all';
      const selectAllLabel = document.createElement('label');
      const selectAll = document.createElement('input');
      selectAll.type = 'checkbox';
      selectAll.dataset.selectAll = level.id + ':' + block.id;
      selectAllLabel.appendChild(selectAll);
      selectAllLabel.appendChild(document.createTextNode('Выбрать все'));
      selectAllCell.appendChild(selectAllLabel);
      blockRow.appendChild(selectAllCell);

      tbody.appendChild(blockRow);

      items.forEach(function (item, index) {
        const id = itemId(level.id, block.id, index);
        const row = document.createElement('tr');
        row.dataset.itemRow = id;

        const criterion = document.createElement('td');
        criterion.className = 'grid__criterion';
        criterion.textContent = item.criterion;
        row.appendChild(criterion);

        const check = document.createElement('td');
        check.className = 'grid__check';
        check.textContent = item.check;
        row.appendChild(check);

        const status = document.createElement('td');
        status.className = 'grid__status';
        const box = document.createElement('input');
        box.type = 'checkbox';
        box.id = id;
        box.dataset.item = id;
        box.setAttribute('aria-label', item.check.split('\n')[0]);
        status.appendChild(box);
        row.appendChild(status);

        tbody.appendChild(row);
      });
    });

    table.appendChild(tbody);
    section.appendChild(table);
    fragment.appendChild(section);
  });

  root.appendChild(fragment);
}

/* ---------- Отрисовка результатов ---------- */

function renderSummary(results) {
  const overall = document.getElementById('overall');
  overall.querySelector('.summary__value').textContent = results.overall;
  overall.querySelector('.summary__label').textContent = LEVEL_NAMES[results.overall];
  overall.dataset.level = String(results.overall);

  const cards = document.getElementById('block-cards');
  cards.innerHTML = '';

  results.blocks.forEach(function (block) {
    const meta = BLOCKS.find(function (b) { return b.id === block.blockId; });
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.level = String(block.maturity);

    const title = document.createElement('h3');
    title.className = 'card__title';
    title.textContent = meta.title;
    card.appendChild(title);

    const value = document.createElement('p');
    value.className = 'card__value';
    value.innerHTML =
      '<span class="card__level">' + block.maturity + '</span>' +
      '<span class="card__level-name">' + LEVEL_NAMES[block.maturity] + '</span>';
    card.appendChild(value);

    const totals = document.createElement('p');
    totals.className = 'card__totals';
    totals.textContent =
      'Отмечено ' + block.done + ' из ' + block.total + ' пунктов (' + pct(block.ratio) + '%)';
    card.appendChild(totals);

    const list = document.createElement('ul');
    list.className = 'card__levels';

    block.levels.forEach(function (level) {
      const li = document.createElement('li');
      li.className = 'card__level-row' + (level.achieved ? ' is-achieved' : '');

      const name = document.createElement('span');
      name.className = 'card__level-label';
      name.textContent = level.levelId + '. ' + LEVEL_NAMES[level.levelId];
      li.appendChild(name);

      const bar = document.createElement('span');
      bar.className = 'bar';
      const fill = document.createElement('span');
      fill.className = 'bar__fill';
      fill.style.width = pct(level.ratio) + '%';
      bar.appendChild(fill);
      li.appendChild(bar);

      const num = document.createElement('span');
      num.className = 'card__level-num';
      num.textContent = level.done + '/' + level.total + ' (' + pct(level.ratio) + '%)';
      li.appendChild(num);

      const mark = document.createElement('span');
      mark.className = 'card__level-mark';
      mark.textContent = level.achieved ? 'достигнут' : 'нет';
      li.appendChild(mark);

      list.appendChild(li);
    });

    card.appendChild(list);
    cards.appendChild(card);
  });
}

/** Длинные подписи осей разбиваются на строки, иначе радар сжимается. */
function wrapLabel(text, maxChars) {
  const lines = [];
  let line = '';
  text.split(' ').forEach(function (word) {
    if (line && (line + ' ' + word).length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + ' ' + word : word;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function renderChart(results) {
  const labels = BLOCKS.map(function (b) { return wrapLabel(b.title, 18); });
  const data = results.blocks.map(function (b) { return b.maturity; });

  if (radarChart) {
    radarChart.data.datasets[0].data = data;
    radarChart.update();
    return;
  }

  const canvas = document.getElementById('radar');
  if (typeof Chart === 'undefined') {
    document.getElementById('chart-fallback').hidden = false;
    canvas.hidden = true;
    return;
  }

  radarChart = new Chart(canvas.getContext('2d'), {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Уровень зрелости',
        data: data,
        fill: true,
        backgroundColor: 'rgba(37, 99, 235, 0.18)',
        borderColor: 'rgba(37, 99, 235, 0.9)',
        borderWidth: 2,
        pointBackgroundColor: 'rgba(37, 99, 235, 1)',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        r: {
          min: 0,
          max: 5,
          ticks: { stepSize: 1, backdropColor: 'transparent' },
          pointLabels: { font: { size: 12 } },
          grid: { color: 'rgba(15, 23, 42, 0.12)' },
          angleLines: { color: 'rgba(15, 23, 42, 0.12)' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return 'Уровень ' + ctx.parsed.r + ' (' + LEVEL_NAMES[ctx.parsed.r] + ')';
            }
          }
        }
      }
    }
  });
}

function render() {
  const results = computeResults();
  renderSummary(results);
  renderChart(results);
  return results;
}

/* ---------- Синхронизация формы и состояния ---------- */

function syncSelectAllBoxes() {
  const boxes = document.querySelectorAll('[data-select-all]');
  boxes.forEach(function (box) {
    const parts = box.dataset.selectAll.split(':');
    const levelId = Number(parts[0]);
    const blockId = parts[1];
    const stats = levelStats(levelId, blockId);
    box.checked = stats.total > 0 && stats.done === stats.total;
    box.indeterminate = stats.done > 0 && stats.done < stats.total;
  });
}

function applyStateToForm() {
  document.getElementById('project-name').value = state.projectName;
  document.getElementById('assessment-date').value = state.assessmentDate;

  document.querySelectorAll('[data-item]').forEach(function (box) {
    const checked = Boolean(state.answers[box.dataset.item]);
    box.checked = checked;
    const row = box.closest('tr');
    if (row) row.classList.toggle('is-done', checked);
  });

  syncSelectAllBoxes();
  render();
}

function setAnswer(id, checked) {
  if (checked) state.answers[id] = true;
  else delete state.answers[id];
}

/* ---------- Экспорт и импорт JSON ---------- */

function sanitizeFileName(name) {
  const cleaned = String(name || '').trim().replace(/[^\wА-Яа-яЁё\-. ]+/g, '').replace(/\s+/g, '_');
  return cleaned || 'qa-scoring';
}

function buildExportPayload() {
  const results = computeResults();
  return {
    schema: 'qa-team-scoring',
    schemaVersion: 1,
    templateVersion: TEMPLATE_VERSION,
    exportedAt: new Date().toISOString(),
    projectName: state.projectName,
    assessmentDate: state.assessmentDate,
    answers: Object.assign({}, state.answers),
    results: {
      overallMaturity: results.overall,
      blocks: results.blocks.map(function (block) {
        const meta = BLOCKS.find(function (b) { return b.id === block.blockId; });
        return {
          id: block.blockId,
          title: meta.title,
          maturity: block.maturity,
          checkedItems: block.done,
          totalItems: block.total,
          levels: block.levels.map(function (level) {
            return {
              level: level.levelId,
              checkedItems: level.done,
              totalItems: level.total,
              percent: pct(level.ratio),
              achieved: level.achieved
            };
          })
        };
      })
    }
  };
}

function exportJSON() {
  const payload = buildExportPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download =
    'qa-scoring_' + sanitizeFileName(state.projectName) + '_' + (state.assessmentDate || todayISO()) + '.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showStatus('Файл выгружен: ' + link.download, 'ok');
}

function knownItemIds() {
  const ids = new Set();
  LEVELS.forEach(function (level) {
    BLOCKS.forEach(function (block) {
      level.blocks[block.id].forEach(function (_, index) {
        ids.add(itemId(level.id, block.id, index));
      });
    });
  });
  return ids;
}

function importPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Файл не содержит объект с данными оценки.');
  }
  if (payload.schema && payload.schema !== 'qa-team-scoring') {
    throw new Error('Неизвестный формат файла: ' + payload.schema);
  }
  if (!payload.answers || typeof payload.answers !== 'object') {
    throw new Error('В файле нет раздела answers.');
  }

  const known = knownItemIds();
  const answers = Object.create(null);
  let skipped = 0;

  Object.keys(payload.answers).forEach(function (id) {
    if (!known.has(id)) {
      skipped += 1;
      return;
    }
    if (payload.answers[id] === true) answers[id] = true;
  });

  state.projectName = typeof payload.projectName === 'string' ? payload.projectName : '';
  state.assessmentDate = /^\d{4}-\d{2}-\d{2}$/.test(payload.assessmentDate)
    ? payload.assessmentDate
    : todayISO();
  state.answers = answers;

  applyStateToForm();

  const notes = [];
  if (payload.templateVersion && payload.templateVersion !== TEMPLATE_VERSION) {
    notes.push('файл собран по шаблону v' + payload.templateVersion + ', текущий шаблон v' + TEMPLATE_VERSION);
  }
  if (skipped) {
    notes.push('пропущено пунктов, отсутствующих в шаблоне: ' + skipped);
  }

  const base = 'Оценка загружена' + (state.projectName ? ': ' + state.projectName : '');
  showStatus(notes.length ? base + ' (' + notes.join('; ') + ')' : base, notes.length ? 'warn' : 'ok');
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = function () {
    try {
      importPayload(JSON.parse(String(reader.result)));
    } catch (error) {
      showStatus('Не удалось загрузить файл. ' + error.message, 'error');
    }
  };
  reader.onerror = function () {
    showStatus('Не удалось прочитать файл.', 'error');
  };
  reader.readAsText(file, 'utf-8');
}

/* ---------- Статусная строка ---------- */

let statusTimer = null;

function showStatus(message, kind) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.dataset.kind = kind || 'ok';
  el.hidden = false;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(function () {
    el.hidden = true;
  }, 8000);
}

/* ---------- Обработчики ---------- */

function attachHandlers() {
  document.getElementById('project-name').addEventListener('input', function (event) {
    state.projectName = event.target.value;
  });

  document.getElementById('assessment-date').addEventListener('change', function (event) {
    state.assessmentDate = event.target.value;
  });

  document.getElementById('checklist').addEventListener('change', function (event) {
    const target = event.target;

    if (target.dataset.item) {
      setAnswer(target.dataset.item, target.checked);
      const row = target.closest('tr');
      if (row) row.classList.toggle('is-done', target.checked);
      syncSelectAllBoxes();
      render();
      return;
    }

    if (target.dataset.selectAll) {
      const parts = target.dataset.selectAll.split(':');
      const levelId = Number(parts[0]);
      const blockId = parts[1];
      const level = LEVELS.find(function (l) { return l.id === levelId; });

      level.blocks[blockId].forEach(function (_, index) {
        const id = itemId(levelId, blockId, index);
        setAnswer(id, target.checked);
        const box = document.querySelector('[data-item="' + id + '"]');
        if (box) {
          box.checked = target.checked;
          const row = box.closest('tr');
          if (row) row.classList.toggle('is-done', target.checked);
        }
      });

      syncSelectAllBoxes();
      render();
    }
  });

  document.getElementById('export').addEventListener('click', exportJSON);

  document.getElementById('import').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', function (event) {
    const file = event.target.files && event.target.files[0];
    if (file) importFile(file);
    event.target.value = '';
  });

  document.getElementById('reset').addEventListener('click', function () {
    state.projectName = '';
    state.assessmentDate = todayISO();
    state.answers = Object.create(null);
    applyStateToForm();
    showStatus('Форма очищена.', 'ok');
  });

  document.getElementById('print').addEventListener('click', function () {
    window.print();
  });
}

/* ---------- Старт ---------- */

function init() {
  document.getElementById('template-version').textContent = TEMPLATE_VERSION;
  state.assessmentDate = todayISO();
  buildChecklist();
  attachHandlers();
  applyStateToForm();
}

document.addEventListener('DOMContentLoaded', init);
