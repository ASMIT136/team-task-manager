const state = {
  token: localStorage.getItem("ttm_token"),
  user: JSON.parse(localStorage.getItem("ttm_user") || "null"),
  view: "dashboard",
  data: {
    dashboard: null,
    projects: [],
    tasks: [],
    users: []
  }
};

const app = document.querySelector("#app");
const statuses = ["Todo", "In Progress", "Review", "Done"];

function saveSession(payload) {
  state.token = payload.token;
  state.user = payload.user;
  localStorage.setItem("ttm_token", payload.token);
  localStorage.setItem("ttm_user", JSON.stringify(payload.user));
}

function clearSession() {
  state.token = null;
  state.user = null;
  localStorage.removeItem("ttm_token");
  localStorage.removeItem("ttm_user");
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function fmtDate(value) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setError(message) {
  const node = document.querySelector("[data-error]");
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("show", Boolean(message));
}

function renderAuth(mode = "login") {
  app.innerHTML = `
    <section class="auth-page">
      <div class="auth-visual">
        <div class="brand"><span class="mark">T</span> Team Task Manager</div>
        <div>
          <h1>Plan work without losing the thread.</h1>
          <p>Create projects, add teammates, assign tasks, and keep overdue work visible before it becomes a surprise.</p>
        </div>
      </div>
      <div class="auth-panel">
        <form class="box" id="authForm">
          <h2>${mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p class="subtle">${mode === "login" ? "Use your login details or sign up as a new teammate." : "New accounts start as members."}</p>
          <div class="tabs">
            <button class="tab ${mode === "login" ? "active" : ""}" type="button" data-auth-tab="login">Login</button>
            <button class="tab ${mode === "signup" ? "active" : ""}" type="button" data-auth-tab="signup">Signup</button>
          </div>
          <div class="error" data-error></div>
          ${mode === "signup" ? '<div class="field"><label>Name</label><input name="name" autocomplete="name" required></div>' : ""}
          <div class="field"><label>Email</label><input name="email" type="email" autocomplete="email" value="${mode === "login" ? "admin@example.com" : ""}" required></div>
          <div class="field"><label>Password</label><input name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" value="${mode === "login" ? "Admin@123" : ""}" required></div>
          <button class="btn" type="submit">${mode === "login" ? "Login" : "Create account"}</button>
        </form>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-auth-tab]").forEach((button) => {
    button.addEventListener("click", () => renderAuth(button.dataset.authTab));
  });

  document.querySelector("#authForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      const data = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      saveSession(data);
      await boot();
    } catch (err) {
      setError(err.message);
    }
  });
}

async function loadData() {
  const [dashboard, projects, tasks, users] = await Promise.all([
    api("/api/dashboard"),
    api("/api/projects"),
    api("/api/tasks"),
    api("/api/users")
  ]);
  state.data.dashboard = dashboard;
  state.data.projects = projects.projects;
  state.data.tasks = tasks.tasks;
  state.data.users = users.users;
}

function layout(inner) {
  app.innerHTML = `
    <section class="app-shell">
      <aside class="sidebar">
        <div class="brand"><span class="mark">T</span> Team Task Manager</div>
        <nav class="nav">
          <button data-view="dashboard" class="${state.view === "dashboard" ? "active" : ""}">Dashboard</button>
          <button data-view="projects" class="${state.view === "projects" ? "active" : ""}">Projects</button>
          <button data-view="tasks" class="${state.view === "tasks" ? "active" : ""}">Tasks</button>
        </nav>
        <div class="user-strip">
          <strong>${escapeHtml(state.user.name)}</strong>
          <span>${escapeHtml(state.user.role)} - ${escapeHtml(state.user.email)}</span>
          <button class="btn secondary" data-logout>Logout</button>
        </div>
      </aside>
      <section class="content">${inner}</section>
    </section>
  `;
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      renderApp();
    });
  });
  document.querySelector("[data-logout]").addEventListener("click", () => {
    clearSession();
    renderAuth();
  });
}

function renderTop(title, copy, action = "") {
  return `
    <header class="topbar">
      <div>
        <h1>${title}</h1>
        <p>${copy}</p>
      </div>
      ${action}
    </header>
  `;
}

function renderDashboard() {
  const { stats, byStatus, dueSoon } = state.data.dashboard;
  layout(`
    ${renderTop("Dashboard", "Simple overview of your team's work.")}
    <section class="stats">
      <div class="stat"><span>Total tasks</span><strong>${stats.totalTasks}</strong></div>
      <div class="stat"><span>Completed</span><strong>${stats.completed}</strong></div>
      <div class="stat"><span>Overdue</span><strong>${stats.overdue}</strong></div>
      <div class="stat"><span>Active projects</span><strong>${stats.activeProjects}</strong></div>
    </section>
    <section class="dashboard-grid">
      <div class="panel">
        <h2>Status</h2>
        <div class="status-list">
          ${statuses.map((status) => `
            <div class="status-item">
              <span>${status}</span>
              <strong>${byStatus[status] || 0}</strong>
            </div>
          `).join("")}
        </div>
      </div>
      <div class="panel">
        <h2>Upcoming</h2>
        <div class="list">${dueSoon.length ? dueSoon.map(simpleTaskRow).join("") : '<div class="empty">No open tasks right now.</div>'}</div>
      </div>
    </section>
  `);
}

function userCheckboxes(project = null) {
  const selected = new Set(project?.members?.map((member) => member.id) || [state.user.id]);
  return state.data.users.map((user) => `
    <label class="check">
      <input type="checkbox" name="memberIds" value="${user.id}" ${selected.has(user.id) ? "checked" : ""}>
      ${escapeHtml(user.name)} (${user.role})
    </label>
  `).join("");
}

function renderProjects() {
  const projectCount = state.data.projects.length;
  layout(`
    ${renderTop("Projects", `${projectCount} project${projectCount === 1 ? "" : "s"} total.`)}
    <section class="simple-stack">
      <form class="panel" id="projectForm" style="${state.user.role === "Admin" ? "" : "display:none"}">
        <h2>Add project</h2>
        <div class="error" data-error></div>
        <div class="form-grid">
          <div class="field"><label>Name</label><input name="name" required></div>
          <div class="field"><label>Description</label><input name="description" placeholder="Optional"></div>
        </div>
        <div class="field"><label>Team</label><div class="members">${userCheckboxes()}</div></div>
        <button class="btn" type="submit">Add project</button>
      </form>
      <div class="list">${state.data.projects.length ? state.data.projects.map(projectCard).join("") : '<div class="empty">No projects yet.</div>'}</div>
    </section>
  `);
  const form = document.querySelector("#projectForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      setError("");
      const formData = new FormData(form);
      const memberIds = formData.getAll("memberIds");
      try {
        await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            name: formData.get("name"),
            description: formData.get("description"),
            memberIds
          })
        });
        form.reset();
        await refresh();
      } catch (err) {
        setError(err.message);
      }
    });
  }
}

function projectCard(project) {
  return `
    <article class="project">
      <div class="project-head">
        <div>
          <h3>${escapeHtml(project.name)}</h3>
          ${project.description ? `<p>${escapeHtml(project.description)}</p>` : ""}
        </div>
        <strong class="score">${project.progress}% done</strong>
      </div>
      <div class="meta">
        <span>${project.taskCount} tasks</span>
        <span>${project.members.length} members</span>
      </div>
    </article>
  `;
}

function projectOptions() {
  return state.data.projects.map((project) => `<option value="${project.id}">${escapeHtml(project.name)}</option>`).join("");
}

function assigneeOptions() {
  return state.data.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} (${user.role})</option>`).join("");
}

