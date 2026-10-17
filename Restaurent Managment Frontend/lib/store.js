'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import * as D from './data';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

// All data lives here for now. Later, replace each `set` with an API call (fetch) – see README.
export function Store({ children }) {
  const [db, setDb] = useState({
    category: D.cat2, addons: D.ad, coupons: D.cp, customers: D.cu,
    invoices: D.invs, payments: D.pays, reservations: D.rv,
    menu: D.items.map(x => [x.em, x.name, x.cat, x.price, x.type, x.desc]),
    inventory: D.stock.map((s, i) => [s[0], s[1], s[2], s[3], D.mm[i][0], D.mm[i][1]]),
  });
  const [orders, setOrders] = useState(D.orders.map(o => ({ ...o, lines: o.lines.map(([q, n]) => [q, n, D.items.find(i => i.name == n)?.price ?? 0]) })));
  const [msg, setMsg] = useState('');
  const set = (k, rows) => setDb(d => ({ ...d, [k]: rows }));
  const toast = t => { setMsg(t); setTimeout(() => setMsg(''), 1600); };
  const items = useMemo(() => db.menu.map((v, i) => ({ id: i, thumb: v[0], name: v[1], cat: v[2], price: v[3], type: v[4], desc: v[5] })), [db.menu]);
  return (
    <Ctx.Provider value={{ db, set, items, orders, setOrders, toast }}>
      {children}
      <div id="toast" className={msg ? 's' : ''}>{msg}</div>
    </Ctx.Provider>
  );
}
