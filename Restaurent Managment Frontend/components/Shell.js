'use client';
import { Fragment } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Store, useStore } from '@/lib/store';

const NAV = [
  ['Restaurant', [['dashboard', '🏠', 'Dashboard'], ['pos', '🛒', 'POS'], ['floor', '🪑', 'Floor plan'], ['kitchen', '🍳', 'Kitchen display'], ['orders', '🧾', 'Orders'], ['reservations', '📅', 'Reservations']]],
  ['Menu management', [['category', '🗂️', 'Category'], ['menu', '🍽️', 'Items'], ['addons', '➕', 'Addons'], ['coupons', '🏷️', 'Coupons'], ['inventory', '📦', 'Inventory']]],
  ['Operations', [['customers', '👥', 'Customers'], ['invoices', '📄', 'Invoices'], ['payments', '💳', 'Payments']]],
];
const ROLE_HOME = { ADMIN: '/dashboard', CASHIER: '/pos', KITCHEN: '/kitchen' };
const ROLE_ROUTES = {
  ADMIN: new Set(['dashboard', 'pos', 'floor', 'kitchen', 'orders', 'reservations', 'category', 'menu', 'addons', 'coupons', 'inventory', 'customers', 'invoices', 'payments']),
  CASHIER: new Set(['pos']),
  KITCHEN: new Set(['kitchen']),
};

function Workspace({ children }) {
  const p = usePathname().slice(1);
  const router = useRouter();
  const { user, logout, authReady } = useStore();
  const authPage = ['login', 'register', 'forgot'].includes(p);
  const home = ROLE_HOME[user?.role] || '/login';
  const allowedRoutes = ROLE_ROUTES[user?.role] || new Set();
  const forbidden = user && !authPage && !allowedRoutes.has(p);
  useEffect(() => {
    if (!authReady) return;
    if (!user && !authPage) router.replace('/login');
    if (user && (authPage || forbidden)) router.replace(home);
  }, [authReady, authPage, forbidden, home, router, user]);
  const theme = () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme == 'dark' ? 'light' : 'dark'; };
  if (!authReady || (!user && !authPage) || forbidden) {
    return <div id="app"><main><section><p className="sub">{authReady ? 'Redirecting to sign in...' : 'Checking your session...'}</p></section></main></div>;
  }
  const nav = user?.role === 'ADMIN'
    ? NAV
    : user?.role === 'CASHIER'
      ? [['Restaurant', [['pos', '🛒', 'POS']]]]
      : user?.role === 'KITCHEN'
        ? [['Restaurant', [['kitchen', '🍳', 'Kitchen display']]]]
        : [];
  return (
    <div id="app">
      <aside>
        <div className="logo"><i>✕</i>MHR Restaurent</div>
        {nav.map(([g, ls]) => (
          <Fragment key={g}><h6>{g}</h6>
            {ls.map(([k, e, n]) => <Link key={k} href={'/' + k} className={k == p ? 'on' : ''}>{e} {n}</Link>)}
          </Fragment>
        ))}
      </aside>
      <main>
        <header><input placeholder="Type to search..." aria-label="Search" /><span className="sp" />
          <button className="ib" onClick={theme}>🌓</button><button className="ib">🔔</button>
          {user ? <><span className="sub">{user.name}</span><button className="ib" title={`Sign out ${user.name}`} onClick={() => { logout(); router.push('/login'); }}>↪</button></> : <Link className="av" href="/login">A</Link>}</header>
        <section>{children}</section>
      </main>
    </div>
  );
}

export default function Shell({ children }) {
  return <Store><Workspace>{children}</Workspace></Store>;
}
