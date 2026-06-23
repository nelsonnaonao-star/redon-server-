import React, { useState, useEffect } from 'react';
import { BusinessListing } from '../types';
import { 
  TrendingUp, 
  ChevronRight, 
  MessageSquareDiff, 
  BarChart4, 
  Layers, 
  Plus, 
  Eye, 
  Link, 
  Check, 
  Sparkles,
  Info,
  X,
  Camera,
  MessageCircle,
  Store,
  MapPin,
  Users
} from 'lucide-react';

interface EmprendedorViewProps {
  onStartBusinessChat?: (biz: BusinessListing) => void;
}

export default function EmprendedorView({ onStartBusinessChat }: EmprendedorViewProps) {
  const [activeTab, setActiveTab] = useState<'tools' | 'negocios'>('tools');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // User's zone — saved in localStorage, set in profile / registration
  const [userZone, setUserZone] = useState(() => localStorage.getItem('userZone') || 'Guarenas');
  const [editingZone, setEditingZone] = useState(false);
  const [pendingZone, setPendingZone] = useState(userZone);

  useEffect(() => {
    localStorage.setItem('userZone', userZone);
  }, [userZone]);

  // Business Directory state
  const [zoneFilter, setZoneFilter] = useState<'Tu Zona' | 'Todas'>('Tu Zona');
  const zoneTabs = ['Tu Zona', 'Todas'];
  const [businesses, setBusinesses] = useState<BusinessListing[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessListing | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isAddingBusiness, setIsAddingBusiness] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizImage, setBizImage] = useState('');
  const [bizZone, setBizZone] = useState(userZone);
  const [bizCategory, setBizCategory] = useState('');
  const [bizContact, setBizContact] = useState('');

  // Real-time metrics (0 until real data arrives)
  const [profileVisits, setProfileVisits] = useState(0);
  const [linkClicks, setLinkClicks] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { supabase } = await import('../lib/supabase');
        const { count: visits, error: visitsErr } = await supabase
          .from('profile_visits')
          .select('*', { count: 'exact', head: true });
        if (!visitsErr && visits !== null) setProfileVisits(visits);
        const { count: clicks, error: clicksErr } = await supabase
          .from('link_clicks')
          .select('*', { count: 'exact', head: true });
        if (!clicksErr && clicks !== null) setLinkClicks(clicks);
      } catch {
        // tables may not exist yet — stays 0
      }
    };
    fetchStats();
  }, []);

  // Promo Modal state
  const [showPromoModal, setShowPromoModal] = useState(false);

  // Drag & Drop / Custom Promotions States
  const [isDragging, setIsDragging] = useState(false);
  const [businessName, setBusinessName] = useState('Snack Real Burguer');
  const [promoDesc, setPromoDesc] = useState('¡Promo Activa del Día! Pide hoy mismo tu Combo Real: Doble carne Premium, queso fundido Cheddar crujiente, patatas fritas aromatizadas y bebida helada de 350ml por solo $8.50. Botón directo de contacto abajo ⬇️');
  const [promoImgUrl, setPromoImgUrl] = useState('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80');

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2800);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPromoImgUrl(url);
        triggerToast('¡Flyer personalizado cargado de forma local!');
      } else {
        triggerToast('Por favor, ingresa una archivo de imagen válido.');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPromoImgUrl(url);
        triggerToast('¡Flyer cargado con éxito!');
      } else {
        triggerToast('Por favor, selecciona una imagen.');
      }
    }
  };

  const [promoCategory, setPromoCategory] = useState('Comida');

  const handlePublishPromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim() || !promoDesc.trim()) return;
    const newBiz: BusinessListing = {
      id: String(Date.now()),
      businessName,
      description: promoDesc,
      imageUrl: promoImgUrl || 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600&auto=format&fit=crop&q=80',
      zone: userZone,
      category: promoCategory,
      contactName: '',
      contactPhone: '',
    };
    setBusinesses(prev => [newBiz, ...prev]);
    setShowPromoModal(false);
    setPromoImgUrl('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80');
    setBusinessName('Snack Real Burguer');
    setPromoDesc('');
    setPromoCategory('Comida');
    triggerToast(`🚀 ¡${newBiz.businessName} publicado en Negocios!`);
  };

  const handleAddBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bizName.trim() || !bizDesc.trim() || !bizContact.trim()) return;
    const newBiz: BusinessListing = {
      id: String(Date.now()),
      businessName: bizName,
      description: bizDesc,
      imageUrl: bizImage || 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=600&auto=format&fit=crop&q=80',
      zone: bizZone,
      category: bizCategory || 'General',
      contactName: bizContact,
      contactPhone: '',
    };
    setBusinesses(prev => [newBiz, ...prev]);
    setIsAddingBusiness(false);
    setBizName(''); setBizDesc(''); setBizImage(''); setBizZone(userZone); setBizCategory(''); setBizContact('');
    triggerToast(`¡Negocio "${newBiz.businessName}" publicado en ${newBiz.zone}!`);
  };

  const openBusinessChat = (biz: BusinessListing) => {
    setSelectedBusiness(null);
    if (onStartBusinessChat) {
      onStartBusinessChat(biz);
    } else {
      triggerToast(`💬 Abriendo chat con ${biz.businessName}...`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 overflow-y-auto pb-4 relative font-sans transition-colors duration-300">
      
      {/* Dynamic Toast feedback */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 dark:bg-slate-850/95 text-white text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md border border-transparent dark:border-slate-700">
          <Check className="w-3.5 h-3.5 text-[#3390ec]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* --- QUICK METRICS GRID (Cuadrícula superior de 2 columnas) --- */}
      <div className="px-4 pt-4 mb-4">
        <div className="grid grid-cols-2 gap-3 max-w-md mx-auto select-none">
          
          {/* Metric 1: Vistas */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-750/70 border border-transparent dark:border-slate-700/60 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-450 dark:text-slate-400 font-bold uppercase tracking-wider block">Visitas Perfil</span>
              <div className="w-6 h-6 bg-blue-50 dark:bg-blue-950/40 text-[#3390ec] rounded-full flex items-center justify-center">
                <Eye className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 justify-between">
              <span className="text-slate-900 dark:text-white text-xl font-bold font-display">{profileVisits.toLocaleString()}</span>
              <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                +0%
              </span>
            </div>
          </div>

          {/* Metric 2: Clics en Enlace */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-slate-750/70 border border-transparent dark:border-slate-700/60 transition-colors duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-455 dark:text-slate-400 font-bold uppercase tracking-wider block">Clics Enlace</span>
              <div className="w-6 h-6 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center">
                <Link className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-1.5 justify-between">
              <span className="text-slate-900 dark:text-white text-xl font-bold font-display">{linkClicks.toLocaleString()}</span>
              <span className="text-emerald-500 text-[10px] font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                +0%
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* --- SUB PANEL SELECTOR (Herramientas vs Productos vs Promociones) --- */}
      <div className="px-4 mb-4">
        <div className="bg-white dark:bg-slate-800 max-w-md mx-auto flex p-1 rounded-xl shadow-xs border border-slate-150 dark:border-slate-705 gap-1 select-none transition-colors duration-300">
          <button 
            onClick={() => setActiveTab('tools')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
              activeTab === 'tools' 
                ? 'bg-[#3390ec] text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            Herramientas
          </button>
          
          <button 
            onClick={() => setActiveTab('negocios')}
            className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer text-center ${
              activeTab === 'negocios' 
                ? 'bg-[#3390ec] text-white shadow-xs' 
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/60'
            }`}
          >
            Negocios ({businesses.length})
          </button>
        </div>
      </div>

      {/* --- BUSINESS TOOLS CONTAINER - Block cover rounded: bg-white rounded-t-[32px] --- */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-t-[32px] px-6 pt-6 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] border-t border-transparent dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-md mx-auto">
          
          {activeTab === 'tools' && (
            /* Tab 1: Configuration list (identical to settings style but focused on tools) */
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3 px-1 select-none">
                <Sparkles className="w-4.5 h-4.5 text-[#3390ec]" />
                <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-505 tracking-wider uppercase flex items-center gap-1">Herramientas Pro de Negocio</h2>
              </div>

              <div className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
                {/* Promotional Flyer publisher panel */}
                <div 
                  onClick={() => setShowPromoModal(true)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 bg-pink-500 text-white rounded-full aspect-square flex items-center justify-center shadow-md animate-pulse">
                      <Camera className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-tight group-hover:text-pink-500">Publicar Promoción</h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Sube flyers comerciales y chatea al instante</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>

                {/* Auto messages setup */}
                <div 
                  onClick={() => triggerToast("Mensajes automáticos: Configuración de bienvenida guardada")}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 bg-emerald-500 text-white rounded-full aspect-square flex items-center justify-center shadow-md">
                      <MessageSquareDiff className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-tight group-hover:text-emerald-500">Mensajes Automáticos</h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Saludos e inicio rápido para nuevos chats</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>

                {/* Advanced statistics */}
                <div 
                  onClick={() => triggerToast("Estadísticas avanzadas: Reportes semanales generados")}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 bg-rose-500 text-white rounded-full aspect-square flex items-center justify-center shadow-md">
                      <BarChart4 className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-tight group-hover:text-rose-500">Estadísticas Avanzadas</h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Origen de tráfico, conversiones y clicks</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>

                {/* Integration codes */}
                <div 
                  onClick={() => triggerToast("Integraciones: Token de API copiado al portapapeles")}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-9 bg-purple-500 text-white rounded-full aspect-square flex items-center justify-center shadow-md">
                      <Layers className="w-4.5 h-4.5" />
                    </div>
                    <div>
                      <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-tight group-hover:text-purple-500">Integración Web</h3>
                      <p className="text-slate-400 dark:text-slate-500 text-xs mt-0.5">Añade RED ON chat a tu sitio web externo</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                </div>
              </div>

              {/* Informational Hint banner box */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-105 dark:border-slate-700/80 rounded-2xl flex items-start gap-2.5 mt-2 select-none">
                <Info className="w-4.5 h-4.5 text-[#3390ec] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-550 dark:text-slate-400 leading-relaxed font-semibold">
                  Modo Emprendedor te permite integrar pasarelas de pago, listados de precios y respuestas rápidas para tus clientes sin salir de tu canal tradicional.
                </p>
              </div>

            </div>
          )}

          {activeTab === 'negocios' && (
            /* Tab 4: Business Directory */
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 select-none">
                  <Store className="w-4.5 h-4.5 text-[#3390ec]" />
                  <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-505 tracking-wider uppercase flex items-center gap-1">Directorio de Negocios</h2>
                </div>
                <button 
                  onClick={() => setIsAddingBusiness(true)}
                  className="px-2.5 py-1.5 bg-[#3390ec] text-white hover:bg-[#2b7bc9] font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Publicar</span>
                </button>
              </div>

              {/* Zone filter: Tu Zona vs Todas */}
              <div className="flex gap-1.5">
                <button
                  onClick={() => setZoneFilter('Tu Zona')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    zoneFilter === 'Tu Zona'
                      ? 'bg-[#3390ec]/10 text-[#3390ec] border-[#3390ec]/30'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  📍 Tu Zona ({userZone})
                </button>
                <button
                  onClick={() => setZoneFilter('Todas')}
                  className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg border transition-all cursor-pointer ${
                    zoneFilter === 'Todas'
                      ? 'bg-[#3390ec]/10 text-[#3390ec] border-[#3390ec]/30'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-550 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80'
                  }`}
                >
                  📍 Todas
                </button>
                {/* Edit zone button */}
                <button
                  onClick={() => { setEditingZone(true); setPendingZone(userZone); }}
                  className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  title="Cambiar mi zona"
                >
                  ✎
                </button>
              </div>

              {/* Zone editor popup */}
              {editingZone && (
                <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Mi zona</span>
                    <button onClick={() => setEditingZone(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    value={pendingZone}
                    onChange={(e) => setPendingZone(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#3390ec] text-slate-800 dark:text-white"
                  >
                    <option value="Guarenas">Guarenas</option>
                    <option value="Guatire">Guatire</option>
                    <option value="Caracas">Caracas</option>
                    <option value="Otra">Otra</option>
                  </select>
                  <button
                    onClick={() => { setUserZone(pendingZone); setEditingZone(false); triggerToast(`Zona cambiada a ${pendingZone}`); }}
                    className="w-full py-2 text-xs font-bold text-white bg-[#3390ec] hover:bg-[#2b7bc9] rounded-xl transition-all cursor-pointer"
                  >
                    Guardar zona
                  </button>
                </div>
              )}

              {/* Business cards grid */}
              <div className="grid grid-cols-1 gap-3.5 max-h-[360px] overflow-y-auto pr-1 pb-4">
                {businesses.filter(b => zoneFilter === 'Todas' || b.zone === userZone).length === 0 ? (
                  <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                    <Store className="w-10 h-10 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-semibold">No hay negocios en esta zona</p>
                    <p className="text-[10px] mt-1">Sé el primero en publicar tu negocio</p>
                  </div>
                ) : (
                  businesses
                    .filter(b => zoneFilter === 'Todas' || b.zone === userZone)
                    .map((biz) => (
                      <div
                        key={biz.id}
                        onClick={() => setSelectedBusiness(biz)}
                        className="p-3 bg-[#f8fafc] dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60 rounded-2xl flex gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/60 cursor-pointer transition-all"
                      >
                        <img 
                          src={biz.imageUrl} 
                          alt={biz.businessName} 
                          className="w-16 h-16 rounded-xl object-cover border border-slate-100 dark:border-slate-700/60 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={(e) => { e.stopPropagation(); setPreviewImage(biz.imageUrl); }}
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div className="leading-tight">
                            <h4 className="text-slate-900 dark:text-slate-100 font-bold text-xs truncate">{biz.businessName}</h4>
                            <p className="text-slate-450 dark:text-slate-400 text-[10px] line-clamp-2 leading-normal mt-0.5">{biz.description}</p>
                          </div>
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />{biz.zone}
                            </span>
                            <span className="text-[10px] bg-[#3390ec]/10 text-[#3390ec] px-2 py-0.5 rounded-full font-bold">{biz.category}</span>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>

              <p className="text-[10px] text-slate-450 dark:text-slate-500 leading-normal text-center mt-2 max-w-xs mx-auto">
                💡 Publica tu negocio gratis y conéctate con clientes de tu zona.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* --- BUSINESS DETAIL MODAL (full screen) --- */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-55 flex flex-col bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-t-[28px] mt-12 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm truncate">{selectedBusiness.businessName}</h3>
              <button 
                onClick={() => setSelectedBusiness(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                <img 
                  src={selectedBusiness.imageUrl} 
                  alt={selectedBusiness.businessName} 
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreviewImage(selectedBusiness.imageUrl)}
                />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-lg text-white font-black text-[9px] uppercase tracking-wider">
                  {selectedBusiness.zone}
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedBusiness.businessName}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-[#3390ec]/10 text-[#3390ec] px-2 py-0.5 rounded-full font-bold">{selectedBusiness.category}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />{selectedBusiness.zone}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedBusiness.description}</p>
                </div>

                {selectedBusiness.contactName && (
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Users className="w-4 h-4" />
                    <span>Contacto: <strong className="text-slate-700 dark:text-slate-200">{selectedBusiness.contactName}</strong></span>
                    {selectedBusiness.contactPhone && <span className="text-slate-400">• {selectedBusiness.contactPhone}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Chat button fixed at bottom */}
            <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
              <button
                onClick={() => openBusinessChat(selectedBusiness)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold rounded-xl py-3 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-[0_4px_12px_rgba(16,185,129,0.22)]"
              >
                <MessageCircle className="w-5 h-5 flex-shrink-0 text-white fill-current opacity-90" />
                <span className="text-sm font-semibold">Chatear con {selectedBusiness.businessName}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PROMO MODAL (full screen) --- */}
      {showPromoModal && (
        <div className="fixed inset-0 z-55 flex flex-col bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 rounded-t-[28px] mt-12 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Publicar Promoción</h3>
              <button 
                onClick={() => setShowPromoModal(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <form onSubmit={handlePublishPromo} className="space-y-5">
                {/* Drag & Drop area */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('flyer-upload-modal')?.click()}
                  className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all cursor-pointer flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden group ${
                    isDragging 
                      ? 'border-[#3390ec] bg-[#3390ec]/5' 
                      : 'border-slate-250 dark:border-slate-700 hover:border-[#3390ec] hover:bg-slate-50 dark:hover:bg-slate-900/40'
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    id="flyer-upload-modal" 
                    onChange={handleFileChange} 
                  />
                  {promoImgUrl ? (
                    <div className="absolute inset-0 w-full h-full select-none">
                      <img src={promoImgUrl} alt="Flyer Preview" className="w-full h-full object-cover opacity-30 group-hover:scale-103 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-white/50 dark:bg-slate-900/80 flex flex-col items-center justify-center p-2">
                        <Check className="w-6 h-6 text-emerald-500 mb-1" />
                        <span className="text-xs font-bold text-slate-800 dark:text-white">¡Imagen cargada!</span>
                        <span className="text-[9px] text-slate-500 dark:text-slate-400">Pulsa o arrastra para cambiar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <div className="p-2.5 bg-slate-100 dark:bg-slate-900 rounded-full text-slate-500 dark:text-slate-400 group-hover:text-[#3390ec] transition-colors">
                        <Camera className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Sube tu flyer aquí</span>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 px-2">Arrastra o haz clic para explorar</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">Nombre del Negocio</label>
                  <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="Ej. Hamburguesas El Chamo"
                    className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 focus:outline-none focus:ring-1 focus:ring-[#3390ec] focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner" required />
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">Descripción del Negocio</label>
                  <textarea value={promoDesc} onChange={(e) => setPromoDesc(e.target.value)}
                    placeholder="Describe tu negocio..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-xl p-3 h-24 text-xs font-medium text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 focus:outline-none focus:ring-1 focus:ring-[#3390ec] focus:bg-white dark:focus:bg-slate-900 transition-all resize-none shadow-inner"
                    maxLength={250} required />
                  <div className="flex justify-between items-center text-[9px] text-slate-405 dark:text-slate-500 mt-0.5 select-none">
                    <span>Límite</span>
                    <span>{promoDesc.length}/250</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-450 dark:text-slate-500 font-bold uppercase tracking-wider block mb-1">Categoría</label>
                  <select value={promoCategory} onChange={(e) => setPromoCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border-0 rounded-xl p-3 text-xs font-semibold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#3390ec] focus:bg-white dark:focus:bg-slate-900 transition-all shadow-inner">
                    <option value="Comida">🍔 Comida</option>
                    <option value="Ropa">👗 Ropa</option>
                    <option value="Tecnología">💻 Tecnología</option>
                    <option value="Delivery">🚚 Delivery</option>
                    <option value="Salud">💊 Salud</option>
                    <option value="Hogar">🏠 Hogar</option>
                    <option value="Servicios">🔧 Servicios</option>
                    <option value="Otro">📌 Otro</option>
                  </select>
                </div>

                <button type="submit"
                  className="w-full bg-[#3390ec] hover:bg-[#2b7bc9] active:scale-98 text-white rounded-xl py-3 font-semibold text-xs transition-all shadow-[0_2px_4px_rgba(51,144,236,0.12)] cursor-pointer">
                  Publicar en Negocios
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD BUSINESS MODAL --- */}
      {isAddingBusiness && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl font-sans transition-colors duration-300">
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900 border-b border-slate-100 dark:border-slate-750 flex items-center justify-between">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Publicar Negocio</h3>
              <button 
                onClick={() => setIsAddingBusiness(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBusiness} className="p-5 space-y-4">
              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">Nombre del Negocio*</label>
                <input 
                  type="text" 
                  placeholder="Ej. Panadería La Especial"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec]"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">Descripción*</label>
                <textarea 
                  placeholder="Describe tu negocio, productos o servicios..."
                  value={bizDesc}
                  onChange={(e) => setBizDesc(e.target.value)}
                  rows={2}
                  className="w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 text-sm p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec] resize-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">URL de Imagen (opcional)</label>
                <input 
                  type="url" 
                  placeholder="https://ejemplo.com/imagen.jpg"
                  value={bizImage}
                  onChange={(e) => setBizImage(e.target.value)}
                  className="w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">Zona*</label>
                <select
                  value={bizZone}
                  onChange={(e) => setBizZone(e.target.value)}
                  className="w-full text-slate-800 dark:text-white text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec]"
                >
                  <option value="Guarenas">Guarenas</option>
                  <option value="Guatire">Guatire</option>
                  <option value="Caracas">Caracas</option>
                  <option value="Otra">Otra</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">Categoría</label>
                <input 
                  type="text" 
                  placeholder="Ej. Comida, Ropa, Tecnología..."
                  value={bizCategory}
                  onChange={(e) => setBizCategory(e.target.value)}
                  className="w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec]"
                />
              </div>

              <div>
                <label className="text-xs text-slate-550 dark:text-slate-400 font-semibold block mb-1">Nombre de Contacto*</label>
                <input 
                  type="text" 
                  placeholder="Tu nombre o el del negocio"
                  value={bizContact}
                  onChange={(e) => setBizContact(e.target.value)}
                  className="w-full text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-550 text-sm px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-705 rounded-xl focus:outline-none focus:border-[#3390ec]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddingBusiness(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-650 dark:text-slate-350 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#3390ec] hover:bg-[#2b7bc9] rounded-xl transition-all cursor-pointer"
                >
                  Publicar Negocio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- FULL-SCREEN IMAGE PREVIEW --- */}
      {previewImage && (
        <div 
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center animate-fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <button 
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all cursor-pointer z-10"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={previewImage} 
            alt="Vista previa" 
            className="max-w-full max-h-full object-contain p-4"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
}
