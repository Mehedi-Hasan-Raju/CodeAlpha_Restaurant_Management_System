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

function Workspace({ children }) {
  const p = usePathname().slice(1);
  const router = useRouter();
  const { user, logout, authReady } = useStore();
  const authPage = ['login', 'register', 'forgot'].includes(p);
  useEffect(() => {
    if (!authReady) return;
    if (!user && !authPage) router.replace('/login');
    if (user && authPage) router.replace('/dashboard');
  }, [authReady, authPage, router, user]);
  const theme = () => { const r = document.documentElement; r.dataset.theme = r.dataset.theme == 'dark' ? 'light' : 'dark'; };
  if (!authReady || (!user && !authPage)) {
    return <div id="app"><main><section><p className="sub">{authReady ? 'Redirecting to sign in...' : 'Checking your session...'}</p></section></main></div>;
  }
  return (
    <div id="app">
      <aside>
        <div className="logo"><i>✕</i>RestroPOS</div>
        {NAV.map(([g, ls]) => (
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
