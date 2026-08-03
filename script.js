const STORAGE_KEY = "carya-tasks-v1";
const THEME_KEY = "carya-theme";
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const prioritySelect = document.getElementById("priority-select");
const dueDateInput = document.getElementById("due-date-input");
const searchInput = document.getElementById("search-input");
const filterSelect = document.getElementById("filter-select");
const taskList = document.getElementById("task-list");
const formMessage = document.getElementById("form-message");
const alertArea = document.getElementById("alert-area");
const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const pendingCount = document.getElementById("pending-count");
const taskSummary = document.getElementById("task-summary");
const themeToggle = document.getElementById("theme-toggle");
const installBtn = document.getElementById("install-btn");

let tasks = loadTasks();
let editingId = null;
let darkMode = loadThemePreference();
let deferredInstallPrompt = null;

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed.map((task) => ({
      ...task,
      priority: task.priority || "medium",
      dueDate: task.dueDate || "",
    }));
  } catch (error) {
    console.error("Unable to load tasks", error);
    return [];
  }
}

function saveTasks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function updateInstallButtonVisibility() {
  if (!installBtn) return;
  installBtn.hidden = !deferredInstallPrompt;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker
    .register("service-worker.js")
    .then(() => console.log("Service worker registered."))
    .catch((error) => console.warn("Service worker registration failed:", error));
}

function loadThemePreference() {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored) return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch (error) {
    return "dark";
  }
}

function applyTheme() {
  document.body.classList.toggle("light-mode", darkMode === "light");
  themeToggle.textContent = darkMode === "dark" ? "☀️" : "🌙";
  themeToggle.setAttribute("aria-label", darkMode === "dark" ? "Switch to light mode" : "Switch to dark mode");
}

function showMessage(text, isError = false) {
  formMessage.textContent = text;
  formMessage.classList.toggle("error", isError);
}

function createTask(text, priority, dueDate) {
  return {
    id: crypto.randomUUID(),
    text: text.trim(),
    completed: false,
    priority,
    dueDate,
    createdAt: new Date().toISOString(),
  };
}

