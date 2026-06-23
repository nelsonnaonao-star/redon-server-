import React, { useState, useRef } from 'react';
import { User, Lock, CheckCircle2, Phone, Eye, EyeOff, MessageSquareText, Mail, AtSign } from 'lucide-react';
import CountryCodePicker from './CountryCodePicker';
import { api } from '../services/api';

interface AuthViewProps {
  onLoginSuccess: (token: string, user: any) => void;
}

type RecoveryStep = 'username' | 'phone' | 'code' | 'password' | 'done';

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginUser, setLoginUser] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [regName, setRegName] = useState('');
  const [regCode, setRegCode] = useState('+58');
  const [regPhone, setRegPhone] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');

  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<RecoveryStep>('username');
  const [recoveryUsername, setRecoveryUsername] = useState('');
  const [recoveryPhone, setRecoveryPhone] = useState('');
  const [recoveryCodeDigits, setRecoveryCodeDigits] = useState<string[]>(Array(6).fill(''));
  const [recoveryNewPassword, setRecoveryNewPassword] = useState('');
  const [recoveryShowNewPassword, setRecoveryShowNewPassword] = useState(false);
  const [maskedPhone, setMaskedPhone] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [recoveryEmailSent, setRecoveryEmailSent] = useState('');

  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(false);

  const codeInputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startResendCooldown = () => {
    setResendCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendEmailRecovery = async () => {
    setErrorText('');
    setLoading(true);
    try {
      const data = await api.forgot(recoveryUsername);
      setRecoveryEmailSent(data.maskedEmail);
      setRecoveryStep('done');
    } catch (err: any) {
      if (err.message?.includes('no tiene un correo')) {
        // Fallback to SMS recovery
        setRecoveryStep('phone');
      } else {
        setErrorText(err.message || 'Error al enviar correo');
      }
    }
    setLoading(false);
  };

  const handleSendCode = async () => {
    setErrorText('');
    setLoading(true);
    try {
      const data = await api.sendResetCode(recoveryPhone);
      setMaskedPhone(data.maskedPhone);
      setRecoveryStep('code');
      startResendCooldown();
    } catch (err: any) {
      setErrorText(err.message || 'Error al enviar código');
    }
    setLoading(false);
  };

  const handleVerifyCode = async () => {
    const code = recoveryCodeDigits.join('');
    if (code.length !== 6) { setErrorText('Ingresa el código completo de 6 dígitos'); return; }
    setErrorText('');
    setLoading(true);
    try {
      await api.verifyResetCode(recoveryPhone, code);
      setRecoveryStep('password');
    } catch (err: any) {
      setErrorText(err.message || 'Código inválido');
    }
    setLoading(false);
  };

  const handleUpdatePassword = async () => {
    if (recoveryNewPassword.length < 4) { setErrorText('La contraseña debe tener al menos 4 caracteres'); return; }
    setErrorText('');
    setLoading(true);
    try {
      const code = recoveryCodeDigits.join('');
      await api.updatePassword(recoveryPhone, code, recoveryNewPassword);
      setRecoveryStep('done');
    } catch (err: any) {
      setErrorText(err.message || 'Error al actualizar');
    }
    setLoading(false);
  };

  const handleResendCode = () => {
    if (resendCooldown > 0) return;
    handleSendCode();
  };

  const handleCodeInput = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...recoveryCodeDigits];
    newDigits[index] = value.slice(-1);
    setRecoveryCodeDigits(newDigits);
    if (value && index < 5) {
      codeInputsRef.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !recoveryCodeDigits[index] && index > 0) {
      codeInputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'Enter') {
      handleVerifyCode();
    }
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

  const renderRecovery = () => {
    switch (recoveryStep) {
      case 'username':
        return (
          <>
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#3390ec]/20 flex items-center justify-center mx-auto mb-2">
                <Mail className="w-6 h-6 text-[#3390ec]" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Recuperar contraseña</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">Ingresa tu usuario de RED ON para recibir instrucciones por correo electrónico</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Usuario RED ON</label>
              <div className="relative">
                <AtSign className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                <input type="text" placeholder="juan_dev" value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendEmailRecovery()}
                  className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
              </div>
            </div>
            <button type="button" onClick={handleSendEmailRecovery} disabled={loading || !recoveryUsername.trim()}
              className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
            <div className="text-center mt-3">
              <button type="button" onClick={() => setRecoveryStep('phone')}
                className="text-[11px] text-[#3390ec] hover:underline cursor-pointer">
                ¿No tienes correo? Recuperar por SMS
              </button>
            </div>
          </>
        );

      case 'phone':
        return (
          <>
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#3390ec]/20 flex items-center justify-center mx-auto mb-2">
                <MessageSquareText className="w-6 h-6 text-[#3390ec]" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Recuperar por SMS</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">Te enviaremos un código SMS de 6 dígitos</p>
            </div>
            <div>
              <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Teléfono registrado</label>
              <div className="flex gap-2">
                <CountryCodePicker value="+58" onChange={() => {}} />
                <div className="relative flex-1">
                  <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input type="tel" placeholder="412 123 4567" value={recoveryPhone}
                    onChange={(e) => setRecoveryPhone(e.target.value)}
                    className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                </div>
              </div>
            </div>
            <button type="button" onClick={handleSendCode} disabled={loading || !recoveryPhone.trim()}
              className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer disabled:opacity-50">
              {loading ? 'Enviando...' : 'Enviar código SMS'}
            </button>
            <div className="text-center mt-3">
              <button type="button" onClick={() => setRecoveryStep('username')}
                className="text-[11px] text-[#3390ec] hover:underline cursor-pointer">
                ← Volver a recuperar por correo
              </button>
            </div>
          </>
        );

      case 'code':
        return (
          <>
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
                <MessageSquareText className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Código de verificación</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">
                Enviamos un código de 6 dígitos al {maskedPhone}
              </p>
            </div>
            <div className="flex justify-center gap-2 my-4">
              {recoveryCodeDigits.map((d, i) => (
                <input key={i} ref={el => { codeInputsRef.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={d}
                  onChange={e => handleCodeInput(i, e.target.value)}
                  onKeyDown={e => handleCodeKeyDown(i, e)}
                  className="w-10 h-12 text-center text-lg font-bold bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#3390ec] focus:ring-1 focus:ring-[#3390ec]/30 transition-all"
                />
              ))}
            </div>
            <button type="button" onClick={handleVerifyCode} disabled={loading || recoveryCodeDigits.join('').length !== 6}
              className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer disabled:opacity-50">
              {loading ? 'Verificando...' : 'Verificar código'}
            </button>
            <div className="text-center mt-3">
              <button type="button" onClick={handleResendCode} disabled={resendCooldown > 0 || loading}
                className="text-[11px] text-[#3390ec] hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline">
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </button>
            </div>
          </>
        );

      case 'password':
        return (
          <>
            <div className="text-center mb-3">
              <div className="w-12 h-12 rounded-full bg-[#3390ec]/20 flex items-center justify-center mx-auto mb-2">
                <Lock className="w-6 h-6 text-[#3390ec]" />
              </div>
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Nueva contraseña</h3>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1">Mínimo 4 caracteres</p>
            </div>
            <div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400" />
                <input type={recoveryShowNewPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={recoveryNewPassword}
                  onChange={(e) => setRecoveryNewPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUpdatePassword()}
                  className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm pl-11 pr-10 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" required />
                <button type="button" onClick={() => setRecoveryShowNewPassword(!recoveryShowNewPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer">
                  {recoveryShowNewPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>
            <button type="button" onClick={handleUpdatePassword} disabled={loading || recoveryNewPassword.length < 4}
              className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer disabled:opacity-50">
              {loading ? 'Actualizando...' : 'Cambiar contraseña'}
            </button>
          </>
        );

      case 'done':
        return (
          <div className="text-center py-4 space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white font-bold text-base">
                {recoveryEmailSent ? 'Correo enviado' : 'Contraseña actualizada'}
              </h3>
              {recoveryEmailSent ? (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Enviamos instrucciones a <strong className="text-slate-700 dark:text-slate-300">{recoveryEmailSent}</strong>. Revisa tu bandeja de entrada y sigue el enlace para restablecer tu contraseña.
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-1 leading-relaxed">
                  Tu contraseña se cambió correctamente. Ahora puedes iniciar sesión.
                </p>
              )}
            </div>
            <button type="button" onClick={() => { setRecoveryMode(false); setRecoveryStep('username'); setRecoveryCodeDigits(Array(6).fill('')); setRecoveryNewPassword(''); setRecoveryEmailSent(''); }}
              className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all cursor-pointer">
              Volver al inicio de sesión
            </button>
          </div>
        );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText('');
    setLoading(true);

    try {
      if (isLoginMode) {
        if (!loginUser || !password) { setErrorText('Por favor ingresa tus datos.'); setLoading(false); return; }
        const res = await api.login(loginUser, password);
        onLoginSuccess(res.token, res.user);
      } else {
        if (!regName || !regPhone || !regUsername) { setErrorText('Completa todos los campos obligatorios.'); setLoading(false); return; }
        if (password.length < 4) { setErrorText('La contraseña debe tener al menos 4 caracteres.'); setLoading(false); return; }
        const res = await api.register(regName, `${regCode} ${regPhone}`, regUsername, password, regEmail || undefined);
        onLoginSuccess(res.token, res.user);
      }
    } catch (err: any) {
      setErrorText(err.message || 'Error del servidor');
    }
    setLoading(false);
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
          {recoveryMode && recoveryStep !== 'done' && (
            <button type="button" onClick={() => { setRecoveryMode(false); setRecoveryStep('username'); setErrorText(''); setRecoveryCodeDigits(Array(6).fill('')); }}
              className="text-[#3390ec] hover:underline text-xs font-medium mb-4 inline-flex items-center gap-1 cursor-pointer">← Volver</button>
          )}
          <form onSubmit={recoveryMode ? (e) => e.preventDefault() : handleSubmit} className="space-y-4">
            {errorText && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium">{errorText}</div>
            )}

            {recoveryMode ? (
              renderRecovery()
            ) : (
              <>
                <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-1 border border-slate-205/10 dark:border-slate-755">
                  <button type="button" onClick={() => { setIsLoginMode(true); setErrorText(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    Iniciar Sesión
                  </button>
                  <button type="button" onClick={() => { setIsLoginMode(false); setErrorText(''); }}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${!isLoginMode ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    Crear Cuenta
                  </button>
                </div>

                {isLoginMode ? (
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
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer">
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
                      <label className="text-slate-500 dark:text-slate-450 text-xs font-semibold block mb-1">Correo electrónico (para recuperación)</label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-3.5 w-4.5 h-4.5 text-slate-400 dark:text-slate-500" />
                        <input type="email" placeholder="tucorreo@gmail.com" value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full bg-[#f0f2f5] dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm pl-11 pr-4 py-3 rounded-xl border border-transparent dark:border-slate-700 focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-[#3390ec]/20 transition-all" />
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
                          className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-650 cursor-pointer">
                          {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {!recoveryMode && (
              <button type="submit" disabled={loading}
                className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-2xl py-3.5 font-bold text-sm transition-all shadow-[0_2px_4px_rgba(51,144,236,0.15)] mt-2 cursor-pointer text-center disabled:opacity-50">
                {loading ? 'Procesando...' : (isLoginMode ? 'Iniciar Sesión' : 'Crear Cuenta')}
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
