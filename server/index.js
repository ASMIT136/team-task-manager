const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const createRouter = require("./router");
const { readDb, writeDb, id, now, publicUser } = require("./db");
const { hashPassword, verifyPassword, createSession, requireAuth, requireAdmin } = require("./auth");

const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, "..", "public");
const router = createRouter();
const validStatuses = ["Todo", "In Progress", "Review", "Done"];

function send(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large."));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
  });
}

function cleanText(value) {
  return String(value || "").trim();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function canAccessProject(db, user, projectId) {
  return user.role === "Admin" || db.projectMembers.some((item) => item.projectId === projectId && item.userId === user.id);
}

function enrichProject(db, project) {
  const members = db.projectMembers
    .filter((item) => item.projectId === project.id)
    .map((item) => publicUser(db.users.find((user) => user.id === item.userId)))
    .filter(Boolean);
  const tasks = db.tasks.filter((task) => task.projectId === project.id);
  const done = tasks.filter((task) => task.status === "Done").length;
  return {
    ...project,
    members,
    taskCount: tasks.length,
    progress: tasks.length ? Math.round((done / tasks.length) * 100) : 0
  };
}

function decorateTask(db, task) {
  return {
    ...task,
    project: db.projects.find((project) => project.id === task.projectId) || null,
    assignee: publicUser(db.users.find((user) => user.id === task.assigneeId))
  };
}

function visibleTasks(db, user) {
  if (user.role === "Admin") return db.tasks;
  const projectIds = db.projectMembers.filter((item) => item.userId === user.id).map((item) => item.projectId);
  return db.tasks.filter((task) => task.assigneeId === user.id || projectIds.includes(task.projectId));
}

router.add("POST", "/api/auth/signup", async (req, res) => {
  const body = await parseBody(req);
  const name = cleanText(body.name);
  const email = cleanText(body.email).toLowerCase();
  const password = String(body.password || "");
  const role = "Member";

  if (name.length < 2) return res.error(400, "Name must be at least 2 characters.");
  if (!isEmail(email)) return res.error(400, "Enter a valid email address.");
  if (password.length < 8) return res.error(400, "Password must be at least 8 characters.");

  const db = readDb();
  if (db.users.some((user) => user.email === email)) return res.error(409, "That email is already registered.");

  const user = {
    id: id("usr"),
    name,
    email,
    passwordHash: hashPassword(password),
    role,
    createdAt: now()
  };
  db.users.push(user);
  writeDb(db);
  send(res, 201, { user: publicUser(user), token: createSession(user) });
});

router.add("POST", "/api/auth/login", async (req, res) => {
  const body = await parseBody(req);
  const email = cleanText(body.email).toLowerCase();
  const password = String(body.password || "");
  const db = readDb();
  const user = db.users.find((item) => item.email === email);
  if (!user || !verifyPassword(password, user.passwordHash)) return res.error(401, "Email or password is incorrect.");
  send(res, 200, { user: publicUser(user), token: createSession(user) });
});

router.add("GET", "/api/me", requireAuth((req, res, params, user) => {
  send(res, 200, { user: publicUser(user) });
}));

router.add("GET", "/api/users", requireAuth((req, res, params, user) => {
  const db = readDb();
  send(res, 200, { users: db.users.map(publicUser) });
}));

router.add("GET", "/api/dashboard", requireAuth((req, res, params, user) => {
  const db = readDb();
  const tasks = visibleTasks(db, user);
  const today = new Date();
  const overdue = tasks.filter((task) => task.status !== "Done" && task.dueDate && new Date(task.dueDate) < today).length;
  const byStatus = validStatuses.reduce((acc, status) => {
    acc[status] = tasks.filter((task) => task.status === status).length;
    return acc;
  }, {});
  const projectIds = new Set(tasks.map((task) => task.projectId));
  db.projectMembers.filter((item) => item.userId === user.id).forEach((item) => projectIds.add(item.projectId));
  send(res, 200, {
    stats: {
      totalTasks: tasks.length,
      overdue,
      completed: byStatus.Done,
      activeProjects: user.role === "Admin" ? db.projects.length : projectIds.size
    },
    byStatus,
    dueSoon: tasks
      .filter((task) => task.status !== "Done")
      .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))
      .slice(0, 6)
      .map((task) => decorateTask(db, task))
  });
}));

router.add("GET", "/api/projects", requireAuth((req, res, params, user) => {
  const db = readDb();
  const projects = db.projects
    .filter((project) => canAccessProject(db, user, project.id))
    .map((project) => enrichProject(db, project));
  send(res, 200, { projects });
}));

router.add("POST", "/api/projects", requireAdmin(async (req, res, params, user) => {
  const body = await parseBody(req);
  const name = cleanText(body.name);
  const description = cleanText(body.description);
  const memberIds = Array.isArray(body.memberIds) ? body.memberIds : [];
  if (name.length < 3) return res.error(400, "Project name must be at least 3 characters.");

  const db = readDb();
  const project = {
    id: id("prj"),
    name,
    description,
    ownerId: user.id,
    createdAt: now()
  };
  db.projects.push(project);
  const allowedMembers = new Set([user.id, ...memberIds.filter((memberId) => db.users.some((item) => item.id === memberId))]);
  allowedMembers.forEach((memberId) => db.projectMembers.push({ projectId: project.id, userId: memberId }));
  writeDb(db);
  send(res, 201, { project: enrichProject(db, project) });
}));

