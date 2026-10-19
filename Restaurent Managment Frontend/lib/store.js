'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as D from './data';
import { apiRequest } from './api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const API_RESOURCES = new Set(['category', 'addons', 'coupons', 'customers', 'menu', 'reservations']);
const TOKEN_KEY = 'restropos_token';
const demoData = () => ({
  category: D.cat2, addons: D.ad, coupons: D.cp, customers: D.cu,
  invoices: D.invs, payments: D.pays, reservations: D.rv,
  menu: D.items.map(x => [x.em, x.name, x.cat, x.price, x.type, x.desc]),
  inventory: D.stock.map((s, i) => [s[0], s[1], s[2], s[3], D.mm[i][0], D.mm[i][1]]),
  tables: D.tables,
});
const demoOrders = () => D.orders.map(o => ({
  ...o,
  lines: o.lines.map(([q, n]) => [q, n, D.items.find(i => i.name == n)?.price ?? 0]),
}));
const statusName = value => value[0] + value.slice(1).toLowerCase();
const toLocalDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};
const toLocalTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const toReservedAt = (date, time) => {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new Error('Enter a valid reservation date and time');
  return value.toISOString();
};

export function Store({ children }) {
  const [db, setDb] = useState(demoData);
  const [ids, setIds] = useState({});
  const [orders, setOrders] = useState(demoOrders);
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const toast = t => { setMsg(t); setTimeout(() => setMsg(''), 1600); };

  const refreshData = useCallback(async activeToken => {
    setLoading(true);
    setDataLoaded(false);
    try {
      const [categories, menu, addons, coupons, tables, customers, reservations] = await Promise.all([
        apiRequest('/categories', { token: activeToken }),
        apiRequest('/items', { token: activeToken }),
        apiRequest('/addons', { token: activeToken }),
        apiRequest('/coupons', { token: activeToken }),
        apiRequest('/tables', { token: activeToken }),
        apiRequest('/customers', { token: activeToken }),
        apiRequest('/reservations', { token: activeToken }),
      ]);
      const categoryNames = new Map(categories.map(c => [c.id, c.name]));
      const tableNames = new Map(tables.map(t => [t.id, t.name]));
      const nextDb = {
        category: categories.map(c => [c.emoji || '🍽️', c.name, c.description || '', c.active ? 'Active' : 'Inactive']),
        menu: menu.map(i => [i.imageUrl || '🍽️', i.name, i.category || categoryNames.get(i.categoryId) || '', i.price, ({ VEG: 'Veg', NON_VEG: 'Non-Veg', EGG: 'Egg' })[i.type], i.description || '', i.active ? 'Active' : 'Inactive']),
        addons: addons.map(a => [a.name, a.multiple ? 'Multi' : 'Single', a.required ? 'Required' : 'Optional', a.options.map(o => `${o.name}:${o.extraPrice}`).join(', '), a.maxSelect, a.active ? 'Active' : 'Inactive']),
        coupons: coupons.map(c => [c.code, c.description || '', c.discountType === 'PERCENTAGE' ? 'Percentage' : 'Flat amount', c.value, c.minOrder, toLocalDate(c.expiresAt), c.maxUses ?? '', c.active ? 'Active' : 'Inactive', c.used]),
        customers: customers.map(c => [c.name, c.phone || '', c.email || '', c.orders, c.totalSpent, toLocalDate(c.createdAt)]),
        reservations: reservations.map(r => [r.guestName, toLocalDate(r.reservedAt), toLocalTime(r.reservedAt), r.partySize, r.tableName || tableNames.get(r.tableId) || '', statusName(r.status)]),
        tables: tables.map(t => [t.name, t.seats, t.area, statusName(t.status)]),
      };
      const nextIds = {
        category: categories.map(c => c.id),
        menu: menu.map(i => i.id),
        addons: addons.map(a => a.id),
        coupons: coupons.map(c => c.id),
        customers: customers.map(c => c.id),
        reservations: reservations.map(r => r.id),
        tables: tables.map(t => t.id),
      };
      setDb(current => ({ ...current, ...nextDb }));
      setIds(current => ({ ...current, ...nextIds }));
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!savedToken) return;
    setToken(savedToken);
    apiRequest('/auth/me', { token: savedToken })
      .then(async result => {
        setUser(result.user);
        await refreshData(savedToken);
      })
      .catch(error => {
        if (error.status === 401) {
          window.localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setUser(null);
        } else {
          toast(error.message);
        }
      });
  }, [refreshData]);

  const authenticate = async (kind, credentials) => {
    const result = await apiRequest(`/auth/${kind}`, { method: 'POST', body: credentials });
    window.localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setUser(result.user);
    await refreshData(result.token);
    return result.user;
  };

  const logout = () => {
    window.localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setDb(demoData());
    setIds({});
    setOrders(demoOrders());
    setDataLoaded(false);
    toast('Signed out');
  };

  const set = (k, rows) => setDb(d => ({ ...d, [k]: rows }));

  const saveResource = async (key, values, rowIndex) => {
    if (!token) throw new Error('Log in to save changes to the database');
    if (!dataLoaded) throw new Error('Database data is not ready yet');
    const id = rowIndex == null ? null : ids[key]?.[rowIndex];
    let path;
    let body;

    if (key === 'category') {
      path = '/categories';
      body = { emoji: values[0], name: values[1], description: values[2], active: values[3] === 'Active' };
    } else if (key === 'menu') {
      const categoryIndex = db.category.findIndex(row => row[1] === values[2]);
      const categoryId = ids.category?.[categoryIndex];
      if (!categoryId) throw new Error('Create or select a valid category first');
      path = '/items';
      body = {
        imageUrl: /^(data:image\/|https?:\/\/)/.test(values[0]) ? values[0] : null,
        name: values[1],
        categoryId,
        price: Number(values[3]),
        type: values[4].toUpperCase().replace('-', '_'),
        description: values[5],
        active: values[6] === 'Active',
      };
    } else if (key === 'addons') {
      path = '/addons';
      body = {
        name: values[0],
        multiple: values[1] === 'Multi',
        required: values[2] === 'Required',
        options: String(values[3] || '').split(',').map(value => {
          const option = value.trim();
          const separator = option.lastIndexOf(':');
          const name = separator < 0 ? option : option.slice(0, separator).trim();
          const extraPrice = separator < 0 ? 0 : Number(option.slice(separator + 1).trim());
          return { name, extraPrice };
        }).filter(option => option.name),
        maxSelect: Number(values[4]) || 1,
        active: values[5] === 'Active',
      };
    } else if (key === 'coupons') {
      path = '/coupons';
      body = {
        code: values[0],
        description: values[1],
        discountType: values[2] === 'Percentage' ? 'PERCENTAGE' : 'FLAT',
        value: Number(values[3]),
        minOrder: Number(values[4]),
        expiresAt: values[5] || null,
        maxUses: values[6] === '' ? null : Number(values[6]),
        active: values[7] === 'Active',
      };
    } else if (key === 'customers') {
      path = '/customers';
      body = { name: values[0], phone: values[1], email: values[2] };
    } else if (key === 'reservations') {
      const tableIndex = db.tables.findIndex(row => row[0] === values[4]);
      const tableId = tableIndex < 0 ? null : ids.tables?.[tableIndex];
      path = '/reservations';
      body = {
        guestName: values[0],
        reservedAt: toReservedAt(values[1], values[2]),
        partySize: Number(values[3]),
        tableId: tableId || null,
      };
    } else {
      throw new Error(`No database API is available for ${key}`);
    }

    const saved = await apiRequest(id == null ? path : `${path}/${id}`, {
      method: id == null ? 'POST' : 'PUT',
      body,
      token,
    });

    if (key === 'reservations') {
      const targetId = id ?? saved.id;
      const oldStatus = id == null ? 'Upcoming' : db.reservations[rowIndex]?.[5];
      if (targetId != null && oldStatus !== values[5]) {
        await apiRequest(`/reservations/${targetId}/status`, {
          method: 'PATCH',
          body: { status: values[5].toUpperCase() },
          token,
        });
      }
    }
    await refreshData(token);
  };

  const deleteResource = async (key, rowIndex) => {
    if (!token) throw new Error('Log in to delete database records');
    if (!dataLoaded) throw new Error('Database data is not ready yet');
    const id = ids[key]?.[rowIndex];
    if (id == null) throw new Error('This demo record is not stored in the database');
    const path = { category: '/categories', menu: '/items', addons: '/addons', coupons: '/coupons', customers: '/customers', reservations: '/reservations' }[key];
    if (!path) throw new Error(`No database API is available for ${key}`);
    await apiRequest(`${path}/${id}`, { method: 'DELETE', token });
    await refreshData(token);
  };

  const updateTableStatus = async (rowIndex, status) => {
    if (!token) throw new Error('Log in to update table status');
    if (!dataLoaded) throw new Error('Database data is not ready yet');
    const id = ids.tables?.[rowIndex];
    if (id == null) throw new Error('This demo table is not stored in the database');
    await apiRequest(`/tables/${id}/status`, { method: 'PATCH', body: { status: status.toUpperCase() }, token });
    await refreshData(token);
  };

  const items = useMemo(() => db.menu.flatMap((v, i) => v[6] === 'Inactive' ? [] : [{
    id: i,
    thumb: v[0],
    name: v[1],
    cat: v[2],
    price: Number(v[3]),
    type: v[4],
    desc: v[5],
  }]), [db.menu]);
  return (
    <Ctx.Provider value={{
      db, set, ids, items, orders, setOrders, toast, token, user, loading, dataLoaded,
      authenticate, logout, saveResource, deleteResource, updateTableStatus,
      apiResources: API_RESOURCES,
    }}>
      {children}
      <div id="toast" className={msg ? 's' : ''}>{msg}</div>
    </Ctx.Provider>
  );
}
