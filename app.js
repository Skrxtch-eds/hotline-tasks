// Приложение без библиотек: данные -> сохранение -> перерисовка списка.
const STORAGE_KEY = "study-deadlines-tasks";
const MOTIVATION_KEY = "hotlines-last-motivation";
const motivations = [
  "Начни с одного шага.",
  "Маленький шаг — уже движение.",
  "Сегодня можно чуть больше.",
  "Делай в своём темпе.",
  "Одна задача за раз.",
  "Твой прогресс начинается сейчас.",
  "Начатое становится возможным.",
  "Освободи время для важного."
];
const form = document.querySelector("#task-form");
const subjectInput = document.querySelector("#subject");
const titleInput = document.querySelector("#title");
const deadlineInput = document.querySelector("#deadline-value");
const taskList = document.querySelector("#task-list");
const sortSelect = document.querySelector("#sort");
const filterButtons = document.querySelectorAll("[data-filter]");
const storageWarning = document.querySelector("#storage-warning");
const announcement = document.querySelector("#announcement");
const deleteDialog = document.querySelector("#delete-dialog");
const editDialog = document.querySelector("#edit-dialog");
const editForm = document.querySelector("#edit-form");
const editSubjectInput = document.querySelector("#edit-subject");
const editTitleInput = document.querySelector("#edit-title");
const editDeadlineInput = document.querySelector("#edit-deadline-value");
const editDeadlineLabel = document.querySelector("#edit-deadline-label");
const editDeadlineButton = document.querySelector("#edit-deadline");
const cancelEditButton = document.querySelector("#cancel-edit");

let tasks = loadTasks();
let currentFilter = "all";
let pendingDeleteId = null;
let editingTaskId = null;

function showStorageWarning(message) {
  storageWarning.textContent = message;
  storageWarning.hidden = false;
}

// Не повторяем предыдущую фразу при следующем открытии или перезагрузке.
function showMotivation() {
  let previous = null;
  try { previous = localStorage.getItem(MOTIVATION_KEY); } catch { /* Без хранилища фраза всё равно появится. */ }
  const choices = motivations.filter(phrase => phrase !== previous);
  const phrase = choices[Math.floor(Math.random() * choices.length)];
  document.querySelector("#page-title").textContent = phrase;
  try { localStorage.setItem(MOTIVATION_KEY, phrase); } catch { /* Список задач работает независимо. */ }
}

// Дата и время относятся к местному часовому поясу браузера.
function todayString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function isValidDeadline(value) {
  // Старые задачи содержат только дату; новые — ещё и время.
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(value)) return false;
  const normalized = value.length === 10 ? `${value}T23:59` : value;
  if (normalized < "2000-01-01T00:00" || normalized > "2100-12-31T23:59") return false;
  const date = new Date(normalized);
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === Number(value.slice(0, 4))
    && date.getMonth() + 1 === Number(value.slice(5, 7))
    && date.getDate() === Number(value.slice(8, 10))
    && date.getHours() === Number(normalized.slice(11, 13))
    && date.getMinutes() === Number(normalized.slice(14, 16));
}

function isValidTask(task) {
  return task !== null && typeof task === "object"
    && typeof task.id === "string" && task.id.length > 0
    && typeof task.subject === "string" && task.subject.trim().length > 0 && task.subject.length <= 80
    && typeof task.title === "string" && task.title.trim().length > 0 && task.title.length <= 160
    && isValidDeadline(task.deadline)
    && typeof task.done === "boolean";
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed) || !parsed.every(isValidTask)
      || new Set(parsed.map(task => task.id)).size !== parsed.length) {
      throw new Error("Неверный формат задач");
    }
    // Старые дедлайны без времени действуют до конца выбранного дня.
    // Если момент добавления не записан, начинаем шкалу с первого открытия и сохраняем его.
    const loadedAt = Date.now();
    let needsMigration = false;
    const loaded = parsed.map(task => {
      const deadline = task.deadline.length === 10 ? `${task.deadline}T23:59` : task.deadline;
      const hasCreatedAt = Number.isFinite(task.createdAt) && task.createdAt > 0
        && !Number.isNaN(new Date(task.createdAt).getTime());
      if (!hasCreatedAt || deadline !== task.deadline) needsMigration = true;
      return {
        ...task,
        deadline,
        createdAt: hasCreatedAt ? task.createdAt : loadedAt
      };
    });
    if (needsMigration) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(loaded));
      } catch {
        showStorageWarning("Задачи загружены, но браузер не сохранил время начала шкалы. Проверь доступ к хранилищу.");
      }
    }
    return loaded;
  } catch {
    showStorageWarning("Не удалось прочитать сохранённые задачи. Список открыт пустым. Проверь настройки хранилища браузера.");
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    storageWarning.hidden = true;
  } catch {
    showStorageWarning("Браузер не сохранил изменения. Сейчас задачи доступны только до перезагрузки страницы.");
  }
}

