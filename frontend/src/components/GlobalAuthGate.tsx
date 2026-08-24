import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { setApiReadOnlyMode } from '../api';

const TURNSTILE_SCRIPT_ID = 'cloudflare-turnstile-script';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || '1x00000000000000000000AA';
const PIN_SESSION_KEY = 'salon-settings-pin-unlocked';
const DEV_UNLOCK_KEY = 'is_admin_unlocked';
const DEV_FALLBACK_PIN = '8888';
const LOGIN_FAILURE_KEY = 'salon-login-failure-count';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export type GlobalAccess = {
  method: 'authenticated' | 'pin';
  user?: User;
  readOnly: boolean;
};

type GlobalAuthGateProps = {
  children: (access: GlobalAccess) => ReactNode;
};

function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string>();

  useEffect(() => {
    let cancelled = false;
    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile || widgetRef.current) return;
      widgetRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: 'dark',
        callback: (token: string) => onToken(token),
        'expired-callback': () => onToken(''),
        'error-callback': () => onToken(''),
      });
    };
    const existing = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (window.turnstile) renderWidget();
    else if (existing) existing.addEventListener('load', renderWidget);
    else {
      const script = document.createElement('script');
      script.id = TURNSTILE_SCRIPT_ID;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.addEventListener('load', renderWidget);
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener('load', renderWidget);
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = undefined;
    };
  }, [onToken]);

  return <div className="turnstile-wrap"><div ref={containerRef} /><small>由 Cloudflare Turnstile 保護；驗證 Token 會直接交由 Supabase Auth 檢查。</small></div>;
}

export function GlobalAuthGate({ children }: GlobalAuthGateProps) {
  const [access, setAccess] = useState<GlobalAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info');
  const [failureCount, setFailureCount] = useState(() => Number(localStorage.getItem(LOGIN_FAILURE_KEY) || 0));

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setMessageTone('error');
      setMessage('Supabase 尚未設定，無法啟用全站登入。');
      setLoading(false);
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setMessageTone('error');
        setMessage('登入狀態讀取失敗，請重新登入。');
      } else if (data.session) {
        setAccess({ method: 'authenticated', user: data.session.user, readOnly: false });
      } else if (import.meta.env.DEV && sessionStorage.getItem(PIN_SESSION_KEY) === 'true') {
        setAccess({ method: 'pin', readOnly: true });
      }
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') setAccess(null);
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
        sessionStorage.removeItem(PIN_SESSION_KEY);
        localStorage.removeItem(DEV_UNLOCK_KEY);
        setAccess({ method: 'authenticated', user: session.user, readOnly: false });
      }
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => { setApiReadOnlyMode(access?.readOnly ?? true); }, [access]);

  const resetCaptcha = () => {
    setCaptchaToken('');
    setCaptchaVersion(value => value + 1);
  };

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    if (!captchaToken) {
      setMessageTone('info');
      setMessage('請先完成人機驗證。');
      return;
    }
    setChecking(true);
    setMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: { captchaToken },
    });
    if (error || !data.session) {
      const nextFailures = failureCount + 1;
      localStorage.setItem(LOGIN_FAILURE_KEY, String(nextFailures));
      setFailureCount(nextFailures);
      setMessageTone('error');
      setMessage(nextFailures >= 3
        ? '登入驗證失敗。已加強人機驗證保護；請確認資料後再試，不會鎖定此管理者帳號。'
        : '登入失敗，請確認 Email、密碼與人機驗證。');
      setChecking(false);
      resetCaptcha();
      return;
    }
    localStorage.removeItem(LOGIN_FAILURE_KEY);
    setFailureCount(0);
    setPassword('');
    setAccess({ method: 'authenticated', user: data.session.user, readOnly: false });
    setChecking(false);
  };

  const unlockWithPin = (event: FormEvent) => {
    event.preventDefault();
    if (!import.meta.env.DEV || pin !== DEV_FALLBACK_PIN) {
      setMessageTone('error');
      setMessage('PIN 不正確。緊急 PIN 僅限 localhost 開發環境使用。');
      return;
    }
    sessionStorage.setItem(PIN_SESSION_KEY, 'true');
    localStorage.setItem(DEV_UNLOCK_KEY, 'true');
    setPin('');
    setAccess({ method: 'pin', readOnly: true });
  };

  const lock = async () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    localStorage.removeItem(DEV_UNLOCK_KEY);
    if (access?.method === 'authenticated' && supabase) await supabase.auth.signOut();
    setAccess(null);
  };

  if (loading) return <main className="global-auth-shell"><section className="global-auth-loading"><LoaderCircle className="spin" /><p>正在確認安全登入狀態…</p></section></main>;

  if (access) return <div className={access.readOnly ? 'global-readonly-mode' : ''}>
    <div className={`global-access-bar ${access.readOnly ? 'readonly' : 'authenticated'}`}>
      <span><ShieldCheck size={17} /><strong>{access.readOnly ? '緊急 PIN 唯讀模式' : '已安全登入'}</strong>{access.user?.email && <small>｜{access.user.email}</small>}</span>
      {access.readOnly && <p>僅供 localhost 緊急查看；所有 API 寫入已由前端阻擋，且未取得 Supabase Auth 權限。</p>}
      <button type="button" onClick={() => void lock()}>{access.readOnly ? '返回登入' : '安全登出'}</button>
    </div>
    {children(access)}
  </div>;

  return <main className="global-auth-shell">
    <section className="global-login-card card" aria-labelledby="global-login-title">
      <header>
        <div className="global-login-icon" aria-hidden="true"><LockKeyhole size={30} /></div>
        <div><p>Salon Operations Console</p><h1 id="global-login-title">登入管理系統</h1><span>通過 Supabase Auth 與 Cloudflare Turnstile 驗證後才能載入營運資料。</span></div>
      </header>
      {message && <p className={messageTone === 'error' ? 'settings-error' : 'settings-info'} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</p>}
      <div className="global-login-options">
        <form onSubmit={signIn}>
          <div className="settings-card-heading"><LogIn size={20} /><div><h3>管理者帳號</h3><p>登入失敗不會鎖定 Email 帳號；頻率限制由 Supabase 依 IP 執行。</p></div></div>
          <label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>密碼<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          <Turnstile key={captchaVersion} onToken={setCaptchaToken} />
          {failureCount >= 3 && <p className="captcha-escalation"><ShieldCheck size={16} />此裝置已連續失敗 {failureCount} 次，人機驗證將在每次重試時重新確認。</p>}
          <button className="btn" disabled={checking || !captchaToken}>{checking ? '安全驗證中…' : '登入並驗證'}</button>
        </form>
        {import.meta.env.DEV && <form onSubmit={unlockWithPin}>
          <div className="settings-card-heading"><KeyRound size={20} /><div><h3>緊急 PIN 唯讀入口</h3><p>僅限 localhost 開發；不建立 Auth Session，也不授予資料庫寫入權限。</p></div></div>
          <label>管理員 PIN<input type="password" inputMode="numeric" pattern="[0-9]{4,8}" autoComplete="off" required value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} /></label>
          <button className="settings-secondary-button"><KeyRound size={17} />進入唯讀模式</button>
        </form>}
      </div>
      <footer>Passkey 將於獨立 WebAuthn 階段建置，目前不提供不安全的模擬入口。</footer>
    </section>
  </main>;
}
