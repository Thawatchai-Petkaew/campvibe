#!/usr/bin/env node
/**
 * Toggle / inspect the Camper Agent autonomous flag (DeliveryConfig singleton).
 * Same flag as the 🧠 Camper toggle in the /status "Gates need you" pane.
 *   node scripts/camper.mjs on      → autopilot decides G1–G4, escalates the rest
 *   node scripts/camper.mjs off     → every gate waits for the human
 *   node scripts/camper.mjs status  → show current state
 * Operates on the DB in the configured DATABASE_URL.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ID = "singleton";
const cmd = (process.argv[2] || "status").toLowerCase();

try {
  if (cmd === "on" || cmd === "off") {
    const on = cmd === "on";
    await prisma.deliveryConfig.upsert({
      where: { id: ID },
      update: { autonomousMode: on, updatedBy: "cli" },
      create: { id: ID, autonomousMode: on, updatedBy: "cli" },
    });
    console.log(`🧠 Camper Agent autonomous = ${on ? "ON" : "OFF"}`);
  } else if (cmd === "status") {
    const row = await prisma.deliveryConfig.findUnique({ where: { id: ID } });
    const on = !!row?.autonomousMode;
    const meta = row ? ` (updated ${row.updatedAt.toISOString()} by ${row.updatedBy ?? "?"})` : "";
    console.log(`🧠 Camper Agent autonomous = ${on ? "ON" : "OFF"}${meta}`);
  } else {
    console.log("usage: node scripts/camper.mjs <on|off|status>");
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
