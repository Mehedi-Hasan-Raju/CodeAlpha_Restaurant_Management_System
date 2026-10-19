'use client';
import { useState } from 'react';
import { Head, Table, Modal, Thumb, toDataUrl } from './Ui';
import { MODS } from '@/lib/modules';
import { useStore } from '@/lib/store';

// Generic list page: search + filter chips + add / edit / delete modals.
export default function Crud({ k }) {
  const m = MODS[k], {
    db, ids, orders, toast, token, saveResource, deleteResource, adjustInventory,
    cancelInvoice, updatePaymentStatus, apiResources, loading, dataLoaded, dataError, user,
  } = useStore();
  const apiBacked = apiResources.has(k);
  const rows = dataLoaded ? db[k] : [];
  const fields = m.f.map((f, i) => {
    if (k === 'menu' && i === 2) return [f[0], db.category.map(category => category[1])];
    if (k === 'reservations' && i === 4) return [f[0], db.tables.map(table => table[0])];
    return f;
  });
  if (k === 'menu') {
    fields[7] = ['Addon groups', 'multi', db.addons.filter(addon => addon[5] === 'Active')
      .map(addon => [addon[6], addon[0]])];
  }
  if (k === 'invoices') {
    const billedOrders = new Set(db.invoices.map(invoice => invoice[7]));
    fields[0] = ['Order', orders.filter(order => !billedOrders.has(order.id))
      .map(order => `${order.id} — ${order.type} — $${order.total.toFixed(2)}`)];
  }
  if (k === 'payments') {
    fields[0] = ['Invoice', db.invoices.filter(invoice => invoice[8] > 0)
      .map(invoice => `${ids.invoices?.[db.invoices.indexOf(invoice)]} — ${invoice[0]} — balance $${invoice[8].toFixed(2)}`)];
  }
  const [fl, setFl] = useState('All'), [q, setQ] = useState(''), [md, setMd] = useState(null), [del, setDel] = useState(null), [v, setV] = useState([]);
  const list = rows.map((x, i) => [x, i]).filter(([x]) =>
    (m.ch == null || fl == 'All' || x[m.ch] == fl) &&
    x.filter(c => !String(c).startsWith('data:')).join(' ').toLowerCase().includes(q.toLowerCase()));
  const blank = f => f[1] === 'multi' ? [] : Array.isArray(f[1]) ? f[1][0] || '' : f[1] == 'number' ? 0 : f[1] == 'img' ? '🍽️' : '';
  const open = i => { setV(i == null ? fields.map(blank) : [...rows[i]]); setMd({ i }); };
  const save = async () => {
    const r = fields.map((f, j) => f[1] === 'multi' ? v[j] || [] : f[1] == 'number' ? +v[j] || 0 : v[j]);
    try {
      await saveResource(k, r, md.i);
      setMd(null); toast('Saved');
    } catch (error) {
      toast(error.message);
    }
  };
  const adj = async (i, d) => {
    try {
      await adjustInventory(i, d);
    } catch (error) {
      toast(error.message);
    }
  };
  const up = (j, val) => setV(a => a.map((x, n) => n == j ? val : x));
  const remove = async () => {
    try {
      await deleteResource(k, del);
      setDel(null); toast('Deleted');
    } catch (error) {
      toast(error.message);
    }
  };
  const cancel = async index => {
    try {
      await cancelInvoice(index);
      toast('Invoice cancelled');
    } catch (error) {
      toast(error.message);
    }
  };
  const setPaymentStatus = async (index, status) => {
    try {
      await updatePaymentStatus(index, status);
      toast(`Payment ${status.toLowerCase()}`);
    } catch (error) {
      toast(error.message);
    }
  };
  return (
    <>
      <Head t={m.t} s={`${list.length} ${m.s}`} btn={'Add ' + m.n} onBtn={() => open(null)} />
      {!token && <p className="sub">Sign in to load database records.</p>}
      {token && !dataLoaded && <p className="sub">{loading || !dataError ? 'Loading database records...' : dataError}</p>}
      {apiBacked && dataLoaded && !rows.length && <p className="sub">No database records yet.</p>}
      {m.top && m.top(rows)}
      <div className="bar">
        {m.ch != null && ['All', ...(m.o || (k === 'menu' ? db.category.map(category => category[1]) : []))].map(o => <button key={o} className={'chip ' + (fl == o ? 'on' : '')} onClick={() => setFl(o)}>{o}</button>)}
        <span className="sp" /><input className="in" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Table h={[...m.h, '']} rows={list.map(([x, i]) => [...m.r(x, i, { adj }),
        <span key="a" style={{ whiteSpace: 'nowrap' }}>
            {k === 'invoices' ? x[6] === 'Pending' && <button className="ib" title="Cancel invoice" onClick={() => cancel(i)}>Cancel</button>
              : k === 'payments' ? <>
                {x[6] === 'Pending' && <><button className="ib" title="Mark completed" onClick={() => setPaymentStatus(i, 'Completed')}>✓</button><button className="ib" title="Mark failed" onClick={() => setPaymentStatus(i, 'Failed')}>×</button></>}
                {x[6] === 'Completed' && user?.role === 'ADMIN' && <button className="ib" title="Refund payment" onClick={() => setPaymentStatus(i, 'Refunded')}>Refund</button>}
              </>
                : <><button className="ib" onClick={() => open(i)}>✏️</button><button className="ib" onClick={() => setDel(i)}>🗑️</button></>}
        </span>])} />
      {md && (
        <Modal title={(md.i == null ? 'Add ' : 'Edit ') + m.n} onClose={() => setMd(null)}
          onOk={['invoices', 'payments'].includes(k) && !fields[0][1].length ? undefined : save}>
            {['invoices', 'payments'].includes(k) && !fields[0][1].length && <p className="sub">{k === 'invoices' ? 'There are no uninvoiced orders.' : 'There are no invoices with an outstanding balance.'}</p>}
            {fields.map((f, j) => (
              <label key={j}>{f[0]}
                {f[1] == 'img' ? <><Thumb v={v[j]} /><input type="file" accept="image/*" onChange={async e => e.target.files[0] && up(j, await toDataUrl(e.target.files[0]))} /></>
                  : f[1] === 'multi' ? <div>{f[2].map(([id, name]) => <div key={id} className="o">
                    <input type="checkbox" checked={v[j]?.includes(id) || false}
                      onChange={() => up(j, v[j]?.includes(id) ? v[j].filter(value => value !== id) : [...(v[j] || []), id])} />
                    {name}
                  </div>)}</div>
                    : Array.isArray(f[1]) ? <select className="in" value={v[j]} onChange={e => up(j, e.target.value)}>{f[1].map(o => <option key={o}>{o}</option>)}</select>
                  : <input className="in" type={f[1] || 'text'} value={v[j]} onChange={e => up(j, e.target.value)} />}
            </label>
            ))}
        </Modal>
      )}
      {del != null && (
        <Modal title={'Delete ' + m.n + '?'} ok="Delete" onClose={() => setDel(null)} onOk={remove}>
          <p className="sub">This cannot be undone.</p>
        </Modal>
      )}
    </>
  );
}
