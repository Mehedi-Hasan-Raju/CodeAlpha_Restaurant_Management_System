const prisma = require('../prisma');

const TAX_RATE = 0.05;
const cents = (v) => Math.round(Number(v) * 100); // work in whole cents, so there are no decimal errors
const money = (c) => c / 100;

// Takes { items: [{ menuItemId, quantity, optionIds }], couponCode } and returns the full price breakdown,
// or { code, error } when something is wrong. Prices always come from the database.
async function price(body) {
  const { items, couponCode } = body || {};
  if (!Array.isArray(items) || items.length === 0) return { code: 400, error: 'items must be a non-empty array' };
  if (items.length > 50) return { code: 400, error: 'Too many lines (max 50)' };

  const ids = [...new Set(items.map((l) => Number(l && l.menuItemId)))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return { code: 400, error: 'every line needs a valid menuItemId' };

  const menu = await prisma.menuItem.findMany({
    where: { id: { in: ids } },
    include: { addonGroups: { where: { active: true }, include: { options: true } } },
  });
  const byId = new Map(menu.map((m) => [m.id, m]));

  const lines = [];
  for (const l of items) {
    const m = byId.get(Number(l.menuItemId));
    if (!m) return { code: 400, error: `Item ${l.menuItemId} not found` };
    if (!m.active) return { code: 400, error: `${m.name} is not available` };

    const qty = Number(l.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return { code: 400, error: `Quantity for ${m.name} must be 1 to 99` };

    const picked = (l.optionIds === undefined ? [] : l.optionIds);
    if (!Array.isArray(picked)) return { code: 400, error: 'optionIds must be an array' };
    const pickedIds = picked.map(Number);
    if (new Set(pickedIds).size !== pickedIds.length) return { code: 400, error: `Duplicate option for ${m.name}` };

    const chosen = [];
    for (const g of m.addonGroups) {
      const sel = g.options.filter((o) => pickedIds.includes(o.id));
      if (g.required && sel.length === 0) return { code: 400, error: `${m.name}: choose ${g.name}` };
      if (sel.length > (g.multiple ? g.maxSelect : 1)) return { code: 400, error: `${m.name}: too many choices in ${g.name}` };
      chosen.push(...sel);
    }
    if (chosen.length !== pickedIds.length) return { code: 400, error: `Invalid option for ${m.name}` };

    lines.push({
      menuItemId: m.id,
      name: m.name,
      quantity: qty,
      unitC: cents(m.price) + chosen.reduce((s, o) => s + cents(o.extraPrice), 0),
      options: chosen.map((o) => o.name).join(', ') || null,
    });
  }

  const subtotalC = lines.reduce((s, l) => s + l.unitC * l.quantity, 0);

  let coupon = null;
  let discountC = 0;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: String(couponCode).trim().toUpperCase() } });
    if (!coupon || !coupon.active) return { code: 400, error: 'Invalid coupon' };
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return { code: 400, error: 'Coupon has expired' };
    if (coupon.maxUses && coupon.used >= coupon.maxUses) return { code: 400, error: 'Coupon usage limit reached' };
    if (subtotalC < cents(coupon.minOrder)) return { code: 400, error: `Minimum order for this coupon is ${Number(coupon.minOrder)}` };
    discountC = coupon.discountType === 'PERCENTAGE'
      ? Math.round((subtotalC * Number(coupon.value)) / 100)
      : cents(coupon.value);
    discountC = Math.min(discountC, subtotalC);
  }

  const taxC = Math.round((subtotalC - discountC) * TAX_RATE);
  return { lines, coupon, subtotalC, discountC, taxC, totalC: subtotalC - discountC + taxC };
}

module.exports = { price, money, TAX_RATE };