router.add("PATCH", "/api/projects/:id", requireAdmin(async (req, res, params) => {
  const body = await parseBody(req);
  const db = readDb();
  const project = db.projects.find((item) => item.id === params.id);
  if (!project) return res.error(404, "Project not found.");
  const name = cleanText(body.name);
  if (name.length < 3) return res.error(400, "Project name must be at least 3 characters.");
  project.name = name;
  project.description = cleanText(body.description);
  if (Array.isArray(body.memberIds)) {
    db.projectMembers = db.projectMembers.filter((item) => item.projectId !== project.id);
    const memberIds = new Set([project.ownerId, ...body.memberIds.filter((memberId) => db.users.some((user) => user.id === memberId))]);
    memberIds.forEach((memberId) => db.projectMembers.push({ projectId: project.id, userId: memberId }));
  }
  writeDb(db);
  send(res, 200, { project: enrichProject(db, project) });
}));

router.add("GET", "/api/tasks", requireAuth((req, res, params, user) => {
  const db = readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const projectId = url.searchParams.get("projectId");
  let tasks = visibleTasks(db, user);
  if (projectId) tasks = tasks.filter((task) => task.projectId === projectId);
  send(res, 200, { tasks: tasks.map((task) => decorateTask(db, task)) });
}));

router.add("POST", "/api/tasks", requireAuth(async (req, res, params, user) => {
  const body = await parseBody(req);
  const title = cleanText(body.title);
  const projectId = cleanText(body.projectId);
  const assigneeId = cleanText(body.assigneeId);
  const status = validStatuses.includes(body.status) ? body.status : "Todo";
  const priority = ["Low", "Medium", "High"].includes(body.priority) ? body.priority : "Medium";
  if (title.length < 3) return res.error(400, "Task title must be at least 3 characters.");

  const db = readDb();
  const project = db.projects.find((item) => item.id === projectId);
  if (!project) return res.error(404, "Project not found.");
  if (!canAccessProject(db, user, projectId)) return res.error(403, "You are not on this project.");
  if (user.role !== "Admin" && assigneeId && assigneeId !== user.id) return res.error(403, "Members can only assign tasks to themselves.");
  const finalAssigneeId = assigneeId || user.id;
  if (!db.projectMembers.some((item) => item.projectId === projectId && item.userId === finalAssigneeId)) {
    return res.error(400, "Assignee must be a project member.");
  }

  const task = {
    id: id("tsk"),
    projectId,
    title,
    description: cleanText(body.description),
    assigneeId: finalAssigneeId,
    status,
    priority,
    dueDate: cleanText(body.dueDate),
    createdBy: user.id,
    createdAt: now(),
    updatedAt: now()
  };
  db.tasks.push(task);
  writeDb(db);
  send(res, 201, { task: decorateTask(db, task) });
}));

router.add("PATCH", "/api/tasks/:id", requireAuth(async (req, res, params, user) => {
  const body = await parseBody(req);
  const db = readDb();
  const task = db.tasks.find((item) => item.id === params.id);
  if (!task) return res.error(404, "Task not found.");
  if (!canAccessProject(db, user, task.projectId)) return res.error(403, "You cannot update this task.");
  if (user.role !== "Admin" && task.assigneeId !== user.id) return res.error(403, "Members can update their own tasks only.");

  if (body.title !== undefined) {
    const title = cleanText(body.title);
    if (title.length < 3) return res.error(400, "Task title must be at least 3 characters.");
    task.title = title;
  }
  if (body.description !== undefined) task.description = cleanText(body.description);
  if (body.status !== undefined) {
    if (!validStatuses.includes(body.status)) return res.error(400, "Invalid status.");
    task.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!["Low", "Medium", "High"].includes(body.priority)) return res.error(400, "Invalid priority.");
    task.priority = body.priority;
  }
  if (body.dueDate !== undefined) task.dueDate = cleanText(body.dueDate);
  if (body.assigneeId !== undefined) {
    if (user.role !== "Admin") return res.error(403, "Only admins can reassign tasks.");
    if (!db.projectMembers.some((item) => item.projectId === task.projectId && item.userId === body.assigneeId)) {
      return res.error(400, "Assignee must be a project member.");
    }
    task.assigneeId = body.assigneeId;
  }
  task.updatedAt = now();
  writeDb(db);
  send(res, 200, { task: decorateTask(db, task) });
}));

router.add("DELETE", "/api/tasks/:id", requireAdmin((req, res, params) => {
  const db = readDb();
  const task = db.tasks.find((item) => item.id === params.id);
  if (!task) return res.error(404, "Task not found.");
  db.tasks = db.tasks.filter((item) => item.id !== params.id);
  writeDb(db);
  send(res, 200, { ok: true });
}));

function contentType(filePath) {
  const ext = path.extname(filePath);
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml"
  }[ext] || "application/octet-stream";
}

function serveStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(publicDir, "index.html"), (fallbackErr, fallback) => {
        if (fallbackErr) {
          res.writeHead(404);
          return res.end("Not found");
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fallback);
      });
      return;
    }
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.error = (status, message) => send(res, status, { error: message });

  const route = router.match(req.method, url.pathname);
  if (url.pathname.startsWith("/api/")) {
    if (!route) return res.error(404, "Route not found.");
    try {
      return await route.handler(req, res, route.params);
    } catch (err) {
      return res.error(400, err.message || "Something went wrong.");
    }
  }
  serveStatic(req, res, url.pathname);
});

server.listen(PORT, () => {
  console.log(`Team Task Manager running on http://localhost:${PORT}`);
});
