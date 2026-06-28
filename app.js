/* ==========================================
   app.js — 奇思妙想 · 语音记录
   模块：State / Speech / Render / Dialog / Events
   ========================================== */

// ==================== State 模块 ====================
const STORAGE_KEY = 'qisimiaoxiang_entries';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function addEntry(entry) {
  const entries = loadEntries();
  entries.unshift(entry);  // 最新在前
  saveEntries(entries);
}

function deleteEntry(id) {
  const entries = loadEntries();
  saveEntries(entries.filter(e => e.id !== id));
}

// ==================== Speech 模块 ====================
let recognition = null;
let recognitionSessionId = 0;  // 递增会话 ID，鉴定过期事件
let isSupported = false;

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  isSupported = !!SR;
}

function startRecording() {
  if (!isSupported) return false;

  // 清理上一个实例（abort 会触发 end 事件，sessionId 机制保证它被忽略）
  if (recognition) {
    try { recognition.abort(); } catch {}
    recognition = null;
  }

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new SR();
  rec.lang = 'zh-CN';
  rec.interimResults = false;
  rec.continuous = false;
  rec.maxAlternatives = 1;

  const sid = ++recognitionSessionId;   // 本次录音的唯一 ID

  rec.addEventListener('result', (e) => {
    if (sid !== recognitionSessionId) return;  // 过期事件，忽略
    handleSpeechResult(e);
  });
  rec.addEventListener('error', (e) => {
    if (sid !== recognitionSessionId) return;
    handleSpeechError(e);
  });
  rec.addEventListener('end', () => {
    if (sid !== recognitionSessionId) return;
    handleSpeechEnd();
  });

  recognition = rec;

  try {
    rec.start();
    return true;
  } catch (e) {
    console.error('语音启动失败:', e);
    recognition = null;
    return false;
  }
}

function stopRecording() {
  if (!recognition) return;
  try {
    recognition.stop();
  } catch {}
}

// ==================== Speech 事件处理 ====================
function handleSpeechResult(e) {
  try {
    const results = e.results;
    if (!results || !results.length) return;
    const transcript = (results[0][0].transcript || '').trim();
    if (!transcript) return;
    const status = document.getElementById('statusMsg');
    status.textContent = '';
    status.className = 'status-msg';
    // 强制先关闭可能残留的旧弹窗，再打开新的
    forceCloseDialog();
    showConfirmDialog(transcript).then((result) => {
      if (!result) return;
      addEntry({
        id: String(Date.now()),
        type: result.type,
        content: result.content,
        date: result.date,
        time: result.time,
        createdAt: getNow().iso,
      });
      renderCurrentFilter();
    });
  } catch (err) {
    console.error('handleSpeechResult 异常:', err);
    // 兜底：即使出错也尝试弹窗
    forceCloseDialog();
    showConfirmDialog('').then((result) => {
      if (!result) return;
      addEntry({
        id: String(Date.now()),
        type: result.type,
        content: result.content,
        date: result.date,
        time: result.time,
        createdAt: getNow().iso,
      });
      renderCurrentFilter();
    });
  }
}

function handleSpeechError(e) {
  const status = document.getElementById('statusMsg');
  const messages = {
    'no-speech': '未检测到语音，请再试一次',
    'audio-capture': '无法访问麦克风，请检查权限',
    'not-allowed': '麦克风权限未开启',
    'aborted': '',
  };
  const msg = messages[e.error] || '识别出错，请重试';
  if (msg) {
    status.textContent = msg;
    status.className = 'status-msg error';
  }
}

function handleSpeechEnd() {
  resetVoiceButton();
}

// ==================== 工具函数 ====================
function getNow() {
  const d = new Date();
  return {
    iso: d.toISOString(),
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    displayDate: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  };
}

// ==================== Render 模块 ====================
let currentFilter = 'all';

function filterEntries(filter) {
  currentFilter = filter;
  const entries = loadEntries();
  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);
  renderTable(filtered);
  updateTabs(filter);
}

function updateTabs(active) {
  document.querySelectorAll('.tab').forEach(t => {
    t.classList.toggle('active', t.dataset.filter === active);
  });
}

