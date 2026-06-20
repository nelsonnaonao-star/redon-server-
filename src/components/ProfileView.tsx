import React, { useState, useRef } from 'react';
import { UserProfile, ChatStyle } from '../types';
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
  Wifi
} from 'lucide-react';
import ChatCustomizer from './ChatCustomizer';

interface ProfileViewProps {
  profile: UserProfile;
  onUpdateProfile: (updated: UserProfile) => void;
  onRequestOpenSettingsModal?: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  chatStyle: ChatStyle;
  onUpdateChatStyle: (updated: ChatStyle) => void;
}

export default function ProfileView({ 
  profile, 
  onUpdateProfile, 
  onRequestOpenSettingsModal,
  isDarkMode = false,
  onToggleDarkMode,
  chatStyle,
  onUpdateChatStyle
}: ProfileViewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(profile.name);
  const [editPhone, setEditPhone] = useState(profile.phone);
  const [editBio, setEditBio] = useState(profile.bio);
  const [editUsername, setEditUsername] = useState(profile.username);
  const [showStatusAlert, setShowStatusAlert] = useState<string | null>(null);
  const [activeSetting, setActiveSetting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateProfile({
      name: editName,
      phone: editPhone,
      bio: editBio,
      username: editUsername,
      avatar: profile.avatar
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

  const handleSetPhoto = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onUpdateProfile({ ...profile, avatar: dataUrl });
      triggerAlert("¡Foto de perfil actualizada!");
    };
    reader.readAsDataURL(file);
  };

  const renderSettingSubView = () => {
    const settingTitle: Record<string, string> = {
      cuenta: 'Cuenta',
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
          {activeSetting === 'privacidad' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Confirmación de lectura</span>
                <div className="w-8 h-4 rounded-full bg-[#3390ec] p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm translate-x-4" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Verificación en 2 pasos</span>
                <span className="text-xs text-rose-500 font-medium">Desactivado</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Bloqueados</span>
                <span className="text-xs text-slate-400">0 contactos</span>
              </div>
            </div>
          )}
          {activeSetting === 'notificaciones' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Sonido de mensajes</span>
                <div className="w-8 h-4 rounded-full bg-[#3390ec] p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm translate-x-4" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Vibración</span>
                <div className="w-8 h-4 rounded-full bg-[#3390ec] p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm translate-x-4" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Globo en icono de app</span>
                <div className="w-8 h-4 rounded-full bg-[#3390ec] p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm translate-x-4" />
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Vista previa de mensajes</span>
                <div className="w-8 h-4 rounded-full bg-slate-300 dark:bg-slate-600 p-0.5">
                  <div className="w-3 h-3 rounded-full bg-white shadow-sm" />
                </div>
              </div>
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
                  {['¿Cómo cambio mi número?', '¿Cómo bloqueo a un contacto?', '¿Cómo recupero mi cuenta?', '¿Cómo funciona el cifrado?'].map((q) => (
                    <button key={q} className="w-full text-left text-sm text-[#3390ec] py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 -mx-2 px-2 rounded-lg transition-all cursor-pointer">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
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

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 overflow-y-auto transition-colors duration-300 animate-fade-in">
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
          <img 
            id="user-profile-avatar"
            src={profile.avatar} 
            alt={profile.name} 
            className="w-24 h-24 rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
          />
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
          {/* Quick Option 1 */}
          <button 
            id="quick-set-photo"
            onClick={handleSetPhoto}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/80 active:scale-95 transition-all p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-blue-50/85 dark:bg-blue-950/40 flex items-center justify-center text-[#3390ec] group-hover:scale-110 transition-transform mb-2">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-tight">Foto al azar</span>
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

          {/* Quick Option 3 */}
          <button 
            id="quick-settings"
            onClick={() => triggerAlert("Ajustes generales del sistema activados")}
            className="bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent dark:border-slate-700/80 active:scale-95 transition-all p-3 rounded-2xl flex flex-col items-center justify-center text-center shadow-[0_1px_2px_rgba(0,0,0,0.05)] group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-full bg-indigo-50/85 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 group-hover:rotate-45 transition-transform duration-300 mb-2">
              <Settings2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-medium text-slate-700 dark:text-slate-350 leading-tight">General</span>
          </button>
        </div>
      </div>

      {/* Main Settings List grouped in a massive top-rounded white box */}
      <div className="flex-1 bg-white dark:bg-slate-800 rounded-t-[32px] border-t border-slate-100/50 dark:border-slate-700 shadow-[0_-4px_16px_rgba(0,0,0,0.03)] px-6 pt-8 pb-10 transition-colors duration-300">
        <div className="max-w-md mx-auto">
          <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-450 tracking-wider uppercase mb-4 px-1 animate-pulse">Ajustes de RED ON</h2>
          
          {/* Real-time customizable chat bubble styling component */}
          <ChatCustomizer chatStyle={chatStyle} onChangeStyle={onUpdateChatStyle} />

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
  </>
)}
          </div>

          {/* Footer of Profile page */}
          <div className="pt-8 text-center pb-4 select-none">
            <span className="text-[10px] tracking-widest font-bold text-slate-300 dark:text-slate-600 uppercase block">RED ON v2.0-Native</span>
            <span className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 block">Creado bajo la guía de un Frontend UI Senior</span>
          </div>
        </div>
      </div>
    </div>
  );
}