function isOverdue(task) {
  return !task.done && new Date(task.deadline).getTime() <= Date.now();
}

function formatDate(value) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.ceil(Math.abs(milliseconds) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  let text = "";
  if (days > 0) text += `${days} д `;
  if (days > 0 || hours > 0) text += `${hours} ч `;
  return `${text}${minutes} мин ${seconds} с`;
}

function getCountdown(task, now = Date.now()) {
  if (task.done) return { label: "Задача выполнена", progress: 100, overdue: false };
  const deadline = new Date(task.deadline).getTime();
  const remaining = deadline - now;
  if (remaining <= 0) return { label: `Просрочено на ${formatDuration(remaining)}`, progress: 100, overdue: true };
  // 0% в момент добавления, 50% на середине отведённого срока, 100% в дедлайн.
  const duration = Math.max(deadline - task.createdAt, 1);
  const elapsed = now - task.createdAt;
  const progress = Math.max(0, Math.min(100, elapsed / duration * 100));
  return { label: `Осталось ${formatDuration(remaining)}`, progress, overdue: false };
}

// Обновляем только таймеры и пометки. Поля ввода и фокус остаются на месте.
function updateCountdowns() {
  const now = Date.now();
  document.querySelector("#overdue-count").textContent = tasks.filter(task => !task.done && new Date(task.deadline).getTime() <= now).length;
  for (const card of taskList.children) {
    const task = tasks.find(item => item.id === card.dataset.taskId);
    const countdown = getCountdown(task, now);
    card.classList.toggle("overdue", countdown.overdue);
    card.querySelector(".countdown-text").textContent = countdown.label;
    card.querySelector(".time-fill").style.width = `${countdown.progress}%`;
    const track = card.querySelector(".time-track");
    track.classList.toggle("is-burning", countdown.overdue);
    track.setAttribute("aria-valuenow", String(Math.round(countdown.progress)));
    track.setAttribute("aria-valuetext", countdown.label);
    const status = card.querySelector(".status-tag");
    status.classList.toggle("late", countdown.overdue);
    status.textContent = task.done ? "Готово" : countdown.overdue ? "Горит"
      : task.deadline.slice(0, 10) === todayString() ? "Сегодня" : "В работе";
  }
}

// Черновик редактирования находится в отдельном окне, основная форма не меняется.
function startEditing(task) {
  editingTaskId = task.id;
  editSubjectInput.value = task.subject;
  editTitleInput.value = task.title;
  editSubjectInput.setCustomValidity("");
  editTitleInput.setCustomValidity("");
  setDeadlinePicker(task.deadline, editDeadlineInput, editDeadlineLabel);
  editDialog.showModal();
  editSubjectInput.focus();
  announcement.textContent = "Задача открыта для редактирования.";
}

function closeEditing() {
  editDialog.close();
  editingTaskId = null;
  editForm.reset();
  editSubjectInput.setCustomValidity("");
  editTitleInput.setCustomValidity("");
  setDeadlinePicker("", editDeadlineInput, editDeadlineLabel);
}

function createActionIcon(pathData) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "17");
  icon.setAttribute("height", "17");
  icon.setAttribute("fill", "none");
  icon.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", pathData);
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.7");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  icon.append(path);
  return icon;
}

