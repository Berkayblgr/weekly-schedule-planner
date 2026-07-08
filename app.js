/**
 * Weekly Planner & To-Do List Application
 * Core JS File (Supabase Authentication & Database Integration)
 */

// --- Supabase Config ---
const SUPABASE_URL = "https://bhmtlagqicypamcnlzlq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_05wY2wMOLHQqYZ2M_FoDFg_bXHy4mNx";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Constants ---
const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Default mock tasks for seeding new user accounts
const DEFAULT_TASKS = {
  "Monday": [
    { text: "Morning stretches & coffee ☕", completed: true, priority: "low" },
    { text: "Team planning & weekly sync", completed: false, priority: "high" },
    { text: "Review wireframes & designs", completed: false, priority: "medium" }
  ],
  "Tuesday": [
    { text: "Doctor appointment 🩺", completed: false, priority: "high" },
    { text: "Draft technical spec document", completed: true, priority: "medium" }
  ],
  "Wednesday": [
    { text: "Mid-week target check-in", completed: true, priority: "low" },
    { text: "Gym session - Leg day 🏋️‍♂️", completed: false, priority: "medium" }
  ],
  "Thursday": [
    { text: "Grocery shopping", completed: false, priority: "low" },
    { text: "Fix outstanding app bugs", completed: false, priority: "high" }
  ],
  "Friday": [
    { text: "Review pull requests", completed: false, priority: "high" },
    { text: "Plan weekend activity", completed: false, priority: "medium" }
  ],
  "Saturday": [
    { text: "Read 3 chapters of book", completed: false, priority: "low" }
  ],
  "Sunday": [
    { text: "Meal prep & house cleaning", completed: false, priority: "medium" }
  ]
};

// --- Global App State Variables ---
let currentUser = null;
let currentWeekMonday = null; // Date object for actual today's week Monday
let activeWeekMonday = null;  // Date object for the week currently being viewed

// Memory cache for the currently active week's tasks and notes
let activeWeekTasks = {
  "Monday": [], "Tuesday": [], "Wednesday": [], "Thursday": [], "Friday": [], "Saturday": [], "Sunday": []
};
let activeWeekNotes = "";
let notesSaveTimeout = null;

// Database Sync Fallback Mode Flag
let isDbSyncActive = true;
let localStorageState = { weeks: {} };

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

function initApp() {
  const today = new Date();
  currentWeekMonday = getMondayOfDate(today);
  activeWeekMonday = new Date(currentWeekMonday);
  
  setupEventListeners();
  
  // Listen for authentication changes
  supabaseClient.auth.onAuthStateChange((event, session) => {
    handleAuthStateChange(event, session);
  });
}

// --- Authentication Handler ---
async function handleAuthStateChange(event, session) {
  if (session) {
    currentUser = session.user;
    showAppScreen();
    renderWeeklyGrid();
    updateNavigationUI();
    await loadActiveWeekDataFromDB();
  } else {
    currentUser = null;
    showAuthScreen();
  }
}

function showAuthScreen() {
  document.getElementById("auth-screen").style.display = "flex";
  document.getElementById("app-screen").style.display = "none";
  // Reset auth forms
  document.getElementById("auth-form").reset();
  document.getElementById("auth-error").style.display = "none";
  document.getElementById("auth-success").style.display = "none";
  lucide.createIcons();
}

function showAppScreen() {
  document.getElementById("auth-screen").style.display = "none";
  document.getElementById("app-screen").style.display = "block";
  if (currentUser) {
    document.getElementById("user-email-display").textContent = currentUser.email;
  }
}

