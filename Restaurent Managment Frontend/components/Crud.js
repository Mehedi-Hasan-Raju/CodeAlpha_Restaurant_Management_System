'use client';
import { useState } from 'react';
import { Head, Table, Modal, Thumb, toDataUrl } from './Ui';
import { MODS } from '@/lib/modules';
import { useStore } from '@/lib/store';

// Generic list page: search + filter chips + add / edit / delete modals.
export default function Crud({ k }) {
  const m = MODS[k], { db, set, toast } = useStore(), rows = db[k];
  const [fl, setFl] = useState('All'), [q, setQ] = useState(''), [md, setMd] = useState(null), [del, setDel] = useState(null), [v, setV] = useState([]);
  const list = rows.map((x, i) => [x, i]).filter(([x]) =>
    (m.ch == null || fl == 'All' || x[m.ch] == fl) &&
    x.filter(c => !String(c).startsWith('data:')).join(' ').toLowerCase().includes(q.toLowerCase()));
  const blank = f => Array.isArray(f[1]) ? f[1][0] : f[1] == 'number' ? 0 : f[1] == 'img' ? '🍽️' : '';
  const open = i => { setV(i == null ? m.f.map(blank) : [...rows[i]]); setMd({ i }); };
  const save = () => {
    const r = m.f.map((f, j) => f[1] == 'number' ? +v[j] || 0 : v[j]);
    set(k, md.i == null ? [...rows, r] : rows.map((x, i) => i == md.i ? r : x));
    setMd(null); toast('Saved');
  };
  const adj = (i, d) => set(k, rows.map((x, j) => j == i ? x.map((c, n) => n == 3 ? Math.max(0, c + d) : c) : x));
  const up = (j, val) => setV(a => a.map((x, n) => n == j ? val : x));
  return (
    <>
      <Head t={m.t} s={`${list.length} ${m.s}`} btn={'Add ' + m.n} onBtn={() => open(null)} />
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
          {m.f.map((f, j) => (
            <label key={j}>{f[0]}
              {f[1] == 'img' ? <><Thumb v={v[j]} /><input type="file" accept="image/*" onChange={async e => e.target.files[0] && up(j, await toDataUrl(e.target.files[0]))} /></>
                : Array.isArray(f[1]) ? <select className="in" value={v[j]} onChange={e => up(j, e.target.value)}>{f[1].map(o => <option key={o}>{o}</option>)}</select>
                : <input className="in" type={f[1] || 'text'} value={v[j]} onChange={e => up(j, e.target.value)} />}
            </label>
          ))}
        </Modal>
      )}
      {del != null && (
        <Modal title={'Delete ' + m.n + '?'} ok="Delete" onClose={() => setDel(null)} onOk={() => { set(k, rows.filter((_, i) => i != del)); setDel(null); toast('Deleted'); }}>
          <p className="sub">This cannot be undone.</p>
        </Modal>
      )}
    </>
  );
}
