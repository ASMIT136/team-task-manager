TEAM TASK MANAGER

Project Description:
Team Task Manager is a full-stack web application designed for small teams to manage projects and tasks. Users can sign up, log in, create projects, assign tasks, update task status, and track progress through a dashboard.

Live Website:
https://team-task-manager-f155.onrender.com

GitHub Repository:
https://github.com/ASMIT136/team-task-manager


Tech Stack:
- Node.js
- HTML
- CSS
- JavaScript
- REST APIs
- JSON file-based database

Key Features:
- User signup and login
- Password hashing for authentication
- Admin and Member roles
- Project creation and team membership
- Task creation and assignment
- Task priority, due date, and status tracking
- Dashboard showing total tasks, completed tasks, overdue tasks, active projects, and upcoming work
- REST APIs with validation and role-based access control

User Roles:
Admin:
- Can create projects
- Can add team members to projects
- Can assign tasks
- Can update and delete tasks

Member:
- Can view assigned projects
- Can create tasks for themselves
- Can update their own task status

Demo Login:
Admin email: admin@example.com
Admin password: Available on request

Member email: member@example.com
Member password: Member@123

How To Run Locally:
1. Open the project folder
2. Run: npm run seed
3. Run: npm start
4. Open: http://localhost:3000

Environment Variables:
SESSION_SECRET = required for session signing
ADMIN_PASSWORD = private admin password for deployment

Notes:
This project uses a JSON file-based database for demo purposes. For production use, it can be upgraded to MongoDB, PostgreSQL, Supabase, or Firebase.

Submitted By:
Asmit