function renderTasks() {
  const taskCount = state.data.tasks.length;
  layout(`
    ${renderTop("Tasks", `${taskCount} task${taskCount === 1 ? "" : "s"} total.`)}
    <section class="simple-stack">
      <form class="panel" id="taskForm">
        <h2>Add task</h2>
        <div class="error" data-error></div>
        <div class="form-grid task-form-grid">
          <div class="field"><label>Title</label><input name="title" required></div>
          <div class="field"><label>Project</label><select name="projectId" required>${projectOptions()}</select></div>
          <div class="field"><label>Assignee</label><select name="assigneeId" ${state.user.role === "Member" ? "disabled" : ""}>${assigneeOptions()}</select></div>
          <div class="field"><label>Priority</label><select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></div>
          <div class="field"><label>Status</label><select name="status">${statuses.map((status) => `<option>${status}</option>`).join("")}</select></div>
          <div class="field"><label>Due date</label><input name="dueDate" type="date"></div>
        </div>
        <button class="btn" type="submit" ${state.data.projects.length ? "" : "disabled"}>Add task</button>
      </form>
      <div class="panel">
        <div class="toolbar">
          <h2>Task list</h2>
          <select data-filter>
            <option value="">All projects</option>
            ${projectOptions()}
          </select>
        </div>
        <div class="list" data-task-list>${state.data.tasks.length ? state.data.tasks.map(taskCard).join("") : '<div class="empty">No tasks yet.</div>'}</div>
      </div>
    </section>
  `);

  const assignee = document.querySelector("[name=assigneeId]");
  if (assignee && state.user.role === "Member") assignee.value = state.user.id;

  document.querySelector("#taskForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");
    const taskForm = event.currentTarget;
    const form = new FormData(taskForm);
    try {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify({
          projectId: form.get("projectId"),
          title: form.get("title"),
          description: "",
          assigneeId: state.user.role === "Member" ? state.user.id : form.get("assigneeId"),
          priority: form.get("priority"),
          status: form.get("status"),
          dueDate: form.get("dueDate")
        })
      });
      taskForm.reset();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  });

  document.querySelector("[data-filter]").addEventListener("change", (event) => {
    const projectId = event.target.value;
    const tasks = projectId ? state.data.tasks.filter((task) => task.projectId === projectId) : state.data.tasks;
    document.querySelector("[data-task-list]").innerHTML = tasks.length ? tasks.map(taskCard).join("") : '<div class="empty">No tasks for this project.</div>';
    bindTaskControls();
  });
  bindTaskControls();
}