// --- Database Fetch & Seeding ---
async function loadActiveWeekDataFromDB() {
  if (!currentUser) return;
  const activeMondayStr = getMondayDateString(activeWeekMonday);
  
  // Render spinners in cards during load
  DAYS_OF_WEEK.forEach(day => {
    const container = document.getElementById(`tasks-container-${day}`);
    if (container) {
      container.innerHTML = `
        <div class="tasks-empty">
          <i data-lucide="loader-2" class="animate-spin" style="color: var(--color-blue);"></i>
          <p>Syncing...</p>
        </div>
      `;
    }
  });
  lucide.createIcons();
  
  try {
    // 1. Load Tasks
    let dbTasks, taskError;
    const res = await supabaseClient
      .from('tasks')
      .select('*')
      .eq('week_key', activeMondayStr)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true });
      
    dbTasks = res.data;
    taskError = res.error;
    
    // If position column is missing, retry sorting chronologically by created_at only
    if (taskError && (taskError.code === '42703' || taskError.message.includes('position'))) {
      console.warn("Position column not found in tasks table. Retrying query without position ordering...");
      const retryRes = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('week_key', activeMondayStr)
        .order('created_at', { ascending: true });
        
      dbTasks = retryRes.data;
      taskError = retryRes.error;
    }
      
    if (taskError) throw taskError;
    
    // Seed default mock tasks if this is a fresh user account
    if (dbTasks && dbTasks.length === 0) {
      await seedDefaultTasksIfNewUser(activeMondayStr);
      // Fetch again to get the newly seeded tasks
      let reTasks, reError;
      const reRes = await supabaseClient
        .from('tasks')
        .select('*')
        .eq('week_key', activeMondayStr)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true });
        
      reTasks = reRes.data;
      reError = reRes.error;
      
      if (reError && (reError.code === '42703' || reError.message.includes('position'))) {
        const retryReRes = await supabaseClient
          .from('tasks')
          .select('*')
          .eq('week_key', activeMondayStr)
          .order('created_at', { ascending: true });
          
        reTasks = retryReRes.data;
        reError = retryReRes.error;
      }
      
      if (!reError && reTasks) {
        dbTasks = reTasks;
      }
    }
    
    // Reset cache
    DAYS_OF_WEEK.forEach(day => {
      activeWeekTasks[day] = [];
    });
    
    // Populate cache
    dbTasks.forEach(task => {
      if (activeWeekTasks[task.day]) {
        activeWeekTasks[task.day].push({
          id: task.id,
          text: task.text,
          completed: task.completed,
          priority: task.priority
        });
      }
    });
    
    // 2. Load Notes
    const { data: dbNotes, error: notesError } = await supabaseClient
      .from('weekly_notes')
      .select('notes')
      .eq('week_key', activeMondayStr)
      .maybeSingle();
      
    if (notesError) throw notesError;
    
    activeWeekNotes = dbNotes ? dbNotes.notes : "";
    
    // Mark database sync as active if queries succeed
    isDbSyncActive = true;
    
    // 3. Render
    renderWeeklyGridDataOnly();
    updateGlobalProgress();
  } catch (e) {
    console.error("Error loading week data from Supabase:", e);
    
    // Switch to localStorage fallback mode
    isDbSyncActive = false;
    loadStateFromLocalStorage();
  }
}

// --- Reordering Handlers ---
async function handleTaskOrderChange(day, container) {
  const taskElements = Array.from(container.children);
  const taskIdsInOrder = taskElements
    .filter(el => el.classList.contains('task-item'))
    .map(el => el.dataset.id);
    
  // Find task objects in memory
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
  
  // Re-assign positions sequentially: incomplete first, then completed
  let currentPos = 0;
  orderedIncomplete.forEach(task => {
    task.position = currentPos++;
  });
  orderedCompleted.forEach(task => {
    task.position = currentPos++;
  });
  
  // Combine back to activeWeekTasks[day]
  activeWeekTasks[day] = [...orderedIncomplete, ...orderedCompleted];
  
  // Update stats and global progress
  updateDayStats(day);
  updateGlobalProgress();
  
  // Save new positions
  await saveTaskOrder(day);
  
  // Re-render to ensure visual layout matches the state separation
  renderTasksForDay(day);
  lucide.createIcons();
}

async function saveTaskOrder(day) {
  if (isDbSyncActive) {
    try {
      // Run parallel updates to Supabase for the tasks in activeWeekTasks[day]
      const promises = activeWeekTasks[day].map((task, index) => 
        supabaseClient
          .from('tasks')
          .update({ position: index })
          .eq('id', task.id)
      );
      
      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw res.error;
      }
    } catch (error) {
      console.error("Database sync failed on save task order:", error);
      if (error.code === '42703' || (error.message && error.message.includes('position'))) {
        console.warn("Position column missing during update. Saving order locally instead.");
        saveStateToLocalStorage();
      } else {
        await loadActiveWeekDataFromDB();
      }
    }
  } else {
    saveStateToLocalStorage();
  }
}

