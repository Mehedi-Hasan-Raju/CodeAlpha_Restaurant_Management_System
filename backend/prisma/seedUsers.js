require('dotenv').config();
const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma');

const users = [
  ['Kitchen Staff', 'kitchen@restropos.com', 'kitchen123', 'KITCHEN'],
  ['Cashier One', 'cashier@restropos.com', 'cashier123', 'CASHIER'],
];

async function main() {
  for (const [name, email, pass, role] of users)
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { name, email, role, passwordHash: await bcrypt.hash(pass, 10) },
    });
  console.log('Users ready: kitchen@restropos.com / kitchen123, cashier@restropos.com / cashier123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());