function renderTable(entries) {
  const tbody = document.getElementById('tableBody');
  const table = document.getElementById('entriesTable');
  const empty = document.getElementById('emptyState');

  if (entries.length === 0) {
    table.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  table.classList.remove('hidden');
  empty.classList.add('hidden');

  tbody.innerHTML = entries.map(e => `
    <tr data-id="${e.id}">
      <td class="date-cell">
        ${e.date.slice(5)}<br><span class="time">${e.time}</span>
      </td>
      <td><span class="type-badge ${e.type}">${e.type === 'idea' ? '💡 奇思妙想' : '📅 行程安排'}</span></td>
      <td class="content-cell">${escapeHtml(e.content)}</td>
      <td><button class="btn-delete" data-delete="${e.id}" title="删除">✕</button></td>
    </tr>
  `).join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==================== Dialog 模块 ====================
let activeDialogResolve = null;

function forceCloseDialog() {
  if (activeDialogResolve) {
    const r = activeDialogResolve;
    activeDialogResolve = null;
    r(null);  // 以 null 关闭旧弹窗
  }
}

function showConfirmDialog(text) {
  // 如果有旧弹窗开着，先关闭
  forceCloseDialog();

  return new Promise((resolve) => {
    activeDialogResolve = resolve;

    const overlay = document.getElementById('confirmDialog');
    const contentEl = document.getElementById('dialogContent');
    const typeEl = document.getElementById('dialogType');
    const dateEl = document.getElementById('dialogDate');
    const timeEl = document.getElementById('dialogTime');
    const cancelBtn = document.getElementById('dialogCancel');
    const confirmBtn = document.getElementById('dialogConfirm');

    const now = getNow();
    contentEl.value = text;
    typeEl.value = 'idea';
    dateEl.value = now.date;
    timeEl.value = now.time;

    // 强制显示（确保即使处于 hidden 状态也显示）
    overlay.classList.remove('hidden');
    // 短暂延迟确保 DOM 更新后再 focus（避免移动端键盘问题）
    setTimeout(() => {
      contentEl.focus();
      contentEl.setSelectionRange(contentEl.value.length, contentEl.value.length);
    }, 50);

    function cleanup(result) {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      overlay.removeEventListener('click', onOverlayClick);
      if (activeDialogResolve === resolve) {
        activeDialogResolve = null;
      }
      resolve(result);
    }

    function onCancel() { cleanup(null); }
    function onConfirm() {
      const content = contentEl.value.trim();
      if (!content) return;  // 空内容不保存——用户可以继续编辑
      cleanup({
        type: typeEl.value,
        content: content,
        date: dateEl.value,
        time: timeEl.value,
      });
    }
    function onOverlayClick(e) {
      if (e.target === overlay) cleanup(null);
    }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    overlay.addEventListener('click', onOverlayClick);
  });
}

// ==================== Events 模块 ====================
let isRecording = false;

function resetVoiceButton() {
  const btn = document.getElementById('voiceBtn');
  if (!btn || btn.classList.contains('hidden')) return;
  const mic = btn.querySelector('.mic-icon');
  const label = btn.querySelector('.btn-label');
  if (isRecording) {
    isRecording = false;
    btn.classList.remove('recording');
    mic.textContent = '🎤';
    label.textContent = '按住说话，松开识别';
  }
}

function setupVoiceButton() {
  const btn = document.getElementById('voiceBtn');
  const label = btn.querySelector('.btn-label');
  const mic = btn.querySelector('.mic-icon');
  const status = document.getElementById('statusMsg');

  function onStart(e) {
    e.preventDefault();
    if (!isSupported || isRecording) return;
    isRecording = true;
    btn.classList.add('recording');
    mic.textContent = '🔴';
    label.textContent = '正在聆听...';
    status.textContent = '';
    status.className = 'status-msg';
    const ok = startRecording();
    if (!ok) {
      // 启动失败，立刻还原状态
      resetVoiceButton();
      status.textContent = '语音启动失败，请重试';
      status.className = 'status-msg error';
    }
  }

  function onStop(e) {
    e.preventDefault();
    if (!isRecording) return;
    isRecording = false;
    btn.classList.remove('recording');
    mic.textContent = '🎤';
    label.textContent = '按住说话，松开识别';
    stopRecording();
  }

  // 鼠标
  btn.addEventListener('mousedown', onStart);
  btn.addEventListener('mouseup', onStop);
  btn.addEventListener('mouseleave', onStop);

  // 触屏
  btn.addEventListener('touchstart', onStart, { passive: false });
  btn.addEventListener('touchend', onStop, { passive: false });
  btn.addEventListener('touchcancel', onStop, { passive: false });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      filterEntries(tab.dataset.filter);
    });
  });
}

function setupDeleteButtons() {
  document.getElementById('tableBody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-delete]');
    if (!btn) return;
    const id = btn.dataset.delete;
    // 删除动画
    const row = btn.closest('tr');
    row.classList.add('removing');
    row.addEventListener('transitionend', () => {
      deleteEntry(id);
      renderCurrentFilter();
    }, { once: true });
  });
}

function setupManualInput() {
  const input = document.getElementById('manualInput');
  const addBtn = document.getElementById('manualAddBtn');

  addBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    showConfirmDialog(text).then((result) => {
      if (!result) return;
      const now = getNow();
      addEntry({
        id: String(Date.now()),
        type: result.type,
        content: result.content,
        date: result.date,
        time: result.time,
        createdAt: now.iso,
      });
      input.value = '';
      renderCurrentFilter();
    });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });
}

function renderCurrentFilter() {
  filterEntries(currentFilter);
}

// ==================== 初始化 ====================
function init() {
  initSpeech();
  renderCurrentFilter();
  setupVoiceButton();
  setupTabs();
  setupDeleteButtons();
  setupManualInput();

  if (isSupported) {
    // 支持语音：显示语音按钮
    document.getElementById('voiceBtn').classList.remove('hidden');
    document.getElementById('statusMsg').textContent = '也可以直接在下方输入框中输入';
    document.getElementById('statusMsg').className = 'status-msg';
  } else {
    // 不支持语音（iOS Safari 等）：隐藏语音按钮，仅用文字输入
    document.getElementById('voiceBtn').classList.add('hidden');
    document.getElementById('statusMsg').textContent = '📝 此浏览器不支持语音识别，请使用输入框';
    document.getElementById('statusMsg').className = 'status-msg error';
  }
}

document.addEventListener('DOMContentLoaded', init);