// Весь пользовательский текст вставляем через textContent, а не innerHTML.
function createTaskCard(task) {
  const card = document.createElement("li");
  card.className = "task-card";
  card.dataset.taskId = task.id;
  if (task.done) card.classList.add("completed");
  if (isOverdue(task)) card.classList.add("overdue");

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "task-checkbox";
  checkbox.checked = task.done;
  checkbox.setAttribute("aria-label", `Готово: ${task.subject}`);
  checkbox.addEventListener("change", () => {
    task.done = checkbox.checked;
    saveTasks();
    render();
    // После перерисовки возвращаем фокус на задание или выбранный фильтр.
    const taskIndex = visibleTasks().findIndex(item => item.id === task.id);
    const nextFocus = taskIndex >= 0
      ? taskList.children[taskIndex].querySelector("input")
      : document.querySelector(`[data-filter="${currentFilter}"]`);
    nextFocus.focus();
    announcement.textContent = task.done ? "Задача выполнена." : "Задача возвращена в работу.";
  });

  const content = document.createElement("div");
  content.className = "task-content";
  const description = document.createElement("p");
  description.className = "task-description";
  description.textContent = task.title;
  const title = document.createElement("h3");
  title.className = "task-title";
  title.textContent = task.subject;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const date = document.createElement("time");
  date.dateTime = task.deadline;
  date.textContent = `До ${formatDate(task.deadline)}`;
  const status = document.createElement("span");
  status.className = "status-tag";
  if (task.done) {
    status.textContent = "Готово";
    status.classList.add("finished");
  } else if (isOverdue(task)) {
    status.textContent = "Горит";
    status.classList.add("late");
  } else {
    status.textContent = task.deadline.slice(0, 10) === todayString() ? "Сегодня" : "В работе";
  }
  const added = document.createElement("time");
  added.className = "task-added";
  added.dateTime = new Date(task.createdAt).toISOString();
  added.textContent = `Добавлена ${formatDate(task.createdAt)}`;
  const dates = document.createElement("div");
  dates.className = "task-dates";
  dates.append(date, added);
  meta.append(dates, status);

  const timer = document.createElement("div");
  timer.className = "deadline-timer";
  const countdownText = document.createElement("p");
  countdownText.className = "countdown-text";
  const track = document.createElement("div");
  track.className = "time-track";
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-label", `Приближение дедлайна: ${task.subject}`);
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  const fill = document.createElement("div");
  fill.className = "time-fill";
  const flame = document.createElement("img");
  flame.className = "timer-flame";
  flame.src = "fire.png";
  flame.alt = "";
  flame.width = 28;
  flame.height = 28;
  fill.append(flame);
  track.append(fill);
  timer.append(track, countdownText);
  content.append(title, description, meta, timer);

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "edit-button";
  editButton.title = "Изменить задачу";
  editButton.setAttribute("aria-label", `Изменить: ${task.subject}`);
  editButton.append(createActionIcon("m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15l-1 5Z"));
  editButton.addEventListener("click", () => startEditing(task));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.append(createActionIcon("m6 6 12 12M18 6 6 18"));
  deleteButton.title = "Удалить задачу";
  deleteButton.setAttribute("aria-label", `Удалить: ${task.subject}`);
  deleteButton.addEventListener("click", () => {
    pendingDeleteId = task.id;
    document.querySelector("#delete-description").textContent = `«${task.subject}» будет удалена из списка.`;
    deleteDialog.returnValue = "cancel";
    deleteDialog.showModal();
  });

  actions.append(editButton, deleteButton);
  card.append(checkbox, content, actions);
  return card;
}

function visibleTasks() {
  const visible = tasks.filter(task => {
    if (currentFilter === "active") return !task.done;
    if (currentFilter === "done") return task.done;
    return true;
  });
  // Новые задания добавляются в начало массива.
  if (sortSelect.value === "deadline") {
    visible.sort((a, b) => a.deadline.localeCompare(b.deadline));
  }
  return visible;
}

