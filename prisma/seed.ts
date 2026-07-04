import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const password = await bcrypt.hash("admin123", 12)
  const staffPw = await bcrypt.hash("staff123", 12)
  const guestPw = await bcrypt.hash("guest123", 12)

  await prisma.user.upsert({
    where: { email: "admin@nlm.org" },
    update: {},
    create: { name: "Admin", email: "admin@nlm.org", password, role: "ADMIN" },
  })

  await prisma.user.upsert({
    where: { email: "staff@nlm.org" },
    update: {},
    create: { name: "Staff", email: "staff@nlm.org", password: staffPw, role: "STAFF" },
  })

  await prisma.user.upsert({
    where: { email: "guest@nlm.org" },
    update: {},
    create: { name: "Guesthouse", email: "guest@nlm.org", password: guestPw, role: "GUESTHOUSE" },
  })

  console.log("Seeded default users")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