function getDueStatus(task) {
  if (!task.dueDate || task.completed) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate = new Date(task.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDate - today) / 86400000);

  if (diffDays < 0) return { label: "Overdue", className: "overdue" };
  if (diffDays === 0) return { label: "Due today", className: "due-today" };
  if (diffDays <= 2) return { label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`, className: "due-soon" };
  return null;
}

function getFilteredTasks() {
  const search = searchInput.value.trim().toLowerCase();
  const filter = filterSelect.value;

  return tasks.filter((task) => {
    const matchesSearch = task.text.toLowerCase().includes(search);
    const matchesFilter =
      filter === "all" ||
      (filter === "completed" && task.completed) ||
      (filter === "pending" && !task.completed);

    return matchesSearch && matchesFilter;
  });
}

function updateStats() {
  const completed = tasks.filter((task) => task.completed).length;
  const pending = tasks.length - completed;

  totalCount.textContent = tasks.length;
  completedCount.textContent = completed;
  pendingCount.textContent = pending;
}

function renderAlerts() {
  const urgentTasks = tasks.filter((task) => !task.completed && getDueStatus(task));
  if (!urgentTasks.length) {
    alertArea.innerHTML = "";
    return;
  }

  const items = urgentTasks
    .slice(0, 3)
    .map((task) => `${escapeHtml(task.text)} (${getDueStatus(task).label})`)
    .join(" • ");

  alertArea.innerHTML = `<div class="alert-banner">⚠ ${items}</div>`;
}

function renderTasks() {
  const filteredTasks = getFilteredTasks();
  taskSummary.textContent = `${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} shown`;

  if (!filteredTasks.length) {
    taskList.innerHTML = '<li class="empty-state">No tasks match your search or filter.</li>';
    return;
  }

  taskList.innerHTML = filteredTasks
    .map((task) => {
      const dueStatus = getDueStatus(task);
      const priorityLabel = task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : "Medium";

      return `
        <li class="task-item">
          <div class="task-main">
            <input type="checkbox" ${task.completed ? "checked" : ""} data-action="toggle" data-id="${task.id}" />
            <div class="task-content">
              <span class="task-text ${task.completed ? "completed" : ""}">${escapeHtml(task.text)}</span>
              <div class="task-meta">
                <span class="badge ${task.priority || "medium"}">${priorityLabel}</span>
                ${task.completed ? '<span class="badge completed">Completed</span>' : ""}
                ${dueStatus ? `<span class="badge ${dueStatus.className}">${dueStatus.label}</span>` : ""}
              </div>
            </div>
          </div>
          <div class="task-actions">
            <button class="secondary-btn" data-action="edit" data-id="${task.id}">Edit</button>
            <button class="icon-btn danger" data-action="delete" data-id="${task.id}">Delete</button>
          </div>
        </li>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function render() {
  updateStats();
  renderAlerts();
  renderTasks();
}

function addTask(text) {
  const trimmed = text.trim();
  if (!trimmed) {
    showMessage("Please enter a task before adding it.", true);
    return;
  }

  if (trimmed.length < 3) {
    showMessage("Task should be at least 3 characters long.", true);
    return;
  }

  if (dueDateInput.value && Number.isNaN(new Date(dueDateInput.value).getTime())) {
    showMessage("Please choose a valid due date.", true);
    return;
  }

  tasks.unshift(createTask(trimmed, prioritySelect.value, dueDateInput.value));
  saveTasks();
  taskInput.value = "";
  prioritySelect.value = "medium";
  dueDateInput.value = "";
  showMessage("Task added successfully.");
  render();
}

function startEditing(id) {
  editingId = id;
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const taskItem = Array.from(taskList.children).find((item) => item.querySelector("[data-id='" + id + "']"));
  if (!taskItem) return;

  const taskContent = taskItem.querySelector(".task-content");
  const actions = taskItem.querySelector(".task-actions");
  taskContent.innerHTML = `
    <div class="edit-fields">
      <input class="edit-input" value="${escapeHtml(task.text)}" aria-label="Edit task" />
      <div class="edit-controls">
        <select class="edit-select" aria-label="Edit priority">
          <option value="low" ${task.priority === "low" ? "selected" : ""}>Low priority</option>
          <option value="medium" ${task.priority === "medium" || !task.priority ? "selected" : ""}>Medium priority</option>
          <option value="high" ${task.priority === "high" ? "selected" : ""}>High priority</option>
        </select>
        <input class="edit-date" type="date" value="${task.dueDate || ""}" aria-label="Edit due date" />
      </div>
    </div>
  `;
  actions.innerHTML = `
    <button class="secondary-btn" data-action="save" data-id="${task.id}">Save</button>
    <button class="icon-btn" data-action="cancel" data-id="${task.id}">Cancel</button>
  `;
  taskItem.querySelector(".edit-input").focus();
}

function saveEditedTask(id) {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;

  const input = taskList.querySelector(`.edit-input`);
  const priorityInput = taskList.querySelector(`.edit-select`);
  const dueDateInputElement = taskList.querySelector(`.edit-date`);
  const updatedText = input?.value.trim();

  if (!updatedText) {
    showMessage("Task cannot be empty.", true);
    return;
  }

  task.text = updatedText;
  task.priority = priorityInput?.value || "medium";
  task.dueDate = dueDateInputElement?.value || "";
  saveTasks();
  editingId = null;
  showMessage("Task updated successfully.");
  render();
}

function cancelEditing() {
  editingId = null;
  render();
}

function handleTaskActions(event) {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;

  const { action, id } = actionElement.dataset;

  if (action === "toggle") {
    const task = tasks.find((item) => item.id === id);
    if (task) {
      task.completed = !task.completed;
      saveTasks();
      render();
    }
  }

  if (action === "edit") {
    startEditing(id);
  }

  if (action === "delete") {
    tasks = tasks.filter((item) => item.id !== id);
    saveTasks();
    if (editingId === id) editingId = null;
    showMessage("Task deleted.");
    render();
  }

  if (action === "save") {
    saveEditedTask(id);
  }

  if (action === "cancel") {
    cancelEditing();
  }
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addTask(taskInput.value);
});

searchInput.addEventListener("input", render);
filterSelect.addEventListener("change", render);
taskList.addEventListener("click", handleTaskActions);

themeToggle.addEventListener("click", () => {
  darkMode = darkMode === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, darkMode);
  applyTheme();
  showMessage(darkMode === "dark" ? "Dark mode enabled." : "Light mode enabled.");
});

installBtn?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  deferredInstallPrompt.prompt();
  const choiceResult = await deferredInstallPrompt.userChoice;
  if (choiceResult.outcome === "accepted") {
    showMessage("App installed successfully.");
  } else {
    showMessage("App installation dismissed.");
  }

  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtonVisibility();
  showMessage("Install this app for faster access and offline support.");
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButtonVisibility();
  showMessage("App installed and ready to launch from your home screen.");
});

taskList.addEventListener("keydown", (event) => {
  if (event.target.classList.contains("edit-input") && event.key === "Enter") {
    event.preventDefault();
    const id = event.target.closest("[data-id]")?.dataset.id;
    if (id) saveEditedTask(id);
  }
});

registerServiceWorker();
applyTheme();
render();