function render() {
  document.querySelector("#active-count").textContent = tasks.filter(task => !task.done).length;
  document.querySelector("#overdue-count").textContent = tasks.filter(isOverdue).length;
  document.querySelector("#total-count").textContent = tasks.length;

  const visible = visibleTasks();
  taskList.replaceChildren(...visible.map(createTaskCard));
  updateCountdowns();
  document.querySelector("#empty-state").hidden = visible.length > 0;
  document.querySelector("#empty-title").textContent = tasks.length === 0
    ? "Начнём с чистого листа" : "Здесь пока нет задач";
  document.querySelector("#empty-description").textContent = tasks.length === 0
    ? "Добавь первую задачу — она появится здесь."
    : "Попробуй другой фильтр или добавь новую задачу.";
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const subject = subjectInput.value.trim();
  const title = titleInput.value.trim();
  subjectInput.setCustomValidity(subject ? "" : "Введи название задачи.");
  titleInput.setCustomValidity(title ? "" : "Введи описание задачи.");
  if (!form.reportValidity()) return;
  if (!isValidDeadline(deadlineInput.value)) {
    openDeadlinePicker();
    return;
  }

  tasks.unshift({
    id: crypto.randomUUID(),
    subject,
    title,
    deadline: deadlineInput.value,
    createdAt: Date.now(),
    done: false
  });
  saveTasks();
  form.reset();
  resetDeadlinePicker();
  setFilter("all");
  subjectInput.focus();
  announcement.textContent = "Задача добавлена.";
});

editForm.addEventListener("submit", event => {
  event.preventDefault();
  const subject = editSubjectInput.value.trim();
  const title = editTitleInput.value.trim();
  editSubjectInput.setCustomValidity(subject ? "" : "Введи название задачи.");
  editTitleInput.setCustomValidity(title ? "" : "Введи описание задачи.");
  if (!editForm.reportValidity()) return;
  if (!isValidDeadline(editDeadlineInput.value)) {
    openDeadlinePicker(editDeadlineInput, editDeadlineLabel, editDeadlineButton);
    return;
  }
  const task = tasks.find(item => item.id === editingTaskId);
  if (!task) {
    closeEditing();
    announcement.textContent = "Эта задача уже удалена.";
    return;
  }
  // id, createdAt и done остаются прежними — это та же задача.
  task.subject = subject;
  task.title = title;
  task.deadline = editDeadlineInput.value;
  saveTasks();
  closeEditing();
  render();
  document.querySelector(`[data-filter="${currentFilter}"]`).focus();
  announcement.textContent = "Изменения сохранены.";
});

editDeadlineButton.addEventListener("click", () => openDeadlinePicker(editDeadlineInput, editDeadlineLabel, editDeadlineButton));
cancelEditButton.addEventListener("click", () => {
  closeEditing();
  announcement.textContent = "Редактирование отменено.";
});
document.querySelector("#close-edit").addEventListener("click", closeEditing);
editDialog.addEventListener("cancel", event => {
  event.preventDefault();
  closeEditing();
});
editDialog.addEventListener("click", event => {
  if (event.target !== editDialog) return;
  const box = editDialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeEditing();
});

for (const input of [subjectInput, titleInput, editSubjectInput, editTitleInput]) {
  input.addEventListener("input", () => input.setCustomValidity(""));
}

function setFilter(filter) {
  currentFilter = filter;
  for (const button of filterButtons) {
    const selected = button.dataset.filter === filter;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  }
  render();
}

for (const button of filterButtons) {
  button.addEventListener("click", () => setFilter(button.dataset.filter));
}
sortSelect.addEventListener("change", render);
deleteDialog.addEventListener("close", () => {
  if (deleteDialog.returnValue === "delete" && pendingDeleteId !== null) {
    if (editingTaskId === pendingDeleteId) closeEditing();
    tasks = tasks.filter(task => task.id !== pendingDeleteId);
    saveTasks();
    render();
    document.querySelector(`[data-filter="${currentFilter}"]`).focus();
    announcement.textContent = "Задача удалена.";
  }
  pendingDeleteId = null;
});
window.addEventListener("focus", updateCountdowns);
setInterval(updateCountdowns, 1000);
showMotivation();
render();