// --- Local Storage Fallback Syncers ---
function loadStateFromLocalStorage() {
  const rawData = localStorage.getItem("weekly_schedule_tasks");
  if (rawData) {
    try {
      localStorageState = JSON.parse(rawData);
    } catch (e) {
      console.error("Failed to parse local storage:", e);
      localStorageState = { weeks: {} };
    }
  } else {
    localStorageState = { weeks: {} };
  }
  
  const activeMondayStr = getMondayDateString(activeWeekMonday);
  ensureLocalStorageWeekInitialized(activeMondayStr);
  
  const weekData = localStorageState.weeks[activeMondayStr];
  DAYS_OF_WEEK.forEach(day => {
    activeWeekTasks[day] = weekData.tasks[day] || [];
  });
  activeWeekNotes = weekData.notes || "";
  
  // Render local state
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

async function seedDefaultTasksIfNewUser(activeMondayStr) {
  try {
    // Check if the user has ANY tasks in the DB across all weeks
    const { data, error } = await supabaseClient
      .from('tasks')
      .select('id')
      .limit(1);
      
    if (error) throw error;
    
    if (data.length === 0) {
      const seedPayload = [];
      Object.keys(DEFAULT_TASKS).forEach(day => {
        DEFAULT_TASKS[day].forEach(task => {
          seedPayload.push({
            id: generateId(),
            user_id: currentUser.id,
            week_key: activeMondayStr,
            day: day,
            text: task.text,
            completed: task.completed,
            priority: task.priority
          });
        });
      });
      
      const { error: insertError } = await supabaseClient
        .from('tasks')
        .insert(seedPayload);
        
      if (insertError) throw insertError;
      console.log("Database seeded successfully with default tasks.");
    }
  } catch (e) {
    console.error("Seeding failed:", e);
  }
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
  
  // Render Day Cards structure
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
  
  // Render 8th Card: Weekly Focus & Notes
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
  
  // Event listener for autosaving notes
  const notesTextarea = document.getElementById("weekly-notes-textarea");
  notesTextarea.addEventListener("input", (e) => {
    saveNotesWithDebounce(e.target.value);
  });
  
  // Initialize SortableJS for each day's task list
  DAYS_OF_WEEK.forEach(day => {
    const container = document.getElementById(`tasks-container-${day}`);
    if (container) {
      new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: async (evt) => {
          await handleTaskOrderChange(day, container);
        }
      });
    }
  });

  // Load Icons
  lucide.createIcons();
}

function renderWeeklyGridDataOnly() {
  DAYS_OF_WEEK.forEach(day => {
    renderTasksForDay(day);
    updateDayStats(day);
  });
  
  // Populate notes
  const notesTextarea = document.getElementById("weekly-notes-textarea");
  if (notesTextarea) {
    notesTextarea.value = activeWeekNotes;
  }
  
  // Render Lucide icons for tasks
  lucide.createIcons();
}

