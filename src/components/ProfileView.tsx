import React, { useState, useRef, useEffect } from 'react';
import FontPicker from './FontPicker';
import RedonIdCard from './RedonIdCard';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import { UserProfile, FaqItem, Chat } from '../types';
import { supabase } from '../lib/supabase';
import { api } from '../services/api';
import CallHistoryView from './CallHistoryView';
import { loadNotifPrefs, toggleNotifPref, NotifPrefs } from '../services/notifPrefs';
import LockScreen from './LockScreen';
import { isPinEnabled, setPinEnabled, setPin, clearPin } from '../services/lockService';
import { 
  Camera, 
  Edit2, 
  Settings2, 
  User, 
  Lock, 
  Bell, 
  HelpCircle, 
  Moon, 
  Database, 
  ChevronRight, 
  LogOut, 
  Check,
  Smartphone,
  ArrowLeft,
  Shield,
  Volume2,
  Wifi,
  Plus,
  Trash2,
  GripVertical,
  Cloud,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  FileText,
  Phone,
  QrCode,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

function getInitials(name: string) {
  return name.split(' ').map(part => part[0]).slice(0, 2).join('').toUpperCase();
}

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onRequestOpenSettingsModal?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  chats?: Chat[];
  userId?: string;
}



export default function ProfileView({ 
  profile, 
  onUpdateProfile, 
  onRequestOpenSettingsModal,
  isDarkMode = false,
  onToggleDarkMode,
  chats = [],
  userId,
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [showStatusAlert, setShowStatusAlert] = useState<string | null>(null);
  const [activeSetting, setActiveSetting] = useState<string | null>(null);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [redonId, setRedonId] = useState('');
  const [showRedonId, setShowRedonId] = useState(false);
  const [showQrCode, setShowQrCode] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [backupInfo, setBackupInfo] = useState<{ exportedAt: string; chatCount: number } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [faqItems, setFaqItems] = useState<FaqItem[]>([]);
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);
  const [showFaqEditor, setShowFaqEditor] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null);
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [expandedDefaultQ, setExpandedDefaultQ] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef(profile.avatar);
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(loadNotifPrefs);

  useEffect(() => {
    avatarRef.current = profile.avatar;
  }, [profile.avatar]);

  const handleSave = () => {
    onUpdateProfile({
      name: editName,
      phone: editPhone,
      bio: editBio,
      username: editUsername,
      avatar: avatarRef.current
    });
    setIsEditing(false);
    triggerAlert("¡Perfil actualizado con éxito!");
  };

  const triggerAlert = (message: string) => {
    setShowStatusAlert(message);
    setTimeout(() => {
      setShowStatusAlert(null);
    }, 3000);
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const ok = await api.createBackup(chats);
      if (ok) {
        const info = await api.getBackupInfo();
        if (info) setBackupInfo(info);
        triggerAlert('Copia de seguridad creada ✅');
      } else {
        triggerAlert('Error al crear copia');
      }
    } catch {
      triggerAlert('Error de conexión');
    }
    setBackingUp(false);
  };

  const handleRestore = async () => {
    if (!confirm('¿Restaurar copia? Los chats locales se reemplazarán con los datos de la nube.')) return;
    setRestoring(true);
    try {
      const restoredChats = await api.restoreBackup();
      if (restoredChats && restoredChats.length > 0) {
        localStorage.setItem('saved_chats', JSON.stringify(restoredChats));
        triggerAlert('Copia restaurada ✅ Recarga la app');
      } else {
        triggerAlert('No hay copia disponible');
      }
    } catch {
      triggerAlert('Error al restaurar');
    }
    setRestoring(false);
  };

  useEffect(() => {
    api.getRedonId().then(setRedonId).catch(() => {});
    api.getBackupInfo().then(setBackupInfo).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeSetting === 'ayuda') {
      api.getFaqItems().then(setFaqItems).catch(() => {});
    }
  }, [activeSetting]);

  const handleSetPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      triggerAlert("Subiendo foto...");
      const url = await api.uploadAvatar(file);
      avatarRef.current = url;
      onUpdateProfile({ ...profile, avatar: url });
      triggerAlert("¡Foto de perfil actualizada!");
    } catch {
      triggerAlert("Error al subir la foto. Intenta de nuevo.");
    }
  };

  const handleSelectFont = (fontId: string) => {
    onUpdateProfile({ ...profile, avatar: avatarRef.current, fontPreference: fontId });
    setShowFontPicker(false);
    triggerAlert('¡Fuente actualizada!');
  };

  const renderSettingSubView = () => {
    const settingTitle: Record<string, string> = {
      cuenta: 'Cuenta',
      llamadas: 'Historial de llamadas',
      privacidad: 'Privacidad y Seguridad',
      notificaciones: 'Notificaciones',
      datos: 'Datos y Almacenamiento',
      ayuda: 'Ayuda y Preguntas'
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 py-1">
          <button
            onClick={() => setActiveSetting(null)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>
          <h3 className="text-slate-900 dark:text-white font-bold text-base">
            {settingTitle[activeSetting!] || 'Ajustes'}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 space-y-4">
          {activeSetting === 'cuenta' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Número de teléfono</span>
                <span className="text-sm text-slate-500">{profile.phone || 'No configurado'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Nombre de usuario</span>
                <span className="text-sm text-[#3390ec]">{profile.username || '@usuario'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Privacidad de número</span>
                <span className="text-xs text-slate-400">Mis contactos</span>
              </div>
            </div>
          )}
          {activeSetting === 'llamadas' && (
            <CallHistoryView userId={userId || ''} onBack={() => setActiveSetting(null)} />
          )}
          {activeSetting === 'privacidad' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Última vez</span>
                <select
                  value={profile.privacyLastSeen || 'everyone'}
                  onChange={async (e) => {
                    const val = e.target.value as 'everyone' | 'contacts' | 'nobody';
                    onUpdateProfile({ ...profile, privacyLastSeen: val });
                    await api.updateProfile({ privacyLastSeen: val });
                  }}
                  className="text-xs font-medium bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 border-0 outline-none cursor-pointer"
                >
                  <option value="everyone">Todos</option>
                  <option value="contacts">Mis contactos</option>
                  <option value="nobody">Nadie</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Estado en línea</span>
                <select
                  value={profile.privacyOnline || 'everyone'}
                  onChange={async (e) => {
                    const val = e.target.value as 'everyone' | 'contacts' | 'nobody';
                    onUpdateProfile({ ...profile, privacyOnline: val });
                    await api.updateProfile({ privacyOnline: val });
                  }}
                  className="text-xs font-medium bg-slate-100 dark:bg-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 border-0 outline-none cursor-pointer"
                >
                  <option value="everyone">Todos</option>
                  <option value="contacts">Mis contactos</option>
                  <option value="nobody">Nadie</option>
                </select>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Confirmación de lectura</span>
                <button
                  onClick={async () => {
                    const next = !(profile.privacyReadReceipts !== false);
                    const updated = { ...profile, privacyReadReceipts: next };
                    onUpdateProfile(updated);
                    await api.updateProfile({ privacyReadReceipts: next });
                  }}
                  className={`w-10 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${(profile.privacyReadReceipts !== false) ? 'bg-[#3390ec]' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${(profile.privacyReadReceipts !== false) ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Verificación en 2 pasos</span>
                  <span className="text-xs text-rose-500 font-medium">Desactivado</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Bloqueados</span>
                  <span className="text-xs text-slate-400">0 contactos</span>
                </div>
                <div className="border-t border-slate-100 dark:border-slate-700 pt-3 mt-3">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">Bloqueo de app</span>
                    <button
                      onClick={() => {
                        if (isPinEnabled()) {
                          clearPin();
                          setPinEnabled(false);
                          triggerAlert('Bloqueo de app desactivado');
                        } else {
                          setShowPinSetup(true);
                        }
                      }}
                      className={`text-xs font-medium px-3 py-1 rounded-lg transition-all cursor-pointer ${
                        isPinEnabled()
                          ? 'bg-[#3390ec] text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300'
                      }`}
                    >
                      {isPinEnabled() ? 'Activado' : 'Desactivado'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeSetting === 'notificaciones' && (
            <div className="space-y-3">
              {([
                { key: 'sound' as const, label: 'Sonido de mensajes' },
                { key: 'vibration' as const, label: 'Vibración' },
                { key: 'badge' as const, label: 'Globo en icono de app' },
                { key: 'preview' as const, label: 'Vista previa de mensajes' },
              ]).map(({ key, label }) => {
                const on = notifPrefs[key];
                return (
                  <div key={key} className="flex items-center justify-between py-2">
                    <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
                    <button
                      onClick={async () => {
                        const updated = toggleNotifPref(key, !on);
                        setNotifPrefs({ ...updated });
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          supabase.from('profiles').update({ notif_config: updated }).eq('id', user.id).then(() => {}).then(() => {}, () => {});
                        }
                      }}
                      className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 cursor-pointer ${
                        on ? 'bg-[#3390ec]' : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        on ? 'translate-x-5' : ''
                      }`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {activeSetting === 'datos' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Auto-descarga de fotos</span>
                <div className="w-8 h-4 rounded-full bg-[#3390ec] p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm translate-x-4" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Usar datos móviles para audio</span>
                <div className="w-8 h-4 rounded-full bg-slate-300 dark:bg-slate-600 p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Almacenamiento usado</span>
                <span className="text-xs text-slate-400">0 MB</span>
              </div>
            </div>
          )}
          {activeSetting === 'ayuda' && (
            <div className="space-y-3">
              <div className="py-2">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Preguntas frecuentes</h4>
                <div className="space-y-2">
                  {[
                    { q: '¿Cómo cambio mi número?', a: 'Ve a Perfil → Editar (icono lápiz). Cambia tu número en el campo "Teléfono" y presiona "Guardar". Recibirás un código de verificación SMS.' },
                    { q: '¿Cómo bloqueo a un contacto?', a: 'Abre el chat del contacto, toca los tres puntos (⋮) en la esquina superior, selecciona "Bloquear". También puedes ir a Ajustes → Privacidad y Seguridad → Bloqueados.' },
                    { q: '¿Cómo recupero mi cuenta?', a: 'En la pantalla de inicio de sesión, toca "¿Olvidaste tu contraseña?". Ingresa tu correo electrónico registrado y sigue las instrucciones. Si no tienes correo, usa la opción de recuperación por SMS.' },
                    { q: '¿Cómo funciona el cifrado?', a: 'RED ON usa cifrado de extremo a extremo (E2EE). Solo tú y el destinatario pueden leer los mensajes — ni siquiera nosotros podemos verlos. Cada mensaje se cifra con una clave única en tu dispositivo.' },
                  ].map((item) => (
                    <div key={item.q} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                      <button
                        onClick={() => setExpandedDefaultQ(expandedDefaultQ === item.q ? null : item.q)}
                        className="w-full flex items-center justify-between text-left text-sm text-[#3390ec] py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                      >
                        <span className="font-medium flex-1 pr-2">{item.q}</span>
                        {expandedDefaultQ === item.q ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                      {expandedDefaultQ === item.q && (
                        <div className="px-3 pb-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-2 mt-0">
                          {item.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* Custom FAQ from Supabase */}
              {(faqItems.length > 0 || true) && (
                <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Mis preguntas personalizadas</h4>
                    <button
                      onClick={() => { setEditingFaq(null); setFaqQuestion(''); setFaqAnswer(''); setShowFaqEditor(true); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-[#3390ec]" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    {faqItems.length === 0 && (
                      <p className="text-xs text-slate-400 text-center py-3">Añade tus propias preguntas con respuesta.</p>
                    )}
                    {faqItems.map((faq) => (
                      <div key={faq.id} className="border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setExpandedFaqId(expandedFaqId === faq.id ? null : faq.id)}
                          className="w-full flex items-center justify-between text-left text-sm text-slate-700 dark:text-slate-300 py-2.5 px-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all cursor-pointer"
                        >
                          <span className="font-medium flex-1 pr-2">{faq.question}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingFaq(faq); setFaqQuestion(faq.question); setFaqAnswer(faq.answer); setShowFaqEditor(true); }}
                              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-all cursor-pointer"
                              title="Editar"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                            </button>
                            <button
                              onClick={async (e) => { e.stopPropagation(); try { await api.deleteFaqItem(faq.id); setFaqItems(prev => prev.filter(f => f.id !== faq.id)); } catch {} }}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all cursor-pointer"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            </button>
                            {expandedFaqId === faq.id ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                          </span>
                        </button>
                        {expandedFaqId === faq.id && faq.answer && (
                          <div className="px-3 pb-2.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-700 pt-2 mt-0">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <button className="w-full py-3 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-2xl font-semibold text-sm transition-all cursor-pointer">
                  Soporte en vivo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (showFontPicker) {
    return (
      <FontPicker
        currentFont={profile.fontPreference || 'clasico'}
        onSelectFont={handleSelectFont}
        onClose={() => setShowFontPicker(false)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 overflow-y-auto transition-colors duration-300 animate-fade-in">
      {showRedonId && redonId && (
        <RedonIdCard redonId={redonId} userId={userId} phone={profile.phone} onClose={() => setShowRedonId(false)} />
      )}
      {showQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowQrCode(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 mx-4 max-w-xs w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Mi código QR</h3>
              <button onClick={() => setShowQrCode(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors cursor-pointer">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-3 pb-2">
              <img src={profile.avatar} alt={profile.name} className="w-14 h-14 rounded-full object-cover border-2 border-white shadow" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{profile.name}</p>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <QRCodeSVG value={`redon://user/${userId || ''}`} size={180} level="M" />
              </div>
              <p className="text-[10px] text-slate-400 text-center leading-tight">Escanea este código para agregarme como contacto en RED ON</p>
            </div>
          </div>
        </div>
      )}
      {/* Toast Alert */}
      {showStatusAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md anim-fade-in">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{showStatusAlert}</span>
        </div>
      )}

      {/* Profile Header */}
      <div className="flex flex-col items-center justify-center pt-8 pb-6 px-4">
        {/* Avatar Container with Hover State */}
        <div className="relative group">
          {profile.avatar ? (
            <img 
              id="user-profile-avatar"
              src={profile.avatar} 
              alt={profile.name} 
              loading="lazy"
              decoding="async"
              className="w-24 h-24 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#3390ec] flex items-center justify-center text-white text-2xl font-bold">
              {getInitials(profile.name)}
            </div>
          )}
          <button 
            id="btn-change-avatar"
            onClick={handleSetPhoto}
            className="absolute bottom-0 right-0 p-2 bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-95 text-white rounded-full shadow-md transition-all cursor-pointer"
            title="Cambiar Foto de Perfil"
          >
            <Camera className="w-4.5 h-4.5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoFile}
            className="hidden"
          />
        </div>

        {/* User identification */}
        <div className="mt-4 text-center w-full max-w-sm px-4">
          {isEditing ? (
            <div className="space-y-2 bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.05)] text-left border border-slate-105 dark:border-slate-700">
              <div>
                <label className="text-slate-400 dark:text-slate-500 text-xs font-medium block mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full text-slate-800 dark:text-white font-semibold px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#3390ec]"
                />
              </div>
              <div>
                <label className="text-slate-400 dark:text-slate-500 text-xs font-medium block mb-1">Nombre de usuario</label>
                <input 
                  type="text" 
                  value={editUsername} 
                  onChange={(e) => setEditUsername(e.target.value)}
                  className="w-full text-slate-500 dark:text-slate-400 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#3390ec]"
                />
              </div>
              <div>
                <label className="text-slate-400 dark:text-slate-500 text-xs font-medium block mb-1">Teléfono</label>
                <input 
                  type="text" 
                  value={editPhone} 
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full text-slate-500 dark:text-slate-400 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:border-[#3390ec]"
                />
              </div>
              <div>
                <label className="text-slate-400 dark:text-slate-500 text-xs font-medium block mb-1">Biografía</label>
                <textarea 
                  value={editBio} 
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={2}
                  className="w-full text-slate-600 dark:text-slate-300 text-sm px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-[#3390ec] resize-none"
                />
              </div>
              <div className="flex gap-2 pt-1 font-sans">
                <button 
                  onClick={handleSave}
                  className="flex-1 py-1.5 bg-[#3390ec] text-white hover:bg-[#2b7bc9] active:scale-95 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Guardar
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(profile.name);
                    setEditPhone(profile.phone);
                    setEditBio(profile.bio);
                    setEditUsername(profile.username);
                  }}
                  className="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 id="user-profile-name" className="text-slate-900 dark:text-white font-semibold text-xl tracking-tight leading-6">
                {profile.name}
              </h1>
              <div id="user-profile-phone" className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 font-medium flex items-center justify-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-slate-450 dark:text-slate-550" />
                <span>{profile.phone}</span>
              </div>
              <div className="text-[#3390ec] text-xs font-semibold mt-1">
                {profile.username}
              </div>
              {profile.bio && (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-3 bg-white/75 dark:bg-slate-800/80 max-w-xs mx-auto py-2 px-4 rounded-xl border border-slate-100/50 dark:border-slate-700/60 shadow-[0_1px_1.5px_rgba(0,0,0,0.015)] italic leading-relaxed">
                  {profile.bio}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Quick Access Buttons Grid */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
          {/* Quick Option 1: RED ON ID */}
          <button 
            id="quick-redon-id"
            onClick={() => setShowRedonId(true)}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/80 active:scale-95 transition-all p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50/85 dark:bg-blue-950/40 flex items-center justify-center text-[#3390ec] group-hover:scale-110 transition-transform mb-2">
              <span className="text-sm font-black tracking-tight">#</span>
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-tight">RED ON ID</span>
          </button>

          {/* Quick Option 2 */}
          <button 
            id="quick-edit-info"
            onClick={() => setIsEditing(!isEditing)}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/80 active:scale-95 transition-all p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] group cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform mb-2 group-hover:scale-110 ${isEditing ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-600' : 'bg-amber-50 dark:bg-amber-950/45 text-amber-600'}`}>
              <Edit2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-tight">{isEditing ? 'Cancelando' : 'Editar info'}</span>
          </button>

          {/* Quick Option 3: Mi QR */}
          <button 
            id="quick-qr-code"
            onClick={() => setShowQrCode(true)}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/80 active:scale-95 transition-all p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50/85 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform mb-2">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-tight">Mi QR</span>
          </button>
        </div>
      </div>

      {/* Main Settings List grouped in a massive top-rounded white box */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-t-[32px] border-t border-slate-100/50 dark:border-slate-700 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] px-6 pt-8 pb-10 transition-colors duration-300">
        <div className="max-w-md mx-auto">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-450 tracking-wider uppercase mb-4 px-1 animate-pulse">Ajustes de RED ON</h2>
          
          <div className="space-y-0.5 divide-y divide-slate-100/70 dark:divide-slate-700/60">
{activeSetting ? renderSettingSubView() : (
  <>
            {/* Setting 1: Cuenta */}
            <div 
              onClick={() => setActiveSetting('cuenta')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-[#3390ec] text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(51,144,236,0.15)]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-[#3390ec] transition-colors">Cuenta</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Privacidad de número, cambio de ID</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">Cambiar</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Setting 2: Privacidad */}
            <div 
              onClick={() => setActiveSetting('privacidad')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-emerald-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(16,185,129,0.15)]">
                  <Lock className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-emerald-500 transition-colors">Privacidad y Seguridad</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Doble check, bloqueos, verificación en 2 pasos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors" />
            </div>

            {/* Setting NEW: Historial de llamadas */}
            <div 
              onClick={() => setActiveSetting('llamadas')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-green-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(34,197,94,0.15)]">
                  <Phone className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-green-500 transition-colors">Historial de llamadas</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Llamadas perdidas, recibidas y realizadas</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors" />
            </div>

            {/* Setting 3: Notificaciones */}
            <div 
              onClick={() => setActiveSetting('notificaciones')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-rose-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(244,63,94,0.15)]">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-rose-500 transition-colors">Notificaciones</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Silenciar chats, globos en icono de app</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors" />
            </div>

            {/* Setting 4: Datos y Almacenamiento */}
            <div 
              onClick={() => setActiveSetting('datos')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-amber-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(245,158,11,0.15)]">
                  <Database className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-amber-500 transition-colors">Datos y Almacenamiento</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Uso de red móvil, autodescarga de fotos</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors" />
            </div>

            {/* Setting NEW: Tema Modo Oscuro */}
            <div 
              onClick={onToggleDarkMode}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-indigo-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(99,102,241,0.15)]">
                  <Moon className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-indigo-500 transition-colors">Modo Oscuro</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Alterna el tema visual de la aplicación</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-semibold">{isDarkMode ? "Activado" : "Desactivado"}</span>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-250 cursor-pointer ${isDarkMode ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-250 ${isDarkMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
            </div>

            {/* Setting: Fuentes de la aplicación */}
            <div 
              onClick={() => setShowFontPicker(true)}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-[#e94e77] text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(233,78,119,0.15)]">
                  <span className="text-lg font-bold leading-none">A</span>
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-[#e94e77] transition-colors">Fuentes</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Personaliza el estilo de letra de la app</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors">
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal capitalize">{profile.fontPreference || 'Clásico'}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>

            {/* Setting 5: Soporte / FAQ */}
            <div 
              onClick={() => setActiveSetting('ayuda')}
              className="py-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 bg-purple-500 text-white rounded-full aspect-square flex items-center justify-center shadow-[0_2px_4px_rgba(168,85,247,0.15)]">
                  <HelpCircle className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-slate-900 dark:text-slate-200 font-semibold text-sm leading-tight group-hover:text-purple-500 transition-colors">Ayuda y Preguntas</h3>
                  <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">RED ON FAQ, soporte en directo</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-550 group-hover:text-slate-400 transition-colors" />
            </div>

            {/* Cloud Backup / Restore */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 mb-2 px-1">Copia de seguridad</p>
              <button onClick={handleBackup} disabled={backingUp} className="w-full py-3 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all text-left disabled:opacity-50">
                <div className="w-9 bg-emerald-500 text-white rounded-full aspect-square flex items-center justify-center">
                  <Cloud className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{backingUp ? 'Guardando...' : 'Guardar copia en la nube'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{backupInfo ? `Última copia: ${new Date(backupInfo.exportedAt).toLocaleDateString()} • ${backupInfo.chatCount} chats` : 'Nunca se hizo una copia'}</p>
                </div>
                <Cloud className="w-4 h-4 text-slate-300 dark:text-slate-500" />
              </button>
              <button onClick={handleRestore} disabled={restoring} className="w-full py-3 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all text-left disabled:opacity-50">
                <div className="w-9 bg-amber-500 text-white rounded-full aspect-square flex items-center justify-center">
                  <Download className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{restoring ? 'Restaurando...' : 'Restaurar desde copia'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Reemplaza chats locales con la nube</p>
                </div>
              </button>
            </div>

            {/* Legal: Privacidad + Términos */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/50 mt-2">
              <p className="text-[10px] uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500 mb-2 px-1">Legal</p>
              <button onClick={() => setShowPrivacy(true)} className="w-full py-3 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all text-left">
                <div className="w-9 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full aspect-square flex items-center justify-center">
                  <Shield className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Política de Privacidad</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Cómo manejamos tus datos</p>
                </div>
              </button>
              <button onClick={() => setShowTerms(true)} className="w-full py-3 flex items-center gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-700/50 -mx-3 px-3 rounded-xl transition-all text-left">
                <div className="w-9 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full aspect-square flex items-center justify-center">
                  <FileText className="w-4.5 h-4.5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Términos de Servicio</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Condiciones de uso de RED ON</p>
                </div>
              </button>
            </div>
  </>
)}
          </div>

{/* Footer of Profile page */}
           <div className="pt-8 text-center pb-4 select-none">
             <span className="text-[10px] tracking-widest font-bold text-slate-300 dark:text-slate-600 uppercase block">RED ON v2.0-Native</span>
             <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 block">Creado bajo la guía de un Frontend UI Senior</span>
           </div>

          {/* Logout Button */}
          <div className="px-4 mt-8 mb-6">
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.reload();
              }}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-3 px-4 rounded-xl border border-red-200 flex justify-center items-center gap-2 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      </div>
      {/* FAQ Editor Modal */}
      {showFaqEditor && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={() => setShowFaqEditor(false)}>
          <div
            className="bg-white dark:bg-slate-800 w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 pb-8 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-slate-900 dark:text-white font-bold text-base">{editingFaq ? 'Editar pregunta' : 'Nueva pregunta'}</h3>
              <button onClick={() => setShowFaqEditor(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 font-medium block mb-1">Pregunta</label>
                <input
                  type="text"
                  value={faqQuestion}
                  onChange={(e) => setFaqQuestion(e.target.value)}
                  placeholder="Ej: ¿Cómo cambio mi número?"
                  className="w-full text-sm text-slate-800 dark:text-white px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#3390ec]"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 dark:text-slate-500 font-medium block mb-1">Respuesta</label>
                <textarea
                  value={faqAnswer}
                  onChange={(e) => setFaqAnswer(e.target.value)}
                  placeholder="Escribe la respuesta aquí..."
                  rows={4}
                  className="w-full text-sm text-slate-800 dark:text-white px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#3390ec] resize-none"
                />
              </div>
              <button
                onClick={async () => {
                  if (!faqQuestion.trim()) return;
                  try {
                    if (editingFaq) {
                      await api.updateFaqItem(editingFaq.id, faqQuestion.trim(), faqAnswer.trim());
                      setFaqItems(prev => prev.map(f => f.id === editingFaq.id ? { ...f, question: faqQuestion.trim(), answer: faqAnswer.trim() } : f));
                    } else {
                      const newItem = await api.addFaqItem(faqQuestion.trim(), faqAnswer.trim());
                      setFaqItems(prev => [...prev, newItem]);
                    }
                    setShowFaqEditor(false);
                    setEditingFaq(null);
                    setFaqQuestion('');
                    setFaqAnswer('');
                  } catch {}
                }}
                className="w-full py-2.5 bg-[#3390ec] hover:bg-[#2b7bc9] text-white rounded-xl font-semibold text-sm transition-all cursor-pointer"
              >
                {editingFaq ? 'Guardar cambios' : 'Añadir pregunta'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)} />}
      {showTerms && <TermsOfService onClose={() => setShowTerms(false)} />}
      {showPinSetup && (
        <LockScreen
          mode="setup"
          onCancel={() => setShowPinSetup(false)}
          onPinSet={(pin) => {
            setPin(pin);
            setPinEnabled(true);
            setShowPinSetup(false);
            triggerAlert('Bloqueo de app activado');
          }}
          onUnlock={() => {}}
        />
      )}
    </div>
  );
}
