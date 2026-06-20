import React, { useState } from 'react';
import { User, Lock, CheckCircle2, Phone, Eye, EyeOff, Settings } from 'lucide-react';
import CountryCodePicker from './CountryCodePicker';
import { api } from '../services/api';

interface AuthViewProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('+58');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoverySent, setRecoverySent] = useState(false);

  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setLoading(true);

    try {
      if (recoveryMode) {
        if (!recoveryUsername) { setErrorText('Por favor ingresa tu usuario.'); setLoading(false); return; }
        await api.forgot(recoveryUsername);
        setRecoverySent(true);
        setLoading(false);
        return;
      }

      if (isLoginMode) {
        if (!loginUser || !password) { setErrorText('Por favor ingresa tus datos.'); setLoading(false); return; }
        const res = await api.login(loginUser, password);
        onLoginSuccess(res.token, res.user);
      } else {
        if (!regName || !regPhone || !regUsername) { setErrorText('Completa todos los campos obligatorios.'); setLoading(false); return; }
        if (password.length < 4) { setErrorText('La contraseña debe tener al menos 4 caracteres.'); setLoading(false); return; }
        const res = await api.register(regName, `${regCode} ${regPhone}`, regUsername, password);
        onLoginSuccess(res.token, res.user);
      }
    } catch (err: any) {
      setErrorText(err.message || 'Error del servidor');
    }
    setLoading(false);
  };

  const handleFillDemo = () => {
    if (isLoginMode) {
      setLoginUser('demo');
      setPassword('1234');
    } else {
      setRegName('Usuario Demo');
      setRegPhone('612 345 678');
      setRegUsername('demo_user');
      setPassword('1234');
    }
  };

  return (
    <div className="flex flex-col min-h-full justify-center bg-[#f0f2f5] dark:bg-slate-900 px-4 py-8 font-sans transition-colors duration-300">
      <div className="w-full max-w-sm mx-auto">
        <div className="text-center mb-6">
          <div className="inline-block w-12 h-12 rounded-2xl bg-[#3390ec] text-white flex items-center justify-center font-black text-xl mb-2.5 shadow-md">R</div>
          <h2 className="text-slate-950 dark:text-white font-bold text-2xl tracking-tight">RED ON Messenger</h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">Conecta con tu red de forma segura</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-[32px] shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-100 dark:border-slate-700 transition-colors duration-300">
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-5 border border-slate-205/10 dark:border-slate-755">
            <button onClick={() => { setIsLoginMode(true); setErrorText(''); setRecoveryMode(false); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              Iniciar Sesión
            </button>
            <button onClick={() => { setIsLoginMode(false); setErrorText(''); setRecoveryMode(false); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${!isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              Crear Cuenta
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorText && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium">{errorText}</div>
            )}

            {recoveryMode ? (
              <>
                {recoverySent ? (
                  <div className="text-center py-4 space-y-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-white font-bold text-base">Instrucciones enviadas</h3>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                        Hemos enviado un enlace de recuperación al usuario <strong className="text-slate-700 dark:text-slate-300">@{recoveryUsername}</strong>.
                      </p>
                    </div>
                    <button type="button" onClick={() => { setRecoveryMode(false); setRecoverySent(false); setRecoveryUsername(''); }}
                      className="text-[#3390ec] hover:underline text-xs font-medium cursor-pointer">Volver al inicio de sesión</button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Usuario de RED ON</label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-400 dark:text-slate-500 text-sm font-semibold">@</span>
                        <input type="text" placeholder="tu_usuario" value={recoveryUsername}
                          onChange={(e) => setRecoveryUsername(e.target.value)}
                          className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-8 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                      </div>
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all shadow-[0_2px_4px_rgba(51,144,236,0.15)] mt-2 cursor-pointer text-center disabled:opacity-50">
                      {loading ? 'Enviando...' : 'Enviar instrucciones'}
                    </button>
                    <div className="text-center">
                      <button type="button" onClick={() => { setRecoveryMode(false); setErrorText(''); }}
                        className="text-[#3390ec] hover:underline text-xs font-medium cursor-pointer">← Volver al inicio de sesión</button>
                    </div>
                  </>
                )}
              </>
            ) : isLoginMode ? (
              <>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Usuario o Teléfono</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input type="text" placeholder="@usuario o +58 412 123 4567" value={loginUser}
                      onChange={(e) => setLoginUser(e.target.value)}
                      className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Contraseña</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-10 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-650">
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                  <div className="mt-2 text-right">
                    <button type="button" onClick={() => { setRecoveryMode(true); setErrorText(''); }}
                      className="text-[#3390ec] hover:underline text-xs font-medium cursor-pointer">¿Olvidaste tu contraseña?</button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Nombre Completo*</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input type="text" placeholder="Ej. Juan Pérez" value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Teléfono Móvil*</label>
                  <div className="flex gap-2">
                    <CountryCodePicker value={regCode} onChange={setRegCode} />
                    <div className="relative flex-1">
                      <Phone className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                      <input type="text" placeholder="689 321 044" value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Usuario de RED ON*</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400 dark:text-slate-500 text-sm font-semibold">@</span>
                    <input type="text" placeholder="juan_dev" value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-8 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                  </div>
                </div>
                <div>
                  <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Contraseña*</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                    <input type={showPassword ? 'text' : 'password'} placeholder="Mínimo 4 caracteres" value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-10 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-650">
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {(!recoveryMode || !recoverySent) && (
              <button type="submit" disabled={loading}
                className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all shadow-[0_2px_4px_rgba(51,144,236,0.15)] mt-2 cursor-pointer text-center disabled:opacity-50">
                {loading ? 'Procesando...' : (recoveryMode ? 'Enviar instrucciones' : (isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta'))}
              </button>
            )}
          </form>

          {!recoveryMode && (
            <div className="mt-4 text-center">
              <button type="button" onClick={handleFillDemo}
                className="text-[#3390ec] hover:underline text-xs font-medium cursor-pointer">
                ⚡ Rellenar demo (usr: demo, pwd: 1234)
              </button>
            </div>
          )}

        </div>
        <div className="mt-5 text-center">
          <p className="text-slate-450 dark:text-slate-500 text-xs">Al registrarte en RED ON se creará una cuenta privada cifrada.</p>
        </div>
      </div>
    </div>
  );
}
