require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

async function main() {
  const email = 'admin@restropos.com';
  const passwordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { name: 'Admin', email, passwordHash, role: 'ADMIN' },
  });
  console.log('Admin ready: admin@restropos.com / admin123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());