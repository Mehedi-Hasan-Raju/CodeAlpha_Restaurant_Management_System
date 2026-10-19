'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
const AUTH = {
  login: ['Welcome back', 'Sign in to MHR Restaurent', [['Email', 'email'], ['Password', 'password']], 'Login'],
  register: ['Create account', 'Set up your staff login', [['Full name'], ['Email', 'email'], ['Password', 'password']], 'Register'],
  forgot: ['Forgot password', 'We will email you a reset link', [['Email', 'email']], 'Send reset link'],
};
export default function AuthPage({ kind }) {
  const [t, s, f, b] = AUTH[kind];
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { authenticate, toast } = useStore();
  const submit = async event => {
    event.preventDefault();
    if (kind === 'forgot') {
      toast('Password reset is not available yet');
      return;
    }
    setBusy(true);
    try {
      const credentials = kind === 'register'
        ? { name: values['Full name'], email: values.Email, password: values.Password }
        : { email: values.Email, password: values.Password };
      await authenticate(kind, credentials);
      router.push('/dashboard');
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="card auth" onSubmit={submit}><div className="logo" style={{ padding: 0 }}><i>✕</i>MHR Restaurent</div>
      <div><b style={{ fontSize: 18 }}>{t}</b><div className="sub" style={{ margin: '2px 0 0' }}>{s}</div></div>
      {f.map(x => <input key={x[0]} required className="in" placeholder={x[0]} type={x[1] || 'text'} aria-label={x[0]}
        value={values[x[0]] || ''} onChange={event => setValues(v => ({ ...v, [x[0]]: event.target.value }))} />)}
      <button className="btn" disabled={busy} style={{ borderRadius: 10, padding: 10 }}>{busy ? 'Please wait...' : b}</button>
      <div className="sub" style={{ textAlign: 'center' }}>
        {kind === 'login' && <>New staff member? <Link href="/register">Create an account</Link><br /><Link href="/forgot">Forgot password?</Link></>}
        {kind === 'register' && <>Already registered? <Link href="/login">Sign in</Link></>}
        {kind === 'forgot' && <Link href="/login">Back to sign in</Link>}
      </div>
    </form>
  );
}
