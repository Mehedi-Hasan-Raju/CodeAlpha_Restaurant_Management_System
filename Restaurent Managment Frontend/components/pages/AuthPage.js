'use client';
import { useState } from 'react';
const AUTH = {
  login: ['Welcome back', 'Sign in to RestroPOS', [['Email', 'email'], ['Password', 'password']], 'Login'],
  register: ['Create account', 'Set up your staff login', [['Full name'], ['Email', 'email'], ['Password', 'password']], 'Register'],
  forgot: ['Forgot password', 'We will email you a reset link', [['Email', 'email']], 'Send reset link'],
};
export default function AuthPage({ kind }) {
  const [t, s, f, b] = AUTH[kind];
  return (
    <div className="card auth"><div className="logo" style={{ padding: 0 }}><i>✕</i>RestroPOS</div>
      <div><b style={{ fontSize: 18 }}>{t}</b><div className="sub" style={{ margin: '2px 0 0' }}>{s}</div></div>
      {f.map(x => <input key={x[0]} className="in" placeholder={x[0]} type={x[1] || 'text'} aria-label={x[0]} />)}
      <button className="btn" style={{ borderRadius: 10, padding: 10 }}>{b}</button></div>
  );
}
