module.exports = (router) =>
  router.param('id', (req, res, next, v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'Invalid id' });
    req.id = n;
    next();
  });