'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from './api';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const API_RESOURCES = new Set([
  'category', 'addons', 'coupons', 'customers', 'menu', 'reservations',
  'inventory', 'invoices', 'payments',
]);
const TOKEN_KEY = 'restropos_token';
const emptyDb = () => ({
  category: [], addons: [], coupons: [], customers: [], invoices: [],
  payments: [], reservations: [], menu: [], inventory: [], tables: [],
});
const localDate = value => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const localTime = value => {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};
const humanize = value => String(value || '').toLowerCase().split('_').map(part => part[0]?.toUpperCase() + part.slice(1)).join(' ');
const orderType = value => ({ DINE_IN: 'Dine-in', TAKEAWAY: 'Takeaway', DELIVERY: 'Delivery' })[value] || humanize(value);
const toReservedAt = (date, time) => {
  const value = new Date(`${date}T${time}`);
  if (Number.isNaN(value.getTime())) throw new Error('Enter a valid reservation date and time');
  return value.toISOString();
};
const apiOrder = order => ({
  id: order.id,
  type: orderType(order.type),
  st: humanize(order.status),
  who: order.tableName || order.customerName || 'Walk-in',
  lines: order.items.map(item => [item.quantity, item.name, Number(item.unitPrice)]),
  total: Number(order.total),
});

