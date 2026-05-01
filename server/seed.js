const { readDb, writeDb, id, now } = require("./db");
const { hashPassword } = require("./auth");

function seedDb() {
  const db = readDb();
  const adminName = process.env.ADMIN_NAME || "Admin User";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";

  if (!db.users.length) {
    const admin = {
      id: id("usr"),
      name: adminName,
      email: adminEmail,
      passwordHash: hashPassword(adminPassword),
      role: "Admin",
      createdAt: now()
    };
    const member = {
      id: id("usr"),
      name: "Arjun Mehta",
      email: "member@example.com",
      passwordHash: hashPassword("Member@123"),
      role: "Member",
      createdAt: now()
    };
    const project = {
      id: id("prj"),
      name: "Website Launch",
      description: "Prepare design, API, and launch checks for the first release.",
      ownerId: admin.id,
      createdAt: now()
    };
    db.users.push(admin, member);
    db.projects.push(project);
    db.projectMembers.push({ projectId: project.id, userId: admin.id }, { projectId: project.id, userId: member.id });
    db.tasks.push(
      {
        id: id("tsk"),
        projectId: project.id,
        title: "Finalize dashboard cards",
        description: "Use task totals, overdue count, and completion numbers.",
        assigneeId: member.id,
        status: "In Progress",
        priority: "High",
        dueDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
        createdBy: admin.id,
        createdAt: now(),
        updatedAt: now()
      },
      {
        id: id("tsk"),
        projectId: project.id,
        title: "Check Railway environment variables",
        description: "Set SESSION_SECRET and confirm the deployed URL opens correctly.",
        assigneeId: admin.id,
        status: "Todo",
        priority: "Medium",
        dueDate: new Date(Date.now() + 172800000).toISOString().slice(0, 10),
        createdBy: admin.id,
        createdAt: now(),
        updatedAt: now()
      }
    );
    writeDb(db);
    return { seeded: true, adminEmail };
  }

  return { seeded: false };
}

if (require.main === module) {
  const result = seedDb();
  if (result.seeded) {
    console.log("Seed data created.");
    console.log(`Admin: ${result.adminEmail}`);
    console.log("Member: member@example.com / Member@123");
  } else {
    console.log("Seed skipped. Database already has users.");
  }
}

module.exports = seedDb;
