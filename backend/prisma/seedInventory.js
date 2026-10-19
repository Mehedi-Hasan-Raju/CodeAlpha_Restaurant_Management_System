require('dotenv').config();
const prisma = require('../src/prisma');

// [name, category, unit, stock, min, max]
const items = [
  ['Basmati Rice', 'Grains', 'kg', 80, 30, 150],
  ['Butter', 'Dairy', 'kg', 3, 5, 20],
  ['Capsicum', 'Vegetables', 'kg', 0, 5, 20],
  ['Cheese', 'Dairy', 'kg', 2, 3, 10],
  ['Chicken', 'Proteins', 'kg', 45, 20, 100],
  ['Cooking Oil', 'Essentials', 'ltr', 22, 20, 60],
  ['Eggs', 'Proteins', 'pcs', 120, 50, 300],
  ['Fish (Rohu)', 'Proteins', 'kg', 6, 10, 25],
];

async function main() {
  for (const [name, category, unit, stock, minStock, maxStock] of items)
    await prisma.inventoryItem.upsert({ where: { name }, update: {}, create: { name, category, unit, stock, minStock, maxStock } });
  console.log('Inventory seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());