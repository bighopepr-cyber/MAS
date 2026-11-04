import { config } from "dotenv";
import * as argon2 from "argon2";
import { PrismaClient } from "@prisma/client";

config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });

const prisma = new PrismaClient();

const permissionDefinitions = [
  ["attendance.scan", "attendance", "scan"],
  ["attendance.view.own", "attendance", "view.own"],
  ["attendance.view.all", "attendance", "view.all"],
  ["attendance.monitor", "attendance", "monitor"],
  ["attendance.correction.create", "attendance", "correction.create"],
  ["attendance.correction.approve", "attendance", "correction.approve"],
  ["user.view", "user", "view"],
  ["user.create", "user", "create"],
  ["user.update", "user", "update"],
  ["personnel.view", "personnel", "view"],
  ["personnel.create", "personnel", "create"],
  ["personnel.update", "personnel", "update"],
  ["persit.view", "persit", "view"],
  ["persit.create", "persit", "create"],
  ["persit.update", "persit", "update"],
  ["checkpoint.view", "checkpoint", "view"],
  ["checkpoint.create", "checkpoint", "create"],
  ["checkpoint.update", "checkpoint", "update"],
  ["checkpoint.qr.generate", "checkpoint", "qr.generate"],
  ["checkpoint.qr.revoke", "checkpoint", "qr.revoke"],
  ["rbac.role.view", "rbac", "role.view"],
  ["rbac.role.create", "rbac", "role.create"],
  ["rbac.role.update", "rbac", "role.update"],
  ["rbac.role.delete", "rbac", "role.delete"],
  ["rbac.permission.view", "rbac", "permission.view"],
  ["rbac.permission.assign", "rbac", "permission.assign"],
  ["audit.view", "audit", "view"],
  ["report.export", "report", "export"],
  ["system.settings.view", "system", "settings.view"],
  ["organization.view", "organization", "view"],
  ["organization.create", "organization", "create"],
  ["organization.update", "organization", "update"],
  ["user.reset-pin", "user", "reset-pin"],
  ["rbac.role.assign", "rbac", "role.assign"],
  ["rbac.permission.create", "rbac", "permission.create"],
  ["attendance.policy.view", "attendance", "policy.view"],
  ["attendance.policy.manage", "attendance", "policy.manage"],
  ["dashboard.view", "dashboard", "view"],
  ["security.event.view", "security", "event.view"],
  ["security.incident.manage", "security", "incident.manage"],
  ["device.view", "device", "view"],
  ["notification.create", "notification", "create"],
];

async function seed(): Promise<void> {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
  const pin = process.env.BOOTSTRAP_ADMIN_PIN;
  if (!username || !pin || !/^\d{4,12}$/.test(pin)) {
    throw new Error("BOOTSTRAP_ADMIN_USERNAME dan PIN numerik 4-12 digit wajib disetel.");
  }

  for (const [code, module, action] of permissionDefinitions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code, module, action },
    });
  }

  const adminRole = await prisma.role.upsert({
    where: { code: "SUPER_ADMIN" },
    update: { isSystem: true, isActive: true },
    create: { code: "SUPER_ADMIN", name: "Super Administrator", isSystem: true },
  });
  const militaryRole = await prisma.role.upsert({
    where: { code: "MILITARY" },
    update: { isSystem: true, isActive: true },
    create: { code: "MILITARY", name: "Military", isSystem: true },
  });

  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      username,
      pinHash: await argon2.hash(pin, { type: argon2.argon2id }),
      accountType: "SYSTEM",
      isActive: true,
      isVerified: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
    update: { isActive: true },
    create: { userId: user.id, roleId: adminRole.id, assignedBy: user.id, isActive: true },
  });

  const permissions = await prisma.permission.findMany({
    select: { id: true },
  });
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: permission.id },
    });
  }
  const militaryPermissions = await prisma.permission.findMany({
    where: { code: { in: ["attendance.scan", "attendance.view.own"] } },
    select: { id: true },
  });
  for (const permission of militaryPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: militaryRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: militaryRole.id, permissionId: permission.id },
    });
  }
  console.info(`Bootstrap administrator is ready: ${username}`);
}

seed()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());