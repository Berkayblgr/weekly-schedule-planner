/**
 * Weekly Planner & To-Do List Application
 * Core JS File (Browser LocalStorage)
 */

// --- Constants ---
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Default mock tasks for initial seeding if local storage is empty
const DEFAULT_TASKS = {
  "Monday": [
    { text: "Morning stretches & coffee ☕", completed: true, priority: "low", position: 0 },
    { text: "Team planning & weekly sync", completed: false, priority: "high", position: 1 },
    { text: "Review wireframes & designs", completed: false, priority: "medium", position: 2 }
  ],
  "Tuesday": [
    { text: "Doctor appointment 🩺", completed: false, priority: "high", position: 0 },
    { text: "Draft technical spec document", completed: true, priority: "medium", position: 1 }
  ],
  "Wednesday": [
    { text: "Mid-week target check-in", completed: true, priority: "low", position: 0 },
    { text: "Gym session - Leg day 🏋️‍♂️", completed: false, priority: "medium", position: 1 }
  ],
  "Thursday": [
    { text: "Grocery shopping", completed: false, priority: "low", position: 0 },
    { text: "Fix outstanding app bugs", completed: false, priority: "high", position: 1 }
  ],
  "Friday": [
    { text: "Review pull requests", completed: false, priority: "high", position: 0 },
    { text: "Plan weekend activity", completed: false, priority: "medium", position: 1 }
  ],
  "Saturday": [
    { text: "Read 3 chapters of book", completed: false, priority: "low", position: 0 }
  ],
  "Sunday": [
    { text: "Meal prep & house cleaning", completed: false, priority: "medium", position: 0 }
  ]
};

// --- Global App State Variables ---
let currentWeekMonday = null; // Date object for actual today's week Monday
let activeWeekMonday = null;  // Date object for the week currently being viewed

// Memory cache for the currently active week's tasks and notes
let activeWeekTasks = {
  "Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []
};
let activeWeekNotes = "";
let notesSaveTimeout = null;
let localStorageState = { weeks: {} };

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  const today = new Date();
  currentWeekMonday = getMondayOfDate(today);
  activeWeekMonday = new Date(currentWeekMonday);
  
  renderWeeklyGrid();
  updateNavigationUI();
  setupEventListeners();
  loadStateFromLocalStorage();
}

// --- Local Storage Management ---
function loadStateFromLocalStorage() {
  const rawData = localStorage.getItem("weekly_schedule_tasks");
  let isBrandNewUser = false;

  if (rawData) {
    try {
      localStorageState = JSON.parse(rawData);
      if (!localStorageState.weeks) {
        localStorageState.weeks = {};
      }
    } catch (e) {
      console.error("Failed to parse local storage:", e);
      localStorageState = { weeks: {} };
      isBrandNewUser = true;
    }
  } else {
    localStorageState = { weeks: {} };
    isBrandNewUser = true;
  }

  const activeMondayStr = getMondayDateString(activeWeekMonday);
  
  // Seed default sample tasks if local storage is brand new and empty for this week
  if (!localStorageState.weeks[activeMondayStr]) {
    if (isBrandNewUser || Object.keys(localStorageState.weeks).length === 0) {
      const seededTasks = {};
      DAYS_OF_WEEK.forEach(day => {
        const defaults = DEFAULT_TASKS[day] || [];
        seededTasks[day] = defaults.map((t, idx) => ({
          id: generateId() + idx,
          text: t.text,
          completed: t.completed,
          priority: t.priority,
          position: t.position !== undefined ? t.position : idx
        }));
      });
      localStorageState.weeks[activeMondayStr] = {
        tasks: seededTasks,
        notes: ""
      };
    } else {
      localStorageState.weeks[activeMondayStr] = {
        tasks: {
          "Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []
        },
        notes: ""
      };
    }
  }

  const weekData = localStorageState.weeks[activeMondayStr];
  DAYS_OF_WEEK.forEach(day => {
    activeWeekTasks[day] = weekData.tasks[day] || [];
  });
  activeWeekNotes = weekData.notes || "";

  saveStateToLocalStorage();
  renderWeeklyGridDataOnly();
  updateGlobalProgress();
}

function ensureLocalStorageWeekInitialized(weekKey) {
  if (!localStorageState.weeks) {
    localStorageState.weeks = {};
  }
  if (!localStorageState.weeks[weekKey]) {
    localStorageState.weeks[weekKey] = {
      tasks: {
        "Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []
      },
      notes: ""
    };
  }
}

