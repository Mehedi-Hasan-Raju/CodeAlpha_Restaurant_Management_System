require('dotenv').config();
const prisma = require('../src/prisma');

const cats = [
  ['Pizza', '🍕', 'Stone-baked pizzas in every size'],
  ['Burgers', '🍔', 'Handcrafted burgers and sliders'],
  ['Salads', '🥗', 'Fresh salads with house dressings'],
  ['Soups', '🍲', 'Warm soups made from scratch daily'],
  ['Desserts', '🍰', 'Sweet endings and indulgent treats'],
  ['Drinks', '🧋', 'Cold beverages and fresh juices'],
];

// [name, multiple, required, maxSelect, [[option, extraPrice]]]
const groups = [
  ['Pizza Size', false, true, 1, [['Regular 10"', 0], ['Large 12"', 1.5], ['XL 14"', 3]]],
  ['Extra Toppings', true, false, 4, [['Extra cheese', 0.8], ['Mushrooms', 0.7], ['Jalapeños', 0.5]]],
  ['Burger Add-ons', true, false, 3, [['Extra cheese slice', 0.5], ['Double patty', 1.2], ['Bacon', 0.9]]],
  ['Dressing', false, true, 1, [['Honey mustard', 0], ['Caesar', 0], ['Vinaigrette', 0]]],
  ['Drink Size', false, true, 1, [['Regular 450ml', 0], ['Large 650ml', 0.6]]],
];

// [name, category, price, type, description, [addon groups]]
const items = [
  ['Margherita Pizza', 'Pizza', 2.96, 'VEG', 'Classic tomato base with mozzarella', ['Pizza Size', 'Extra Toppings']],
  ['Pepperoni Pizza', 'Pizza', 3.56, 'NON_VEG', 'Loaded with pepperoni slices', ['Pizza Size', 'Extra Toppings']],
  ['BBQ Chicken Pizza', 'Pizza', 3.92, 'NON_VEG', 'Smoky BBQ sauce, grilled chicken', ['Pizza Size', 'Extra Toppings']],
  ['Veggie Supreme', 'Pizza', 3.32, 'VEG', 'Garden-fresh vegetables', ['Pizza Size', 'Extra Toppings']],
  ['Classic Beef Burger', 'Burgers', 2.96, 'NON_VEG', 'Juicy beef patty, lettuce, tomato', ['Burger Add-ons']],
  ['Garden Veggie Burger', 'Burgers', 2.25, 'VEG', 'Plant-based patty with avocado', ['Burger Add-ons']],
  ['Greek Salad', 'Salads', 2.4, 'VEG', 'Feta, olives, cucumber', ['Dressing']],
  ['Caesar Salad', 'Salads', 2.8, 'NON_VEG', 'Romaine, parmesan, croutons', ['Dressing']],
  ['Tomato Basil Soup', 'Soups', 1.9, 'VEG', 'Slow-simmered tomatoes', []],
  ['NY Cheesecake', 'Desserts', 2.5, 'VEG', 'Creamy baked cheesecake', []],
  ['Iced Tea', 'Drinks', 1.1, 'VEG', 'Chilled black tea', ['Drink Size']],
  ['Mango Smoothie', 'Drinks', 1.8, 'VEG', 'Fresh mango and yogurt', ['Drink Size']],
];

const coupons = [
  ['DINE15', 'PERCENTAGE', 15, 6, '15% off for dine-in orders'],
  ['FLAT5', 'FLAT', 5, 15, 'Flat 5 off orders above 15'],
  ['WELCOME20', 'PERCENTAGE', 20, 8, '20% off your first order'],
];

async function main() {
  const cat = {};
  for (const [name, emoji, description] of cats)
    cat[name] = await prisma.category.upsert({ where: { name }, update: {}, create: { name, emoji, description } });

  const grp = {};
  for (const [name, multiple, required, maxSelect, opts] of groups)
    grp[name] =
      (await prisma.addonGroup.findFirst({ where: { name } })) ||
      (await prisma.addonGroup.create({
        data: { name, multiple, required, maxSelect, options: { create: opts.map(([n, p]) => ({ name: n, extraPrice: p })) } },
      }));

  for (const [name, c, price, type, description, gs] of items) {
    if (await prisma.menuItem.findFirst({ where: { name } })) continue;
    await prisma.menuItem.create({
      data: { name, price, type, description, categoryId: cat[c].id, addonGroups: { connect: gs.map((g) => ({ id: grp[g].id })) } },
    });
  }

  for (const [code, discountType, value, minOrder, description] of coupons)
    await prisma.coupon.upsert({ where: { code }, update: {}, create: { code, discountType, value, minOrder, description } });

  console.log('Menu seeded');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());