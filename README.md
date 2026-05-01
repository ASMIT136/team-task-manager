# Team Task Manager

A full-stack task manager for small project teams. Users can sign up, log in, create projects, add team members, assign tasks, update task status, and view a dashboard with progress and overdue work.

## Features

- Signup and login with hashed passwords
- Admin and Member roles
- Project creation and team membership
- Task creation, assignment, priority, due date, and status tracking
- Dashboard with total tasks, completed tasks, overdue count, active projects, status split, and upcoming work
- REST API with validation and role-based access rules
- JSON document database stored in `data/db.json`

## Tech Stack

- Node.js
- HTML, CSS, JavaScript
- REST APIs
- File-based NoSQL-style JSON database

No external npm packages are required.

## Demo Accounts

Run the seed command once:

```bash
npm run seed
```

Then use:

```text
Admin: admin@example.com / Admin@123
Member: member@example.com / Member@123
```

## Local Setup

```bash
npm run seed
npm start
```

Open:

```text
http://localhost:3000
```

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```bash
npm.cmd run seed
npm.cmd start
```

## Role Rules

- Admins can create projects, add members, assign tasks to project members, update tasks, and delete tasks.
- Members can view projects they belong to.
- Members can create tasks for themselves inside their projects.
- Members can update tasks assigned to them.

## API Routes

| Method | Route | Access |
| --- | --- | --- |
| POST | `/api/auth/signup` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/me` | Logged in |
| GET | `/api/users` | Logged in |
| GET | `/api/dashboard` | Logged in |
| GET | `/api/projects` | Logged in |
| POST | `/api/projects` | Admin |
| PATCH | `/api/projects/:id` | Admin |
| GET | `/api/tasks` | Logged in |
| POST | `/api/tasks` | Logged in |
| PATCH | `/api/tasks/:id` | Logged in, with ownership rules |
| DELETE | `/api/tasks/:id` | Admin |

## Railway Deployment

1. Push this folder to a GitHub repository.
2. Open Railway and create a new project from the GitHub repo.
3. Set the start command to:

```bash
npm start
```

4. Add this environment variable:

```text
SESSION_SECRET=use-a-long-random-secret
```

5. Deploy and open the generated Railway URL.
6. If you want demo data in production, run the Railway shell command:

```bash
npm run seed
```

For longer-term data persistence on Railway, attach a volume and set:

```text
DATA_DIR=/data
```

## Submission Checklist

- Live URL: add your Railway URL here
- GitHub repo: add your repository URL here
- Demo video: record login, project creation, task assignment, status update, and dashboard

