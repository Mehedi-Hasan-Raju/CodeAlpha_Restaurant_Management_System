const num = (v) => (v == null ? v : Number(v));
const isNum = (v) => v !== '' && v != null && !Number.isNaN(Number(v));

const fmtItem = (i) => ({
  id: i.id,
  name: i.name,
  description: i.description,
  price: num(i.price),
  type: i.type,
  imageUrl: i.imageUrl,
  active: i.active,
  categoryId: i.categoryId,
  category: i.category ? i.category.name : undefined,
  addonGroupIds: (i.addonGroups || []).map((g) => g.id),
});

const fmtGroup = (g) => ({
  ...g,
  options: (g.options || []).map((o) => ({ ...o, extraPrice: num(o.extraPrice) })),
});

const fmtCoupon = (c) => ({ ...c, value: num(c.value), minOrder: num(c.minOrder) });

module.exports = { num, isNum, fmtItem, fmtGroup, fmtCoupon };