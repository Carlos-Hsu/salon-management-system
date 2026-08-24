import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LockKeyhole, LogIn, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

export type SettingsAccess = {
  method: 'super_admin' | 'pin';
  canManage: boolean;
  email?: string;
  fullName?: string;
};

type SettingsAccessGateProps = {
  children: (access: SettingsAccess) => ReactNode;
};

type ProfileAccessRow = {
  role: 'staff' | 'super_admin';
  email: string | null;
  full_name?: string | null;
};

const PIN_SESSION_KEY = 'salon-settings-pin-unlocked';
const DEV_UNLOCK_KEY = 'is_admin_unlocked';
const DEV_FALLBACK_PIN = '8888';

function hasLocalPinUnlock(): boolean {
  return import.meta.env.DEV && (
    localStorage.getItem(DEV_UNLOCK_KEY) === 'true' ||
    sessionStorage.getItem(PIN_SESSION_KEY) === 'true'
  );
}

export function SettingsAccessGate({ children }: SettingsAccessGateProps) {
  const [access, setAccess] = useState<SettingsAccess | null>(() =>
    hasLocalPinUnlock() ? { method: 'pin', canManage: false } : null,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'info' | 'error'>('info');
  const [failedPinAttempts, setFailedPinAttempts] = useState(0);
  const [pinLockedUntil, setPinLockedUntil] = useState(0);

  const verifyUser = async () => {
    if (!supabase) { setMessageTone('error'); setMessage('Supabase 尚未設定，無法驗證管理者權限。'); return false; }
    setChecking(true);
    setMessage('');
    setMessageTone('error');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        setMessageTone('info');
        setMessage('目前尚未登入，請輸入 Email 與密碼後點擊「登入並驗證」。');
        return false;
      }
      const user = session.user;
      const enrichedProfile = await supabase
        .from('profiles')
        .select('role,email,full_name')
        .eq('id', user.id)
        .single();
      let profile: ProfileAccessRow | null = enrichedProfile.data;
      if (enrichedProfile.error) {
        if (!enrichedProfile.error.message.includes('full_name')) throw enrichedProfile.error;
        const fallbackProfile = await supabase
          .from('profiles')
          .select('role,email')
          .eq('id', user.id)
          .single();
        if (fallbackProfile.error) throw fallbackProfile.error;
        profile = fallbackProfile.data;
      }
      if (!profile) throw new Error('找不到管理者 Profile。');
      if (profile.role !== 'super_admin') {
        setMessage('此帳號不是超級管理者，無法修改系統設定。');
        return false;
      }
      sessionStorage.removeItem(PIN_SESSION_KEY);
      setAccess({
        method: 'super_admin',
        canManage: true,
        email: profile.email ?? user.email,
        fullName: profile.full_name?.trim() || undefined,
      });
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '管理者權限驗證失敗。');
      return false;
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!hasLocalPinUnlock()) void verifyUser();
    if (!supabase) return;
    const { data: listener } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') setAccess(null);
      if (event === 'SIGNED_IN') setTimeout(() => { void verifyUser(); }, 0);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) { setMessageTone('error'); setMessage('Supabase 尚未設定。'); return; }
    setChecking(true);
    setMessage('');
    setMessageTone('error');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setChecking(false);
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      setChecking(false);
      setMessage('登入未建立有效 Session，請確認帳號已完成 Email 驗證。');
      return;
    }
    // createClient uses persistSession:true, so Supabase safely stores and restores this session.
    setPassword('');
    await verifyUser();
  };

  const verifyPin = async (event: FormEvent) => {
    event.preventDefault();
    if (Date.now() < pinLockedUntil) { setMessage('PIN 嘗試次數過多，請五分鐘後再試。'); return; }
    setChecking(true);
    setMessage('');
    setMessageTone('error');

    if (import.meta.env.DEV && pin === DEV_FALLBACK_PIN) {
      localStorage.setItem(DEV_UNLOCK_KEY, 'true');
      sessionStorage.setItem(PIN_SESSION_KEY, 'true');
      setFailedPinAttempts(0);
      setPin('');
      setAccess({ method: 'pin', canManage: false });
      setChecking(false);
      return;
    }

    const attempts = failedPinAttempts + 1;
    setFailedPinAttempts(attempts);
    if (attempts >= 5) {
      setPinLockedUntil(Date.now() + 5 * 60 * 1000);
      setFailedPinAttempts(0);
      setMessage('PIN 嘗試次數過多，此裝置已暫停五分鐘。');
    } else {
      setMessage(import.meta.env.DEV
        ? `PIN 不正確，尚可嘗試 ${5 - attempts} 次。`
        : '緊急 PIN 僅限 localhost 開發環境使用。');
    }
    setChecking(false);
  };

  const lockSettings = async () => {
    sessionStorage.removeItem(PIN_SESSION_KEY);
    localStorage.removeItem(DEV_UNLOCK_KEY);
    if (access?.method === 'super_admin' && supabase) await supabase.auth.signOut();
    setAccess(null);
    setMessageTone('info');
    setMessage('設定頁面已鎖定。');
  };

  if (access) return <>
    <div className={`settings-access-banner ${access.canManage ? 'admin' : 'pin'}`}>
      <span>
        <ShieldCheck size={18} />
        <strong>{access.canManage ? '超級管理者模式' : 'PIN 檢視模式'}</strong>
        {access.email && <><b className="settings-access-separator" aria-hidden="true">｜</b><small>{access.fullName ? `${access.fullName} (${access.email})` : access.email}</small></>}
      </span>
      {!access.canManage && <p>PIN 僅解鎖設定內容；受 RLS 保護的新增、修改與刪除仍需 super_admin 帳號。</p>}
      <button type="button" onClick={() => void lockSettings()}>重新鎖定</button>
    </div>
    {children(access)}
  </>;

  return <section className="settings-lock-card card" aria-labelledby="settings-lock-title">
    <div className="settings-lock-icon" aria-hidden="true"><LockKeyhole size={30} /></div>
    <div className="settings-lock-heading">
      <p>受保護的系統區域</p>
      <h2 id="settings-lock-title">超級管理者權限驗證</h2>
      <span>請以管理者帳號驗證，或使用備援 PIN 解鎖設定內容。</span>
    </div>

    {message && <p className={messageTone === 'error' ? 'settings-error' : 'settings-info'} role={messageTone === 'error' ? 'alert' : 'status'}>{message}</p>}

    <div className="settings-auth-options">
      <form onSubmit={signIn}>
        <div className="settings-card-heading"><LogIn size={20} /><div><h3>Supabase 管理者帳號</h3><p>登入後會核對 profiles.role 是否為 super_admin。</p></div></div>
        <label>Email<input type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label>密碼<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="btn" disabled={checking}>{checking ? '驗證中…' : '登入並驗證'}</button>
        <button className="settings-secondary-button" type="button" disabled={checking} onClick={() => void verifyUser()}>驗證目前登入帳號</button>
      </form>

      <form onSubmit={verifyPin}>
        <div className="settings-card-heading"><KeyRound size={20} /><div><h3>管理者 PIN 備援</h3><p>PIN 不會授予資料庫寫入權限，僅供本機檢視設定。</p></div></div>
        <label>管理者 PIN<input type="password" inputMode="numeric" pattern="[0-9]{4,8}" autoComplete="off" required value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="請輸入 4–8 位數 PIN" /></label>
        <button className="settings-secondary-button" disabled={checking || Date.now() < pinLockedUntil}><KeyRound size={17} />驗證 PIN</button>
      </form>
    </div>
  </section>;
}
