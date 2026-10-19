'use client';
import { useState } from 'react';
import { Head, Table, Modal, Thumb, toDataUrl } from './Ui';
import { MODS } from '@/lib/modules';
import { useStore } from '@/lib/store';

// Generic list page: search + filter chips + add / edit / delete modals.
export default function Crud({ k }) {
  const m = MODS[k], { db, set, toast, token, saveResource, deleteResource, apiResources, loading, dataLoaded } = useStore();
  const apiBacked = apiResources.has(k);
  const rows = apiBacked && token && !dataLoaded ? [] : db[k];
  const fields = m.f.map((f, i) => {
    if (k === 'menu' && i === 2) return [f[0], db.category.map(category => category[1])];
    if (k === 'reservations' && i === 4) return [f[0], db.tables.map(table => table[0])];
    return f;
  });
  const [fl, setFl] = useState('All'), [q, setQ] = useState(''), [md, setMd] = useState(null), [del, setDel] = useState(null), [v, setV] = useState([]);
  const list = rows.map((x, i) => [x, i]).filter(([x]) =>
    (m.ch == null || fl == 'All' || x[m.ch] == fl) &&
    x.filter(c => !String(c).startsWith('data:')).join(' ').toLowerCase().includes(q.toLowerCase()));
  const blank = f => Array.isArray(f[1]) ? f[1][0] : f[1] == 'number' ? 0 : f[1] == 'img' ? '🍽️' : '';
  const open = i => { setV(i == null ? fields.map(blank) : [...rows[i]]); setMd({ i }); };
  const save = async () => {
    const r = fields.map((f, j) => f[1] == 'number' ? +v[j] || 0 : v[j]);
    try {
      if (apiResources.has(k)) {
        await saveResource(k, r, md.i);
      } else {
        set(k, md.i == null ? [...rows, r] : rows.map((x, i) => i == md.i ? r : x));
      }
      setMd(null); toast('Saved');
    } catch (error) {
      toast(error.message);
    }
  };
  const adj = (i, d) => set(k, rows.map((x, j) => j == i ? x.map((c, n) => n == 3 ? Math.max(0, c + d) : c) : x));
  const up = (j, val) => setV(a => a.map((x, n) => n == j ? val : x));
  const remove = async () => {
    try {
      if (apiResources.has(k)) {
        await deleteResource(k, del);
      } else {
        set(k, rows.filter((_, i) => i != del));
      }
      setDel(null); toast('Deleted');
    } catch (error) {
      toast(error.message);
    }
  };
  return (
    <>
      <Head t={m.t} s={`${list.length} ${m.s}`} btn={'Add ' + m.n} onBtn={() => open(null)} />
      {apiBacked && !token && <p className="sub">Demo data. Log in to view and change database records.</p>}
      {apiBacked && token && !dataLoaded && <p className="sub">{loading ? 'Loading database records...' : 'Database records could not be loaded. Please check the backend and try again.'}</p>}
      {!apiBacked && <p className="sub">Demo data only. This section does not have a backend API yet.</p>}
      {m.top && m.top(rows)}
      <div className="bar">
        {m.ch != null && ['All', ...m.o].map(o => <button key={o} className={'chip ' + (fl == o ? 'on' : '')} onClick={() => setFl(o)}>{o}</button>)}
        <span className="sp" /><input className="in" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <Table h={[...m.h, '']} rows={list.map(([x, i]) => [...m.r(x, i, { adj }),
        <span key="a" style={{ whiteSpace: 'nowrap' }}>
          <button className="ib" onClick={() => open(i)}>👁️</button><button className="ib" onClick={() => open(i)}>✏️</button><button className="ib" onClick={() => setDel(i)}>🗑️</button>
        </span>])} />
      {md && (
        <Modal title={(md.i == null ? 'Add ' : 'Edit ') + m.n} onClose={() => setMd(null)} onOk={save}>
          {fields.map((f, j) => (
            <label key={j}>{f[0]}
              {f[1] == 'img' ? <><Thumb v={v[j]} /><input type="file" accept="image/*" onChange={async e => e.target.files[0] && up(j, await toDataUrl(e.target.files[0]))} /></>
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
