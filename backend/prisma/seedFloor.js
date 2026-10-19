require('dotenv').config();
const prisma = require('../src/prisma');

const tables = [
  ['Table 1', 2, 'Main Dining', 'OCCUPIED'], ['Table 2', 2, 'Main Dining', 'OCCUPIED'],
  ['Table 3', 4, 'Main Dining', 'AVAILABLE'], ['Table 4', 4, 'Main Dining', 'RESERVED'],
  ['Table 5', 4, 'Main Dining', 'OCCUPIED'], ['Table 6', 4, 'Main Dining', 'AVAILABLE'],
  ['Table 7', 6, 'Main Dining', 'CLEANING'], ['Table 8', 8, 'Private Room', 'RESERVED'],
  ['Table 9', 6, 'Private Room', 'AVAILABLE'], ['Table 10', 8, 'Private Room', 'OCCUPIED'],
  ['Table 11', 10, 'Outdoor', 'RESERVED'], ['Table 12', 12, 'Outdoor', 'AVAILABLE'],
];

const customers = [
  ['Andrew Clifton', '+44 7790 123019', 'andrew.clifton@gmail.com'],
  ['Catherine Douglas', '+44 7701 234010', 'catherine.d@icloud.com'],
  ['Charlotte Whitmore', '+44 7745 678004', 'charlotte.w@gmail.com'],
  ['Daniel Stanhope', '+44 7756 789015', 'daniel.s@gmail.com'],
  ['Dorothy Whitfield', '+44 7701 234020', 'dorothy.w@yahoo.com'],
  ['Edward Sinclair', '+44 7790 123009', 'edward.s@gmail.com'],
];

// [guest, party, table, hour, minute, day offset, status]
const reservations = [
  ['James Hartley', 4, 'Table 5', 13, 0, 0, 'SEATED'],
  ['Bennett Family', 4, 'Table 4', 19, 30, 0, 'UPCOMING'],
  ['Hartley Birthday', 8, 'Table 11', 20, 0, 0, 'UPCOMING'],
  ['William Thornton', 6, 'Table 8', 20, 30, 1, 'UPCOMING'],
];

const at = (h, m, off) => { const d = new Date(); d.setDate(d.getDate() + off); d.setHours(h, m, 0, 0); return d; };

async function main() {
  const t = {};
  for (const [name, seats, area, status] of tables)
    t[name] = await prisma.diningTable.upsert({ where: { name }, update: {}, create: { name, seats, area, status } });

  for (const [name, phone, email] of customers)
    await prisma.customer.upsert({ where: { email }, update: {}, create: { name, phone, email } });

  for (const [guestName, partySize, table, h, m, off, status] of reservations) {
    if (await prisma.reservation.findFirst({ where: { guestName } })) continue;
    await prisma.reservation.create({
      data: { guestName, partySize, reservedAt: at(h, m, off), durationMin: 90, status, tableId: t[table].id },
    });
  }
  console.log('Tables, customers and reservations seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());