export function Store({ children }) {
  const [db, setDb] = useState(emptyDb);
  const [ids, setIds] = useState({});
  const [orders, setOrders] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [dataError, setDataError] = useState('');
  const [msg, setMsg] = useState('');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const toast = useCallback(message => {
    setMsg(message);
    setTimeout(() => setMsg(''), 2500);
  }, []);

  const refreshData = useCallback(async activeToken => {
    setLoading(true);
    setDataLoaded(false);
    setDataError('');
    try {
      const [
        categories, menu, addons, coupons, tables, customers, reservations,
        orderResult, invoiceResult, paymentResult, inventoryResult,
      ] = await Promise.all([
        apiRequest('/categories', { token: activeToken }),
        apiRequest('/items', { token: activeToken }),
        apiRequest('/addons', { token: activeToken }),
        apiRequest('/coupons', { token: activeToken }),
        apiRequest('/tables', { token: activeToken }),
        apiRequest('/customers', { token: activeToken }),
        apiRequest('/reservations', { token: activeToken }),
        apiRequest('/orders?limit=100', { token: activeToken }),
        apiRequest('/invoices?limit=100', { token: activeToken }),
        apiRequest('/payments?limit=100', { token: activeToken }),
        apiRequest('/inventory', { token: activeToken }),
      ]);
      const orderRows = orderResult.data;
      const invoiceRows = invoiceResult.data;
      const paymentRows = paymentResult.data;
      const inventoryRows = inventoryResult.data;
      const tableNames = new Map(tables.map(table => [table.id, table.name]));
      const nextDb = {
        category: categories.map(category => [category.emoji || '🍽️', category.name, category.description || '', category.active ? 'Active' : 'Inactive']),
        menu: menu.map(item => [
          item.imageUrl || '🍽️', item.name, item.category || '', Number(item.price),
          ({ VEG: 'Veg', NON_VEG: 'Non-Veg', EGG: 'Egg' })[item.type] || humanize(item.type),
          item.description || '', item.active ? 'Active' : 'Inactive', item.addonGroupIds,
        ]),
        addons: addons.map(addon => [
          addon.name, addon.multiple ? 'Multi' : 'Single', addon.required ? 'Required' : 'Optional',
          addon.options.map(option => `${option.name}:${option.extraPrice}`).join(', '),
          addon.maxSelect, addon.active ? 'Active' : 'Inactive', addon.id, addon.options,
        ]),
        coupons: coupons.map(coupon => [
          coupon.code, coupon.description || '', coupon.discountType === 'PERCENTAGE' ? 'Percentage' : 'Flat amount',
          Number(coupon.value), Number(coupon.minOrder), localDate(coupon.expiresAt),
          coupon.maxUses ?? '', coupon.active ? 'Active' : 'Inactive', coupon.used,
        ]),
        customers: customers.map(customer => [
          customer.name, customer.phone || '', customer.email || '', customer.orders,
          Number(customer.totalSpent), localDate(customer.createdAt),
        ]),
        reservations: reservations.map(reservation => [
          reservation.guestName, localDate(reservation.reservedAt), localTime(reservation.reservedAt),
          reservation.partySize, reservation.tableName || tableNames.get(reservation.tableId) || '',
          humanize(reservation.status),
        ]),
        tables: tables.map(table => [table.name, table.seats, table.area, humanize(table.status)]),
        invoices: invoiceRows.map(invoice => [
          invoice.number, invoice.customerName || 'Walk-in', localDate(invoice.createdAt),
          orderType(invoice.type), invoice.paymentMethod ? humanize(invoice.paymentMethod) : '—',
          Number(invoice.total), humanize(invoice.status), invoice.orderId, Number(invoice.balance),
        ]),
        payments: paymentRows.map(payment => [
          payment.reference, payment.customerName || 'Walk-in', localDate(payment.createdAt),
          humanize(payment.method), payment.invoiceNumber || '', Number(payment.amount),
          humanize(payment.status), payment.id, payment.invoiceId,
        ]),
        inventory: inventoryRows.map(item => [
          item.name, item.category, item.unit, Number(item.stock), Number(item.minStock),
          Number(item.maxStock), humanize(item.status),
        ]),
      };
      const nextIds = {
        category: categories.map(category => category.id),
        menu: menu.map(item => item.id),
        addons: addons.map(addon => addon.id),
        coupons: coupons.map(coupon => coupon.id),
        customers: customers.map(customer => customer.id),
        reservations: reservations.map(reservation => reservation.id),
        tables: tables.map(table => table.id),
        orders: orderRows.map(order => order.id),
        invoices: invoiceRows.map(invoice => invoice.id),
        payments: paymentRows.map(payment => payment.id),
        inventory: inventoryRows.map(item => item.id),
      };
      setDb(nextDb);
      setIds(nextIds);
      setOrders(orderRows.map(apiOrder));
      setDataLoaded(true);
      setDataError('');
      apiRequest('/dashboard', { token: activeToken })
        .then(result => {
          setDashboard(result);
          setDashboardError('');
        })
        .catch(error => {
          setDashboard(null);
          setDashboardError(error.message);
        });
    } catch (error) {
      setDataLoaded(false);
      setDataError(error.message);
      if (error.status === 401) {
        window.localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      }
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = window.localStorage.getItem(TOKEN_KEY);
    if (!savedToken) {
      setAuthReady(true);
      return;
    }
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
      })
      .finally(() => setAuthReady(true));
  }, [refreshData, toast]);

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
    setDb(emptyDb());
    setIds({});
    setOrders([]);
    setDashboard(null);
    setDashboardError('');
    setDataError('');
    setDataLoaded(false);
    toast('Signed out');
  };

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
        name: values[1], categoryId, price: Number(values[3]),
        type: values[4].toUpperCase().replace('-', '_'), description: values[5],
        active: values[6] === 'Active',
        addonGroupIds: values[7] || [],
      };
    } else if (key === 'addons') {
      path = '/addons';
      body = {
        name: values[0], multiple: values[1] === 'Multi', required: values[2] === 'Required',
        options: String(values[3] || '').split(',').map(value => {
          const option = value.trim();
          const separator = option.lastIndexOf(':');
          const name = separator < 0 ? option : option.slice(0, separator).trim();
          const extraPrice = separator < 0 ? 0 : Number(option.slice(separator + 1).trim());
          return { name, extraPrice };
        }).filter(option => option.name),
        maxSelect: Number(values[4]) || 1, active: values[5] === 'Active',
      };
    } else if (key === 'coupons') {
      path = '/coupons';
      body = {
        code: values[0], description: values[1],
        discountType: values[2] === 'Percentage' ? 'PERCENTAGE' : 'FLAT',
        value: Number(values[3]), minOrder: Number(values[4]), expiresAt: values[5] || null,
        maxUses: values[6] === '' ? null : Number(values[6]), active: values[7] === 'Active',
      };
    } else if (key === 'customers') {
      path = '/customers';
      body = { name: values[0], phone: values[1], email: values[2] };
    } else if (key === 'reservations') {
      const tableIndex = db.tables.findIndex(row => row[0] === values[4]);
      const tableId = tableIndex < 0 ? null : ids.tables?.[tableIndex];
      path = '/reservations';
      body = {
        guestName: values[0], reservedAt: toReservedAt(values[1], values[2]),
        partySize: Number(values[3]), tableId: tableId || null,
      };
    } else if (key === 'inventory') {
      path = '/inventory';
      body = {
        name: values[0], category: values[1], unit: values[2],
        stock: Number(values[3]), minStock: Number(values[4]), maxStock: Number(values[5]),
      };
    } else if (key === 'invoices') {
      const orderId = Number(String(values[0]).match(/^\d+/)?.[0]);
      if (!Number.isInteger(orderId) || orderId < 1) throw new Error('Choose a valid order');
      path = '/invoices';
      body = { orderId };
    } else if (key === 'payments') {
      const invoiceId = Number(String(values[0]).match(/^\d+/)?.[0]);
      if (!Number.isInteger(invoiceId) || invoiceId < 1) throw new Error('Choose a valid invoice');
      path = '/payments';
      body = {
        invoiceId, method: values[1].toUpperCase(), amount: Number(values[2]),
        status: values[3].toUpperCase(),
      };
    } else {
      throw new Error(`No database API is available for ${key}`);
    }

    if (['invoices', 'payments'].includes(key) && id != null) {
      throw new Error(`${key} records cannot be edited`);
    }
    await apiRequest(id == null ? path : `${path}/${id}`, {
      method: id == null ? 'POST' : 'PUT', body, token,
    });
    if (key === 'reservations' && rowIndex != null && db.reservations[rowIndex]?.[5] !== values[5]) {
      await apiRequest(`/reservations/${id}/status`, {
        method: 'PATCH', body: { status: values[5].toUpperCase() }, token,
      });
    }
    await refreshData(token);
  };

  const deleteResource = async (key, rowIndex) => {
    if (!token) throw new Error('Log in to delete database records');
    if (!dataLoaded) throw new Error('Database data is not ready yet');
    const id = ids[key]?.[rowIndex];
    if (id == null) throw new Error('This record is not stored in the database');
    const path = {
      category: '/categories', menu: '/items', addons: '/addons', coupons: '/coupons',
      customers: '/customers', reservations: '/reservations', inventory: '/inventory',
    }[key];
    if (!path) throw new Error(`${key} records cannot be deleted`);
    await apiRequest(`${path}/${id}`, { method: 'DELETE', token });
    await refreshData(token);
  };

  const updateTableStatus = async (rowIndex, status) => {
    if (!token) throw new Error('Log in to update table status');
    const id = ids.tables?.[rowIndex];
    if (id == null) throw new Error('This table is not stored in the database');
    await apiRequest(`/tables/${id}/status`, { method: 'PATCH', body: { status: status.toUpperCase() }, token });
    await refreshData(token);
  };

  const adjustInventory = async (rowIndex, delta) => {
    const id = ids.inventory?.[rowIndex];
    if (!token || id == null) throw new Error('Log in to adjust database inventory');
    await apiRequest(`/inventory/${id}/adjust`, { method: 'PATCH', body: { delta }, token });
    await refreshData(token);
  };

  const updateOrderStatus = async (orderId, status) => {
    if (!token) throw new Error('Log in to update orders');
    const updated = await apiRequest(`/orders/${orderId}/status`, {
      method: 'PATCH', body: { status: status.toUpperCase() }, token,
    });
    setOrders(current => current.map(order => order.id === orderId ? apiOrder(updated) : order));
    return updated;
  };

  const placeOrder = async body => {
    if (!token) throw new Error('Log in to place an order');
    const order = await apiRequest('/orders', { method: 'POST', body, token });
    await refreshData(token);
    return order;
  };

  const cancelInvoice = async rowIndex => {
    const id = ids.invoices?.[rowIndex];
    if (!token || id == null) throw new Error('This invoice is not stored in the database');
    await apiRequest(`/invoices/${id}/cancel`, { method: 'POST', token });
    await refreshData(token);
  };

  const updatePaymentStatus = async (rowIndex, status) => {
    const id = ids.payments?.[rowIndex];
    if (!token || id == null) throw new Error('This payment is not stored in the database');
    await apiRequest(`/payments/${id}/status`, {
      method: 'PATCH', body: { status: status.toUpperCase() }, token,
    });
    await refreshData(token);
  };

  const items = useMemo(() => db.menu.flatMap((row, index) => row[6] === 'Inactive' ? [] : [{
    id: index, thumb: row[0], name: row[1], cat: row[2], price: Number(row[3]),
    type: row[4], desc: row[5], addonGroupIds: row[7] || [],
  }]), [db.menu]);

  return (
    <Ctx.Provider value={{
      db, set: (key, rows) => setDb(current => ({ ...current, [key]: rows })),
      ids, items, orders, setOrders, dashboard, dashboardError, dataError,
      toast, token, user, authReady, loading, dataLoaded,
      authenticate, logout, saveResource, deleteResource, updateTableStatus,
      adjustInventory, updateOrderStatus, placeOrder, cancelInvoice, updatePaymentStatus,
      apiResources: API_RESOURCES,
    }}>
      {children}
      <div id="toast" className={msg ? 's' : ''}>{msg}</div>
    </Ctx.Provider>
  );
}