function taskCard(task) {
  const canDelete = state.user.role === "Admin";
  const canEdit = state.user.role === "Admin" || task.assigneeId === state.user.id;
  return `
    <article class="task">
      <div class="task-head">
        <div>
          <h3>${escapeHtml(task.title)}</h3>
          <p>${escapeHtml(task.project?.name || "Project")} - ${escapeHtml(task.assignee?.name || "Unassigned")} - Due ${fmtDate(task.dueDate)}</p>
        </div>
        <span class="status-badge ${task.status === "Done" ? "done" : ""}">${task.status}</span>
      </div>
      <div class="meta">
        <span class="${task.priority.toLowerCase()}">${task.priority} priority</span>
      </div>
      <div class="status-row">
        <select data-task-status="${task.id}" ${canEdit ? "" : "disabled"}>
          ${statuses.map((status) => `<option ${task.status === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
        ${canDelete ? `<button class="btn danger" data-delete-task="${task.id}">Delete</button>` : ""}
      </div>
    </article>
  `;
}

function simpleTaskRow(task) {
  return `
    <article class="simple-row">
      <div>
        <strong>${escapeHtml(task.title)}</strong>
        <span>${escapeHtml(task.project?.name || "Project")} - ${escapeHtml(task.assignee?.name || "Unassigned")}</span>
      </div>
      <span>Due ${fmtDate(task.dueDate)}</span>
    </article>
  `;
}

function bindTaskControls() {
  document.querySelectorAll("[data-task-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await api(`/api/tasks/${select.dataset.taskStatus}`, {
        method: "PATCH",
        body: JSON.stringify({ status: select.value })
      });
      await refresh();
    });
  });
  document.querySelectorAll("[data-delete-task]").forEach((button) => {
    button.addEventListener("click", async () => {
      await api(`/api/tasks/${button.dataset.deleteTask}`, { method: "DELETE" });
      await refresh();
    });
  });
}

async function refresh() {
  await loadData();
  renderApp();
}

function renderApp() {
  if (state.view === "projects") return renderProjects();
  if (state.view === "tasks") return renderTasks();
  return renderDashboard();
}

async function boot() {
  if (!state.token) return renderAuth();
  try {
    const data = await api("/api/me");
    state.user = data.user;
    localStorage.setItem("ttm_user", JSON.stringify(data.user));
    await loadData();
    renderApp();
  } catch {
    clearSession();
    renderAuth();
  }
}

boot();