function renderTasksForDay(day) {
  const container = document.getElementById(`tasks-container-${day}`);
  if (!container) return;
  
  // Clone and sort: incomplete tasks at the top, completed tasks at the bottom.
  // Within each group, preserve the relative position set by drag-and-drop.
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
async function navigateWeek(weeksDiff) {
  const candidateMonday = new Date(activeWeekMonday);
  candidateMonday.setDate(candidateMonday.getDate() + (weeksDiff * 7));
  
  const offset = getWeekOffset(candidateMonday);
  if (offset >= -1 && offset <= 2) {
    activeWeekMonday = candidateMonday;
    renderWeeklyGrid();
    updateNavigationUI();
    await loadActiveWeekDataFromDB();
  }
}

function updateNavigationUI() {
  const offset = getWeekOffset(activeWeekMonday);
  
  const prevBtn = document.getElementById("prev-week-btn");
  const nextBtn = document.getElementById("next-week-btn");
  
  if (prevBtn) prevBtn.disabled = (offset <= -1);
  if (nextBtn) nextBtn.disabled = (offset >= 2);
  
  // Format Date Range in Navbar
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
  
  // Update Relative Status Badge
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

// --- Database Mutation Handlers (CRUD) ---

window.toggleTaskStatus = async function(day, taskId) {
  const task = activeWeekTasks[day].find(t => t.id === taskId);
  if (task) {
    task.completed = !task.completed;
    
    // Re-render immediately to apply automatic sorting
    renderTasksForDay(day);
    updateDayStats(day);
    updateGlobalProgress();
    lucide.createIcons();
    
    // Sync to Database
    if (isDbSyncActive) {
      const { error } = await supabaseClient
        .from('tasks')
        .update({ completed: task.completed })
        .eq('id', taskId);
        
      if (error) {
        console.error("Database sync failed on toggle status:", error);
        await loadActiveWeekDataFromDB();
      }
    } else {
      saveStateToLocalStorage();
    }
  }
};

window.deleteTaskItem = async function(day, taskId) {
  activeWeekTasks[day] = activeWeekTasks[day].filter(t => t.id !== taskId);
  
  // Optimistic UI updates
  renderTasksForDay(day);
  updateDayStats(day);
  updateGlobalProgress();
  lucide.createIcons();
  
  // Sync to Database
  if (isDbSyncActive) {
    const { error } = await supabaseClient
      .from('tasks')
      .delete()
      .eq('id', taskId);
      
    if (error) {
      console.error("Database sync failed on delete task:", error);
      await loadActiveWeekDataFromDB();
    }
  } else {
    saveStateToLocalStorage();
  }
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

async function handleEditFormSubmit(e) {
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
    
    // Optimistic UI Updates
    renderTasksForDay(day);
    updateDayStats(day);
    updateGlobalProgress();
    closeEditModal();
    lucide.createIcons();
    
    // Sync to Database
    if (isDbSyncActive) {
      const { error } = await supabaseClient
        .from('tasks')
        .update({ text: newText, priority: priority })
        .eq('id', id);
        
      if (error) {
        console.error("Database sync failed on edit task:", error);
        await loadActiveWeekDataFromDB();
      }
    } else {
      saveStateToLocalStorage();
    }
  }
}

function saveNotesWithDebounce(notesText) {
  activeWeekNotes = notesText;
  if (notesSaveTimeout) clearTimeout(notesSaveTimeout);
  
  notesSaveTimeout = setTimeout(async () => {
    if (isDbSyncActive) {
      if (!currentUser) return;
      const activeMondayStr = getMondayDateString(activeWeekMonday);
      
      const { error } = await supabaseClient
        .from('weekly_notes')
        .upsert({
          user_id: currentUser.id,
          week_key: activeMondayStr,
          notes: notesText
        });
        
      if (error) {
        console.error("Database sync failed on save weekly notes:", error);
      }
    } else {
      saveStateToLocalStorage();
    }
  }, 1000); // 1-second debounce to throttle database writes
}

// --- Auth UI Operations ---
let authMode = "login"; // "login" or "signup"

window.toggleAuthMode = function(mode) {
  authMode = mode;
  
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");
  const submitBtn = document.getElementById("auth-submit-btn");
  const authHeaderP = document.querySelector(".auth-header p");
  
  // Clear banners
  document.getElementById("auth-error").style.display = "none";
  document.getElementById("auth-success").style.display = "none";
  
  if (mode === "login") {
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
    submitBtn.querySelector("span").textContent = "Log In";
    authHeaderP.textContent = "Private planner to organize your days and tasks";
  } else {
    tabLogin.classList.remove("active");
    tabSignup.classList.add("active");
    submitBtn.querySelector("span").textContent = "Sign Up";
    authHeaderP.textContent = "Create an account to start planning your week";
  }
}

async function handleAuthFormSubmit(e) {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;
  
  const errorBanner = document.getElementById("auth-error");
  const errorText = document.getElementById("auth-error-text");
  const successBanner = document.getElementById("auth-success");
  const successText = document.getElementById("auth-success-text");
  
  errorBanner.style.display = "none";
  successBanner.style.display = "none";
  
  const submitBtn = document.getElementById("auth-submit-btn");
  submitBtn.disabled = true;
  const originalText = submitBtn.querySelector("span").textContent;
  submitBtn.querySelector("span").textContent = "Processing...";
  
  try {
    if (authMode === "login") {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
    } else {
      const { error } = await supabaseClient.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      
      successText.textContent = "Registration successful! Please check your email inbox to verify your account before logging in.";
      successBanner.style.display = "flex";
      document.getElementById("auth-form").reset();
    }
  } catch (err) {
    errorText.textContent = err.message || "An authentication error occurred.";
    errorBanner.style.display = "flex";
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector("span").textContent = originalText;
  }
}

async function handleLogOut() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    console.error("Error signing out:", error);
  }
}