function saveStateToLocalStorage() {
  const activeMondayStr = getMondayDateString(activeWeekMonday);
  ensureLocalStorageWeekInitialized(activeMondayStr);

  localStorageState.weeks[activeMondayStr] = {
    tasks: JSON.parse(JSON.stringify(activeWeekTasks)),
    notes: activeWeekNotes
  };

  localStorage.setItem("weekly_schedule_tasks", JSON.stringify(localStorageState));
}

// --- Date Helpers ---
function getMondayOfDate(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = date.getDate() - (day === 0 ? 6 : day - 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getMondayDateString(d) {
  const monday = getMondayOfDate(d);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  const dd = String(monday.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getWeekOffset(mondayDate) {
  const activeCopy = new Date(mondayDate);
  activeCopy.setHours(0, 0, 0, 0);
  const currentCopy = new Date(currentWeekMonday);
  currentCopy.setHours(0, 0, 0, 0);
  const diffTime = activeCopy.getTime() - currentCopy.getTime();
  return Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
}

function getWeekDatesForActiveWeek() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const nextDay = new Date(activeWeekMonday);
    nextDay.setDate(activeWeekMonday.getDate() + i);
    dates.push(nextDay);
  }
  return dates;
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

// --- UI Rendering ---
function renderWeeklyGrid() {
  const gridContainer = document.getElementById("weekly-grid");
  gridContainer.innerHTML = "";

  const weekDates = getWeekDatesForActiveWeek();
  const todayStr = new Date().toDateString();

  DAYS_OF_WEEK.forEach((day, index) => {
    const date = weekDates[index];
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isToday = date.toDateString() === todayStr;

    const dayCard = document.createElement("section");
    dayCard.className = `day-card ${isToday ? 'is-today' : ''}`;
    dayCard.dataset.day = day;

    dayCard.innerHTML = `
      <div class="day-header">
        <div class="day-info">
          <h2 class="day-name">${day}</h2>
          <span class="day-date">${dateStr}</span>
        </div>
        <div class="day-stats">
          <span class="day-badge" id="badge-${day}">0/0</span>
          <div class="day-progress-track">
            <div class="day-progress-bar" id="progress-${day}" style="width: 0%"></div>
          </div>
        </div>
      </div>
      
      <div class="tasks-container" id="tasks-container-${day}">
        <!-- Tasks populated dynamically -->
      </div>
      
      <form class="add-task-form" data-day="${day}">
        <input type="text" class="add-task-input" placeholder="+ Add a task..." required aria-label="Add task for ${day}">
        <button type="submit" class="add-task-submit" title="Add Task">
          <i data-lucide="plus"></i>
        </button>
      </form>
    `;

    gridContainer.appendChild(dayCard);
  });

  // Render Weekly Focus Notes Card
  const notesCard = document.createElement("section");
  notesCard.className = "day-card weekly-notes-card";
  notesCard.innerHTML = `
    <div class="day-header">
      <div class="day-info">
        <h2 class="day-name">Weekly Focus</h2>
        <span class="day-date">Goals & Reflections</span>
      </div>
      <div class="day-stats">
        <i data-lucide="sticky-note" style="color: var(--color-navy); width: 1.5rem; height: 1.5rem;"></i>
      </div>
    </div>
    
    <div class="notes-container">
      <textarea id="weekly-notes-textarea" placeholder="Write down your main goals, reminders, or reflections for this week..." aria-label="Weekly Notes"></textarea>
    </div>
  `;
  gridContainer.appendChild(notesCard);

  const notesTextarea = document.getElementById("weekly-notes-textarea");
  notesTextarea.addEventListener("input", (e) => {
    saveNotesWithDebounce(e.target.value);
  });

  // SortableJS Drag & Drop
  DAYS_OF_WEEK.forEach(day => {
    const container = document.getElementById(`tasks-container-${day}`);
    if (container) {
      new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: (evt) => {
          handleTaskOrderChange(day, container);
        }
      });
    }
  });

  lucide.createIcons();
}

function renderWeeklyGridDataOnly() {
  DAYS_OF_WEEK.forEach(day => {
    renderTasksForDay(day);
    updateDayStats(day);
  });

  const notesTextarea = document.getElementById("weekly-notes-textarea");
  if (notesTextarea) {
    notesTextarea.value = activeWeekNotes;
  }

  lucide.createIcons();
}

function renderTasksForDay(day) {
  const container = document.getElementById(`tasks-container-${day}`);
  if (!container) return;

  const tasks = [...(activeWeekTasks[day] || [])];
  tasks.sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return (a.position || 0) - (b.position || 0);
  });

  container.innerHTML = "";

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="tasks-empty">
        <i data-lucide="sparkles"></i>
        <p>No tasks planned. Enjoy your day!</p>
      </div>
    `;
    return;
  }

  tasks.forEach(task => {
    const taskItem = document.createElement("div");
    taskItem.className = `task-item task-priority-${task.priority} ${task.completed ? 'is-completed' : ''}`;
    taskItem.dataset.id = task.id;

    taskItem.innerHTML = `
      <div class="drag-handle" title="Drag to reorder">
        <i data-lucide="grip-vertical"></i>
      </div>

      <label class="task-checkbox-container">
        <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleTaskStatus('${day}', '${task.id}')">
        <span class="checkmark"></span>
      </label>
      
      <div class="task-details">
        <span class="task-text">${escapeHtml(task.text)}</span>
        <span class="task-priority-badge priority-${task.priority}">${task.priority}</span>
      </div>
      
      <div class="task-actions">
        <button class="action-btn edit-btn" onclick="openEditModal('${day}', '${task.id}')" title="Edit Task">
          <i data-lucide="pencil"></i>
        </button>
        <button class="action-btn delete-btn" onclick="deleteTaskItem('${day}', '${task.id}')" title="Delete Task">
          <i data-lucide="trash-2"></i>
        </button>
      </div>
    `;

    container.appendChild(taskItem);
  });
}

function updateDayStats(day) {
  const tasks = activeWeekTasks[day] || [];
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  const badge = document.getElementById(`badge-${day}`);
  if (badge) badge.textContent = `${completed}/${total}`;

  const progressBar = document.getElementById(`progress-${day}`);
  if (progressBar) progressBar.style.width = `${percent}%`;
}

function updateGlobalProgress() {
  let totalTasks = 0;
  let completedTasks = 0;

  DAYS_OF_WEEK.forEach(day => {
    const tasks = activeWeekTasks[day] || [];
    totalTasks += tasks.length;
    completedTasks += tasks.filter(t => t.completed).length;
  });

  const percent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const bar = document.getElementById("global-progress-bar");
  const text = document.getElementById("global-progress-text");
  const count = document.getElementById("global-task-count");

  if (bar) bar.style.width = `${percent}%`;
  if (text) text.textContent = `${percent}%`;
  if (count) count.textContent = `${completedTasks} of ${totalTasks} tasks completed`;
}

// --- Navigation Controller ---
function navigateWeek(weeksDiff) {
  const candidateMonday = new Date(activeWeekMonday);
  candidateMonday.setDate(candidateMonday.getDate() + (weeksDiff * 7));

  const offset = getWeekOffset(candidateMonday);
  if (offset >= -1 && offset <= 2) {
    activeWeekMonday = candidateMonday;
    renderWeeklyGrid();
    updateNavigationUI();
    loadStateFromLocalStorage();
  }
}

function updateNavigationUI() {
  const offset = getWeekOffset(activeWeekMonday);

  const prevBtn = document.getElementById("prev-week-btn");
  const nextBtn = document.getElementById("next-week-btn");

  if (prevBtn) prevBtn.disabled = (offset <= -1);
  if (nextBtn) nextBtn.disabled = (offset >= 2);

  const weekDates = getWeekDatesForActiveWeek();
  const start = weekDates[0];
  const end = weekDates[6];
  const options = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', { ...options, year: 'numeric' });

  const rangeDisplay = document.getElementById("current-week-display");
  if (rangeDisplay) {
    rangeDisplay.textContent = `${startStr} – ${endStr}`;
  }

  const relativeBadge = document.getElementById("week-relative-label");
  if (relativeBadge) {
    relativeBadge.className = "week-relative-badge";
    if (offset === 0) {
      relativeBadge.textContent = "This Week";
      relativeBadge.classList.add("this-week");
    } else if (offset === -1) {
      relativeBadge.textContent = "Last Week";
      relativeBadge.classList.add("last-week");
    } else if (offset === 1) {
      relativeBadge.textContent = "Next Week";
      relativeBadge.classList.add("next-week");
    } else if (offset === 2) {
      relativeBadge.textContent = "In 2 Weeks";
      relativeBadge.classList.add("in-two-weeks");
    }
  }
}

// --- Task Order & Mutation Handlers ---
function handleTaskOrderChange(day, container) {
  const taskElements = Array.from(container.children);
  const taskIdsInOrder = taskElements
    .filter(el => el.classList.contains('task-item'))
    .map(el => el.dataset.id);

  const tasksInDay = activeWeekTasks[day] || [];
  const orderedIncomplete = [];
  const orderedCompleted = [];

  taskIdsInOrder.forEach(id => {
    const task = tasksInDay.find(t => t.id === id);
    if (task) {
      if (task.completed) {
        orderedCompleted.push(task);
      } else {
        orderedIncomplete.push(task);
      }
    }
  });

  let currentPos = 0;
  orderedIncomplete.forEach(task => {
    task.position = currentPos++;
  });
  orderedCompleted.forEach(task => {
    task.position = currentPos++;
  });

  activeWeekTasks[day] = [...orderedIncomplete, ...orderedCompleted];

  updateDayStats(day);
  updateGlobalProgress();
  saveStateToLocalStorage();
  renderTasksForDay(day);
  lucide.createIcons();
}

window.toggleTaskStatus = function(day, taskId) {
  const task = activeWeekTasks[day].find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    renderTasksForDay(day);
    updateDayStats(day);
    updateGlobalProgress();
    saveStateToLocalStorage();
    lucide.createIcons();
  }
};

window.deleteTaskItem = function(day, taskId) {
  activeWeekTasks[day] = activeWeekTasks[day].filter(t => t.id !== taskId);
  renderTasksForDay(day);
  updateDayStats(day);
  updateGlobalProgress();
  saveStateToLocalStorage();
  lucide.createIcons();
};

window.openEditModal = function(day, taskId) {
  const task = activeWeekTasks[day].find(t => t.id === taskId);
  if (!task) return;

  document.getElementById("edit-task-day").value = day;
  document.getElementById("edit-task-id").value = taskId;
  document.getElementById("edit-task-input").value = task.text;
  document.getElementById("edit-task-priority").value = task.priority || "medium";

  const modal = document.getElementById("edit-modal");
  modal.classList.add("active");

  setTimeout(() => {
    document.getElementById("edit-task-input").focus();
  }, 100);
};

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  modal.classList.remove("active");
  document.getElementById("edit-task-form").reset();
}

function handleEditFormSubmit(e) {
  e.preventDefault();
  const day = document.getElementById("edit-task-day").value;
  const id = document.getElementById("edit-task-id").value;
  const newText = document.getElementById("edit-task-input").value.trim();
  const priority = document.getElementById("edit-task-priority").value;

  if (!newText) return;

  const task = activeWeekTasks[day].find(t => t.id === id);
  if (task) {
    task.text = newText;
    task.priority = priority;

    renderTasksForDay(day);
    updateDayStats(day);
    updateGlobalProgress();
    saveStateToLocalStorage();
    closeEditModal();
    lucide.createIcons();
  }
}

function saveNotesWithDebounce(notesText) {
  activeWeekNotes = notesText;
  if (notesSaveTimeout) clearTimeout(notesSaveTimeout);

  notesSaveTimeout = setTimeout(() => {
    saveStateToLocalStorage();
  }, 500);
}

// --- Event Listeners Registration ---
function setupEventListeners() {
  document.getElementById("weekly-grid").addEventListener("submit", (e) => {
    if (e.target && e.target.classList.contains("add-task-form")) {
      e.preventDefault();
      const day = e.target.dataset.day;
      const input = e.target.querySelector(".add-task-input");
      const text = input.value.trim();

      if (text) {
        const newTaskId = generateId();
        const nextPos = activeWeekTasks[day].length;

        const newTask = {
          id: newTaskId,
          text: text,
          completed: false,
          priority: "medium",
          position: nextPos
        };

        activeWeekTasks[day].push(newTask);
        input.value = "";

        renderTasksForDay(day);
        updateDayStats(day);
        updateGlobalProgress();
        saveStateToLocalStorage();
        lucide.createIcons();
      }
    }
  });

  const prevBtn = document.getElementById("prev-week-btn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => navigateWeek(-1));
  }

  const nextBtn = document.getElementById("next-week-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => navigateWeek(1));
  }

  document.getElementById("edit-task-form").addEventListener("submit", handleEditFormSubmit);
  document.getElementById("close-modal-btn").addEventListener("click", closeEditModal);
  document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);

  document.getElementById("edit-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("edit-modal")) {
      closeEditModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("edit-modal").classList.contains("active")) {
      closeEditModal();
    }
  });

  const faqGrid = document.querySelector(".faq-accordion");
  if (faqGrid) {
    faqGrid.addEventListener("click", (e) => {
      const button = e.target.closest(".faq-question");
      if (!button) return;

      const item = button.closest(".faq-item");
      const isActive = item.classList.contains("active");

      document.querySelectorAll(".faq-item").forEach(el => {
        el.classList.remove("active");
        el.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });

      if (!isActive) {
        item.classList.add("active");
        button.setAttribute("aria-expanded", "true");
      }
    });
  }
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
