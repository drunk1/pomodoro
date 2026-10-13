
const DURATIONS = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60
};

const MODE_LABELS = {
  focus: 'TIME TO FOCUS',
  short: 'SHORT BREAK',
  long: 'LONG BREAK'
};

const MODE_HINTS = {
  focus: 'Один шаг за раз',
  short: 'Немного передохни',
  long: 'Ты заслужила отдых'
};

const STORAGE_KEY = 'focus-timer-data-v1';

const $ = (selector) => document.querySelector(selector);

const timerDisplay = $('#timer');
const timerLabel = $('#timer-label');
const timerHint = $('#timer-hint');
const startButton = $('#start');
const progressCircle = $('#progress');
const taskForm = $('#task-form');
const taskInput = $('#task-input');
const taskList = $('#task-list');
const emptyState = $('#empty-state');

let mode = 'focus';
let remaining = DURATIONS.focus;
let intervalId = null;
let endTime = null;

function todayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultData() {
  return {
    tasks: [],
    selectedTaskId: null,
    dailyStats: {},
    completedTaskIds: []
  };
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createDefaultData();

    const parsed = JSON.parse(saved);

    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      selectedTaskId: parsed.selectedTaskId ?? null,
      dailyStats: parsed.dailyStats && typeof parsed.dailyStats === 'object'
        ? parsed.dailyStats : {},
      completedTaskIds: Array.isArray(parsed.completedTaskIds)
        ? parsed.completedTaskIds : []
    };
  } catch {
    return createDefaultData();
  }
}

let data = loadData();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Не удалось сохранить данные в браузере.', error);
  }
}

function getTodayStats() {
  if (!data.dailyStats[todayKey()]) {
    data.dailyStats[todayKey()] = {
      sessions: 0,
      minutes: 0
    };
  }

  return data.dailyStats[todayKey()];
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  timerDisplay.textContent = formatTime(remaining);
  timerLabel.textContent = MODE_LABELS[mode];
  timerHint.textContent = MODE_HINTS[mode];

  const progress = 1 - remaining / DURATIONS[mode];
  const circumference = 2 * Math.PI * 116;

  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference * progress;

  startButton.innerHTML = intervalId
    ? 'Пауза <span>Ⅱ</span>'
    : remaining === DURATIONS[mode]
      ? 'Начать фокус <span>→</span>'
      : 'Продолжить <span>→</span>';

  document.title = `${formatTime(remaining)} — Focus Timer`;
}

function stopTimer() {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }

  endTime = null;
  updateTimerDisplay();
}

function setMode(nextMode) {
  stopTimer();
  mode = nextMode;
  remaining = DURATIONS[mode];

  document.querySelectorAll('.mode').forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });

  updateTimerDisplay();
}

function completeSession() {
  stopTimer();

  if (mode === 'focus') {
    const stats = getTodayStats();
    stats.sessions += 1;
    stats.minutes += DURATIONS.focus / 60;
    saveData();
    renderStats();

    timerHint.textContent = 'Отличная работа! Сессия завершена.';
    alert('Фокус-сессия завершена! Отличная работа 🍅');
  } else {
    timerHint.textContent = 'Перерыв завершён. Готова продолжать?';
    alert('Перерыв завершён! Можно возвращаться к делам.');
  }

  remaining = 0;
  updateTimerDisplay();
  startButton.innerHTML = 'Начать заново <span>→</span>';
}

function tick() {
  if (endTime === null) return;

  remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
  updateTimerDisplay();

  if (remaining <= 0) {
    completeSession();
  }
}

function startTimer() {
  if (intervalId !== null) {
    stopTimer();
    return;
  }

  if (remaining <= 0) {
    remaining = DURATIONS[mode];
  }

  endTime = Date.now() + remaining * 1000;
  intervalId = setInterval(tick, 200);
  updateTimerDisplay();
}

function resetTimer() {
  stopTimer();
  remaining = DURATIONS[mode];
  updateTimerDisplay();
}

function skipMode() {
  const nextMode = mode === 'focus'
    ? 'short'
    : mode === 'short'
      ? 'long'
      : 'focus';

  setMode(nextMode);
}

function renderTasks() {
  taskList.replaceChildren();

  const unfinishedTasks = data.tasks.filter((task) => !task.completed);
  const finishedTasks = data.tasks.filter((task) => task.completed);
  const sortedTasks = [...unfinishedTasks, ...finishedTasks];

  sortedTasks.forEach((task) => {
    const item = document.createElement('li');
    item.className = 'task-item';
    if (task.completed) item.classList.add('completed');
    if (task.id === data.selectedTaskId) item.classList.add('selected');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('aria-label', `Выполнена: ${task.text}`);

    checkbox.addEventListener('change', () => {
      task.completed = checkbox.checked;

      if (task.completed && task.id === data.selectedTaskId) {
        data.selectedTaskId = null;
      }

      saveData();
      renderTasks();
      renderStats();
    });

    const name = document.createElement('span');
    name.className = 'task-name';
    name.textContent = task.text;

    item.append(checkbox, name);

    if (!task.completed) {
      const selectButton = document.createElement('button');
      selectButton.className = 'select-task';
      selectButton.textContent = task.id === data.selectedTaskId
        ? 'В фокусе' : 'Выбрать';

      selectButton.setAttribute('aria-pressed', String(task.id === data.selectedTaskId));

      selectButton.addEventListener('click', () => {
        data.selectedTaskId = task.id === data.selectedTaskId
          ? null : task.id;
        saveData();
        renderTasks();
      });

      item.append(selectButton);
    }

    const deleteButton = document.createElement('button');
    deleteButton.className = 'delete-task';
    deleteButton.textContent = '×';
    deleteButton.setAttribute('aria-label', `Удалить: ${task.text}`);

    deleteButton.addEventListener('click', () => {
      data.tasks = data.tasks.filter((item) => item.id !== task.id);

      if (data.selectedTaskId === task.id) {
        data.selectedTaskId = null;
      }

      data.completedTaskIds = data.completedTaskIds.filter((id) => id !== task.id);

      saveData();
      renderTasks();
      renderStats();
    });

    item.append(deleteButton);
    taskList.append(item);
  });

  emptyState.hidden = data.tasks.length > 0;

  $('#task-count').textContent = String(unfinishedTasks.length);

  const completed = data.tasks.filter((task) => task.completed).length;
  const total = data.tasks.length;
  const percentage = total ? (completed / total) * 100 : 0;

  $('#task-progress-text').textContent = `${completed} из ${total}`;
  $('#task-progress').style.width = `${percentage}%`;
}

function renderStats() {
  const stats = getTodayStats();
  const completedTasks = data.tasks.filter((task) => task.completed).length;

  $('#session-count').textContent = String(stats.sessions);
  $('#stat-minutes').textContent = String(stats.minutes);
  $('#stat-sessions').textContent = String(stats.sessions);
  $('#stat-tasks').textContent = String(completedTasks);

  $('#stats-date').textContent = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long'
  }).format(new Date());
}

taskForm.addEventListener('submit', (event) => {
  event.preventDefault();

  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    return;
  }

  const task = {
    id: crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`,
    text,
    completed: false
  };

  data.tasks.push(task);
  data.selectedTaskId = task.id;

  saveData();
  renderTasks();
  taskInput.value = '';
  taskInput.focus();
});

startButton.addEventListener('click', startTimer);
$('#reset').addEventListener('click', resetTimer);
$('#skip').addEventListener('click', skipMode);

document.querySelectorAll('.mode').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

renderTasks();
renderStats();
updateTimerDisplay();