// --- Event Listeners Registration ---
function setupEventListeners() {
  // Listen for task addition inside grid day cards
  document.getElementById("weekly-grid").addEventListener("submit", async (e) => {
    if (e.target && e.target.classList.contains("add-task-form")) {
      e.preventDefault();
      const day = e.target.dataset.day;
      const input = e.target.querySelector(".add-task-input");
      const text = input.value.trim();
      
      if (text && currentUser) {
        const activeMondayStr = getMondayDateString(activeWeekMonday);
        const newTaskId = generateId();
        
        const nextPos = activeWeekTasks[day].length;
        
        const newTask = {
          id: newTaskId,
          user_id: currentUser.id,
          week_key: activeMondayStr,
          day: day,
          text: text,
          completed: false,
          priority: "medium",
          position: nextPos
        };
        
        // Optimistic UI updates
        activeWeekTasks[day].push({
          id: newTaskId,
          text: text,
          completed: false,
          priority: "medium",
          position: nextPos
        });
        
        input.value = "";
        renderTasksForDay(day);
        updateDayStats(day);
        updateGlobalProgress();
        lucide.createIcons();
        
        // Sync to Database
        if (isDbSyncActive) {
          let { error } = await supabaseClient
            .from('tasks')
            .insert(newTask);
            
          // If insert fails because position column doesn't exist, retry without position
          if (error && (error.code === '42703' || (error.message && error.message.includes('position')))) {
            console.warn("Position column not found during insert. Retrying insert without position...");
            const { position, ...taskWithoutPosition } = newTask;
            const retryRes = await supabaseClient
              .from('tasks')
              .insert(taskWithoutPosition);
            error = retryRes.error;
          }
            
          if (error) {
            console.error("Database sync failed on add task:", error);
            await loadActiveWeekDataFromDB();
          }
        } else {
          saveStateToLocalStorage();
        }
      }
    }
  });
  
  // Week navigation clicks
  const prevBtn = document.getElementById("prev-week-btn");
  if (prevBtn) {
    prevBtn.addEventListener("click", () => navigateWeek(-1));
  }
  
  const nextBtn = document.getElementById("next-week-btn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => navigateWeek(1));
  }
  
  // Edit Form submission
  document.getElementById("edit-task-form").addEventListener("submit", handleEditFormSubmit);
  
  // Edit Task Modal close buttons
  document.getElementById("close-modal-btn").addEventListener("click", closeEditModal);
  document.getElementById("cancel-edit-btn").addEventListener("click", closeEditModal);
  
  // Close modal when clicking overlay background
  document.getElementById("edit-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("edit-modal")) {
      closeEditModal();
    }
  });
  
  // Close modal on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("edit-modal").classList.contains("active")) {
      closeEditModal();
    }
  });
  
  // Auth Form tabs
  document.getElementById("tab-login").addEventListener("click", () => toggleAuthMode("login"));
  document.getElementById("tab-signup").addEventListener("click", () => toggleAuthMode("signup"));
  
  // Auth Form submission
  document.getElementById("auth-form").addEventListener("submit", handleAuthFormSubmit);
  
  // Log Out link
  document.getElementById("log-out-btn").addEventListener("click", handleLogOut);

  // FAQ Accordion Toggle
  const faqGrid = document.querySelector(".faq-accordion");
  if (faqGrid) {
    faqGrid.addEventListener("click", (e) => {
      const button = e.target.closest(".faq-question");
      if (!button) return;
      
      const item = button.closest(".faq-item");
      const isActive = item.classList.contains("active");
      
      // Close other items
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

// Utility to escape HTML to prevent XSS
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
