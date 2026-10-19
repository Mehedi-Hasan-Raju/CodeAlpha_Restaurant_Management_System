const router = require('express').Router();
const prisma = require('../prisma');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requireRole } = require('../middleware/auth');
const { num } = require('../utils/format');

router.use(authenticate, requireRole('ADMIN'));

const TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING'];

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const key = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const cents = (v) => Math.round(Number(v) * 100);
const sumC = (rows) => rows.reduce((s, o) => s + cents(o.total), 0);
const r2 = (n) => Math.round(n * 100) / 100;
const pct = (cur, prev) => (prev === 0 ? null : Math.round(((cur - prev) / prev) * 1000) / 10);

router.get('/', asyncHandler(async (req, res) => {
  const days = req.query.days === undefined ? 7 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 90)
    return res.status(400).json({ error: 'days must be a whole number from 1 to 90' });

  const today = startOfDay(new Date());
  const from = addDays(today, -(days - 1));   // first day of this period
  const prevFrom = addDays(from, -days);      // first day of the period before it

  const [rows, newCust, prevNewCust, totalCust, collected, topRows, recent, active, tableGroups] = await Promise.all([
    prisma.order.findMany({
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: prevFrom } },
      select: { createdAt: true, total: true, type: true },
    }),
    prisma.customer.count({ where: { createdAt: { gte: from } } }),
    prisma.customer.count({ where: { createdAt: { gte: prevFrom, lt: from } } }),
    prisma.customer.count(),
    prisma.payment.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: from } }, _sum: { amount: true } }),
    prisma.$queryRaw`
      SELECT oi."menuItemId", MAX(oi."name") AS "name",
             SUM(oi."quantity")::int AS "quantity",
             SUM(oi."quantity" * oi."unitPrice")::float8 AS "revenue"
      FROM "OrderItem" oi JOIN "Order" o ON o."id" = oi."orderId"
      WHERE o."status" <> 'CANCELLED' AND o."createdAt" >= ${from}
      GROUP BY oi."menuItemId"
      ORDER BY "quantity" DESC, "revenue" DESC
      LIMIT 5`,
    prisma.order.findMany({
      orderBy: { id: 'desc' }, take: 5,
      include: { table: { select: { name: true } }, customer: { select: { name: true } } },
    }),
    prisma.order.count({ where: { status: { in: ['NEW', 'PREPARING', 'READY'] } } }),
    prisma.diningTable.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const cur = [], prev = [];
  for (const o of rows) (o.createdAt >= from ? cur : prev).push(o);

  const revC = sumC(cur), prevRevC = sumC(prev);
  const avgC = cur.length ? revC / cur.length : 0;
  const prevAvgC = prev.length ? prevRevC / prev.length : 0;

  // one entry per day, even for days without sales
  const perDay = new Map();
  for (const o of cur) {
    const k = key(o.createdAt);
    const e = perDay.get(k) || { c: 0, n: 0 };
    e.c += cents(o.total); e.n += 1;
    perDay.set(k, e);
  }
  const salesByDay = Array.from({ length: days }, (_, i) => {
    const k = key(addDays(from, i));
    const e = perDay.get(k) || { c: 0, n: 0 };
    return { date: k, revenue: e.c / 100, orders: e.n };
  });

  const ordersByType = TYPES.map((type) => {
    const count = cur.filter((o) => o.type === type).length;
    return { type, count, percent: cur.length ? Math.round((count / cur.length) * 1000) / 10 : 0 };
  });

  const tables = Object.fromEntries(TABLE_STATUSES.map((s) => [s, 0]));
  for (const g of tableGroups) tables[g.status] = g._count._all;

  res.json({
    range: { days, from: key(from), to: key(today) },
    cards: {
      revenue: { value: revC / 100, change: pct(revC, prevRevC) },
      orders: { value: cur.length, change: pct(cur.length, prev.length) },
      avgOrder: { value: r2(avgC / 100), change: pct(avgC, prevAvgC) },
      customers: { total: totalCust, new: newCust, change: pct(newCust, prevNewCust) },
      collected: num(collected._sum.amount) || 0,
    },
    salesByDay,
    ordersByType,
    topItems: topRows.map((r) => ({ menuItemId: r.menuItemId, name: r.name, quantity: r.quantity, revenue: r2(Number(r.revenue)) })),
    recentOrders: recent.map((o) => ({
      id: o.id, type: o.type, status: o.status, total: num(o.total), createdAt: o.createdAt,
      tableName: o.table ? o.table.name : null, customerName: o.customer ? o.customer.name : null,
    })),
    live: { activeOrders: active, tables },
  });
}));

module.exports = router;