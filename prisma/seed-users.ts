// Resets just the three default accounts to fresh defaults — run with
// `npm run seed:users`. Does NOT touch items/stockrooms/movements/etc.
// (see seed.ts for the full seed). Existing rows are reset in place
// (not deleted) since Movement.userId / Booking.createdById reference
// these users with no cascade — a hard delete would fail once either
// table has rows.
import bcrypt from "bcryptjs"
import { prisma } from "../src/lib/prisma"

const users = [
  { name: "Admin", email: "admin@nlm.org", password: "admin123", role: "ADMIN" as const },
  { name: "Staff", email: "staff@nlm.org", password: "staff123", role: "STAFF" as const },
  { name: "Guesthouse", email: "guest@nlm.org", password: "guest123", role: "GUESTHOUSE" as const },
]

async function main() {
  for (const u of users) {
    const password = await bcrypt.hash(u.password, 12)
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, password, role: u.role, active: true, mustChangePassword: true },
      create: { name: u.name, email: u.email, password, role: u.role, mustChangePassword: true },
    })
    console.log(`Fresh ${u.role} — ${u.email} / ${u.password}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
