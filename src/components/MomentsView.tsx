import React, { useState, useRef, useEffect } from 'react';
import { Moment, UserProfile } from '../types';
import { Plus, Camera, X, Eye, Heart, Sparkles, Check, Info, Smile, Trash2 } from 'lucide-react';
import { MediaEditor } from './MediaEditor';
import { api } from '../services/api';

interface MomentsViewProps {
  profile: UserProfile;
  moments: Moment[];
  onAddMoment: (newMoment: Moment) => void;
}

export default function MomentsView({ profile, moments, onAddMoment }: MomentsViewProps) {
  const [localMoments, setLocalMoments] = useState<Moment[]>(moments);
  const [activeMoment, setActiveMoment] = useState<Moment | null>(null);
  const [isAddingMoment, setIsAddingMoment] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [showToast, setShowToast] = useState(false);

  // Advanced edit flow integration
  const [isEditing, setIsEditing] = useState(false);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [selectedFileForEdit, setSelectedFileForEdit] = useState<File | null>(null);

  // Reactions state
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [reactionSummary, setReactionSummary] = useState<{ emoji: string; count: number }[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Viewer auto-play state
  const [viewerPaused, setViewerPaused] = useState(false);
  const [viewerProgress, setViewerProgress] = useState(0);
  const viewerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);

  const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-advance logic
  useEffect(() => {
    if (!activeMoment) return;
    const isVideo = activeMoment.image.startsWith('data:video/');
    const idx = localMoments.findIndex(m => m.id === activeMoment.id);
    const goNext = () => {
      if (idx < localMoments.length - 1) {
        setActiveMoment(localMoments[idx + 1]);
        setViewerPaused(false);
        setViewerProgress(0);
      } else {
        setActiveMoment(null);
      }
    };
    const clearTimer = () => {
      if (viewerTimerRef.current) clearInterval(viewerTimerRef.current);
      viewerTimerRef.current = null;
    };

    setViewerProgress(0);
    setViewerPaused(false);

    if (isVideo) {
      // Video: let onEnded handle it
      return () => clearTimer();
    }

    // Image: timer-based
    const MOMENT_DURATION = 5;
    const start = Date.now();
    viewerTimerRef.current = setInterval(() => {
      setViewerProgress(prev => {
        const elapsed = (Date.now() - start) / 1000;
        const pct = Math.min((elapsed / MOMENT_DURATION) * 100, 100);
        if (pct >= 100) {
          clearTimer();
          goNext();
        }
        return pct;
      });
    }, 50);

    return () => clearTimer();
  }, [activeMoment?.id]);

  // Video progress tracking
  useEffect(() => {
    if (!activeMoment || !activeMoment.image.startsWith('data:video/')) return;
    const v = viewerVideoRef.current;
    if (!v) return;
    const update = () => {
      if (!viewerPaused && v.duration) {
        setViewerProgress((v.currentTime / v.duration) * 100);
      }
    };
    v.addEventListener('timeupdate', update);
    return () => v.removeEventListener('timeupdate', update);
  }, [activeMoment?.id, viewerPaused]);

  const handleFileSelected = (file: File) => {
    setPickedFile(file);
    const isVid = file.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'image');
    
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedMedia(reader.result as string);
      setIsEditing(true); // Switch to exclusive editing view
    };
    reader.readAsDataURL(file);
  };

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleViewMoment = async (moment: Moment) => {
    setActiveMoment(moment);
    setShowReactionPicker(false);
    setLocalMoments(prev => 
      prev.map(m => m.id === moment.id ? { ...m, hasUnseen: false } : m)
    );
    try {
      await api.viewMoment(moment.id);
      const reactions = await api.getMomentReactions(moment.id);
      setMyReaction(reactions.myReaction);
      setReactionSummary(reactions.summary);
    } catch {}
  };

  const handleReact = async (emoji: string) => {
    if (!activeMoment) return;
    try {
      const result = await api.reactToMoment(activeMoment.id, emoji);
      if (result.action === 'removed') {
        setMyReaction(null);
      } else {
        setMyReaction(emoji);
      }
      const reactions = await api.getMomentReactions(activeMoment.id);
      setReactionSummary(reactions.summary);
    } catch {}
  };

  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleFinishedEdit = (editedFile: File, caption: string) => {
    setPickedFile(editedFile);
    const isVid = editedFile.type.startsWith('video/');
    setMediaType(isVid ? 'video' : 'image');

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedMedia(reader.result as string);
      if (caption) {
        const displayCaption = caption.startsWith('[PRO-Edited] ') 
          ? caption.replace('[PRO-Edited] ', '') 
          : caption;
        setCaptionText(displayCaption);
      }
      setIsEditing(false);
      setIsAddingMoment(true);
    };
    reader.readAsDataURL(editedFile);
    setSelectedFileForEdit(null);
  };

  const handlePostMoment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!captionText.trim()) return;

    // Use uploaded base64 data, or pick a random cool Unsplash photo
    let momentImage = '';
    if (uploadedMedia) {
      momentImage = uploadedMedia;
    } else {
      const randomPixNum = Math.floor(Math.random() * 200) + 100;
      momentImage = `https://picsum.photos/id/${randomPixNum}/600/805`;
    }

    const newM: Moment = {
      id: String(Date.now()),
      name: `${profile.name} (Tú)`,
      avatar: profile.avatar,
      time: "Hace un momento",
      hasUnseen: false,
      image: momentImage,
      caption: captionText.trim()
    };

    onAddMoment(newM);
    // Add locally to view immediate rendering
    setLocalMoments(prev => [newM, ...prev]);
    setIsAddingMoment(false);
    setCaptionText('');
    setUploadedMedia(null);
    setMediaType(null);
    
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2500);
  };

  if (isEditing && uploadedMedia) {
    return (
      <div className="fixed inset-0 z-55 bg-[#0b0f19] flex flex-col justify-between p-4 md:p-6 font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between text-white select-none">
          <div className="flex items-center gap-2">
            <span className="bg-[#3390ec]/20 text-[#3390ec] text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded">RED ON PRO</span>
            <span className="text-slate-200 text-xs font-semibold">Editar Mi Estado</span>
          </div>
          <button 
            type="button"
            onClick={() => {
              setIsEditing(false);
              setUploadedMedia(null);
              setMediaType(null);
              setPickedFile(null);
            }}
            className="text-white hover:text-rose-400 p-2 bg-white/10 hover:bg-white/15 rounded-full backdrop-blur-sm cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central interactive body */}
        <div className="flex-1 my-6 relative rounded-3xl overflow-hidden bg-black/40 border border-white/10 flex items-center justify-center shadow-2xl">
          {mediaType === 'video' ? (
            <video 
              src={uploadedMedia} 
              className="w-full h-full object-contain max-h-[60vh] rounded-3xl"
              muted 
              autoPlay 
              loop 
              playsInline 
            />
          ) : (
            <img 
              src={uploadedMedia} 
              alt="Preview" 
              className="w-full h-full object-contain max-h-[60vh] rounded-3xl"
            />
          )}

          {/* Prompt Floating "Editar Multimedia" button */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-6">
            <button
              type="button"
              onClick={() => setSelectedFileForEdit(pickedFile)}
              className="px-6 py-4 bg-[#3390ec] hover:bg-[#2879c9] active:scale-95 text-white rounded-2xl text-xs font-bold flex items-center gap-2.5 transition-all shadow-xl shadow-[#3390ec]/30 cursor-pointer border border-[#3390ec]"
            >
              <Sparkles className="w-4 h-4 text-white" />
              <span>Editar Multimedia</span>
            </button>
            <p className="text-[10px] text-slate-300 bg-slate-950/80 px-4 py-1.5 rounded-full border border-white/5 shadow-md">
              Aplica filtros cinematográficos, recorta video, añade textos o regula brillo
            </p>
          </div>
        </div>

        {/* MediaEditor inside edit view */}
        <MediaEditor
          isOpen={!!selectedFileForEdit}
          file={selectedFileForEdit}
          onClose={() => setSelectedFileForEdit(null)}
          onSave={handleFinishedEdit}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5] dark:bg-slate-900 overflow-y-auto pb-4 relative font-sans transition-colors duration-300">
      
      {/* Toast Alert */}
      {showToast && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-full flex items-center gap-2 shadow-lg backdrop-blur-md">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>¡Momento publicado correctamente!</span>
        </div>
      )}

      {/* Mi Momento Card */}
      <div className="px-4 pt-4 mb-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] flex items-center justify-between border border-transparent dark:border-slate-700/60 transition-colors duration-300">
          <div className="flex items-center gap-3.5">
            {/* User Avatar with additive absolute (+) symbol */}
            <div className="relative">
              <img 
                src={profile.avatar} 
                alt="Mi Avatar" 
                className="w-13 h-13 rounded-full object-cover border border-slate-100/50 dark:border-slate-700"
              />
              <button 
                onClick={() => setIsAddingMoment(true)}
                className="absolute -bottom-1 -right-1 bg-[#3390ec] text-white p-1 rounded-full border-2 border-white dark:border-slate-800 shadow-sm hover:bg-[#2b7bc9] transition-all cursor-pointer"
                title="Publicar nuevo momento"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div>
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm">Mi Momento</h3>
              <p className="text-slate-450 dark:text-slate-400 text-xs mt-0.5">Comparte lo que estás haciendo con la RED</p>
            </div>
          </div>

          <button
            onClick={() => setIsAddingMoment(true)}
            className="px-3 py-1.5 bg-[#3390ec]/10 hover:bg-[#3390ec]/15 dark:bg-[#3390ec]/20 dark:hover:bg-[#3390ec]/30 text-[#3390ec] font-semibold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Publicar</span>
          </button>
        </div>
      </div>

      {/* Botón de Cámara Grande y Claro (Activador Directo de Creador de Momentos) */}
      <div className="px-4 mb-4">
        <label 
          htmlFor="direct-moments-camera-input"
          className="bg-gradient-to-br from-[#3390ec]/5 to-[#3390ec]/15 dark:from-[#3390ec]/10 dark:to-[#3390ec]/5 border border-[#3390ec]/20 dark:border-slate-800 hover:border-[#3390ec] dark:hover:border-[#3390ec]/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-[#3390ec]/10 transition-all group scale-100 active:scale-98 relative shadow-[0_2px_8px_rgba(51,144,236,0.05)]"
          title="Tomar o adjuntar foto/video para mi Estado"
        >
          <input 
            type="file" 
            id="direct-moments-camera-input" 
            ref={fileInputRef} 
            onChange={handleFilePicked} 
            accept="image/*,video/*" 
            className="hidden" 
          />
          <div className="w-14 h-14 bg-[#3390ec] text-white rounded-full flex items-center justify-center shadow-lg shadow-[#3390ec]/30 group-hover:scale-110 transition-transform duration-300 mb-3">
            <Camera className="w-7 h-7 animate-pulse" />
          </div>
          <h4 className="text-slate-800 dark:text-slate-200 font-bold text-sm">Cambiar Mi Estado en RED ON</h4>
          <p className="text-slate-500 dark:text-slate-400 text-[11px] mt-1.5 max-w-[270px] leading-relaxed">
            Pulsa esta zona para subir una imagen o video desde tu dispositivo. Abrirá la ventana de publicación y previsualización al instante.
          </p>
        </label>
      </div>

      {/* Momentos Recientes Header - Block cover white background below: bg-white rounded-t-[32px] */}
      <div className="flex-1 bg-white dark:bg-slate-900 rounded-t-[32px] px-6 pt-6 shadow-[0_-2px_12px_rgba(0,0,0,0.02)] border-t border-slate-100/50 dark:border-slate-800 transition-colors duration-300">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4 px-1">
            <h2 className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Momentos Recientes</h2>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Pulsa para ver</span>
          </div>

          {/* List display */}
          <div className="divide-y divide-slate-100/70 dark:divide-slate-800/60">
            {localMoments.map((mom) => (
              <div 
                key={mom.id}
                onClick={() => handleViewMoment(mom)}
                className="py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 -mx-3 px-3 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 pr-2 truncate">
                  {/* Avatar wrapper with story circle */}
                  <div className="relative flex-shrink-0">
                    {mom.avatar ? (
                      <img 
                        src={mom.avatar} 
                        alt={mom.name} 
                        className={`w-12 h-12 rounded-full object-cover p-[2px] bg-white dark:bg-slate-900 transition-transform group-hover:scale-105 duration-200 ${
                          mom.hasUnseen 
                            ? 'ring-2 ring-[#3390ec] ring-offset-1 dark:ring-offset-slate-900' 
                            : 'ring-1 ring-slate-205 dark:ring-slate-700/80'
                        }`}
                      />
                    ) : (
                      <div className={`w-12 h-12 rounded-full ${mom.avatarColor || 'bg-slate-400'} text-white font-bold text-sm flex items-center justify-center p-[2px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-750 transition-transform group-hover:scale-105 duration-200 ${
                        mom.hasUnseen ? 'ring-2 ring-[#3390ec] ring-offset-1 dark:ring-offset-slate-900' : ''
                      }`}>
                        {mom.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="truncate">
                    <h3 className="text-slate-900 dark:text-slate-100 font-semibold text-sm leading-tight group-hover:text-[#3390ec] transition-colors">{mom.name}</h3>
                    <p className="text-slate-400 dark:text-slate-550 text-xs mt-0.5 truncate italic max-w-[200px]">"{mom.caption}"</p>
                  </div>
                </div>

                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[10px] text-slate-450 dark:text-slate-500 font-medium">{mom.time}</span>
                  {mom.hasUnseen && (
                    <span className="w-2 h-2 rounded-full bg-[#3390ec] mt-1.5" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {localMoments.length === 0 && (
            <div className="p-8 text-center text-slate-450 dark:text-slate-500 text-xs">
              No hay momentos para mostrar en este instante. ¡Sé el primero!
            </div>
          )}
        </div>
      </div>

      {/* --- ADD NEW MOMENT SUB-MODAL --- */}
      {isAddingMoment && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-sm overflow-hidden border border-slate-100 dark:border-slate-700 shadow-2xl transition-colors duration-300">
            <div className="p-4 bg-[#f8fafc] dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-slate-900 dark:text-white font-bold text-sm">Publicar mi Momento</h3>
              <button 
                onClick={() => setIsAddingMoment(false)}
                className="text-slate-400 dark:text-slate-505 hover:text-slate-600 dark:hover:text-slate-350 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePostMoment} className="p-5 space-y-4">
              {/* Media Uploader Container */}
              <div className="relative bg-[#f0f2f5] dark:bg-slate-900 aspect-video rounded-2xl flex flex-col items-center justify-center text-slate-400 overflow-hidden text-center group border border-dashed border-slate-300 dark:border-slate-700 hover:border-[#3390ec] dark:hover:border-[#3390ec] transition-colors">
                {uploadedMedia ? (
                  <div className="w-full h-full relative">
                    {mediaType === 'video' ? (
                      <video src={uploadedMedia} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                    ) : (
                      <img src={uploadedMedia} alt="Subidos" className="w-full h-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedMedia(null);
                        setMediaType(null);
                      }}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 shadow transition-colors z-10"
                      title="Eliminar archivo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label htmlFor="moments-media-input" className="w-full h-full flex flex-col items-center justify-center p-4 cursor-pointer">
                    <input 
                      type="file" 
                      id="moments-media-input" 
                      onChange={handleMediaUpload} 
                      accept="image/*,video/*" 
                      className="hidden" 
                    />
                    <Camera className="w-8 h-8 text-[#3390ec] mb-1.5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Subir foto o video</span>
                    <p className="text-[10px] text-slate-450 dark:text-slate-500 mt-1 max-w-[200px]">
                      Haz clic para seleccionar imágenes o vídeos reales de tu dispositivo.
                    </p>
                  </label>
                )}
              </div>

              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold block mb-1">Descripción corta</label>
                <textarea 
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="¿En qué andas hurgando hoy?..."
                  rows={2}
                  maxLength={120}
                  className="w-full text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm p-3 bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-[#3390ec] resize-none"
                  required
                />
                <span className="text-[10px] text-slate-400 dark:text-slate-500 text-right block mt-1">Límite 120 caracteres</span>
              </div>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddingMoment(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 text-xs font-semibold text-white bg-[#3390ec] hover:bg-[#2b7bc9] rounded-xl transition-all cursor-pointer"
                >
                  Publicar ahora
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MOMENT PREVIEW FULLSCREEN REPRODUCER --- */}
      {activeMoment && (() => {
        const idx = localMoments.findIndex(m => m.id === activeMoment.id);
        const total = localMoments.length;
        const isFirst = idx <= 0;
        const isLast = idx >= total - 1;
        const isVideo = activeMoment.image.startsWith('data:video/');
        const expired =
          !isNaN(parseInt(activeMoment.id)) &&
          Date.now() - parseInt(activeMoment.id) > 24 * 60 * 60 * 1000;

        const goNext = () => {
          if (!isLast) {
            setActiveMoment(localMoments[idx + 1]);
            setViewerPaused(false);
            setViewerProgress(0);
          } else {
            setActiveMoment(null);
          }
        };
        const goPrev = () => {
          if (!isFirst) {
            setActiveMoment(localMoments[idx - 1]);
            setViewerPaused(false);
            setViewerProgress(0);
          }
        };
        const handleTap = (e?: React.MouseEvent) => {
          e?.stopPropagation();
          setViewerPaused(p => !p);
        };
        const handleDelete = async () => {
          if (!confirm('¿Eliminar este momento?')) return;
          try { await api.deleteMoment(activeMoment.id); } catch {}
          setLocalMoments(prev => prev.filter(m => m.id !== activeMoment.id));
          goNext();
        };

        if (expired) {
          return (
            <div className="fixed inset-0 z-60 bg-slate-950 flex items-center justify-center p-8" key="expired">
              <div className="text-center text-white/50">
                <p className="text-sm font-semibold">Este momento ha expirado (24h)</p>
                <button onClick={() => setActiveMoment(null)} className="mt-4 text-[#3390ec] text-xs underline cursor-pointer">Cerrar</button>
              </div>
            </div>
          );
        }

        return (
        <div className="fixed inset-0 z-60 bg-slate-950 flex flex-col justify-between p-4 md:p-6 font-sans" key="viewer">
          {/* Top Progress bar */}
          <div className="w-full h-1 bg-white/20 rounded-full mb-4 overflow-hidden select-none">
            <div className="h-full bg-[#3390ec] rounded-full transition-none" style={{ width: `${viewerProgress}%` }} />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between text-white select-none" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <img src={activeMoment.avatar || 'https://picsum.photos/100/100'} alt={activeMoment.name} className="w-9 h-9 rounded-full object-cover border border-white/20" />
              <div>
                <h4 className="text-sm font-semibold">{activeMoment.name}</h4>
                <p className="text-[10px] text-slate-300">{activeMoment.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDelete} className="text-xs text-white/40 hover:text-rose-400 p-1.5 bg-white/5 hover:bg-white/10 rounded-full cursor-pointer transition-all" title="Eliminar momento">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setActiveMoment(null)} className="text-white hover:text-slate-300 p-2 bg-white/10 hover:bg-white/15 rounded-full backdrop-blur-sm cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Media */}
          <div className="flex-1 my-4 relative rounded-2xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            {isVideo ? (
              <video ref={viewerVideoRef} src={activeMoment.image} className="w-full h-full object-cover max-h-[500px]" autoPlay playsInline muted onEnded={goNext} onClick={handleTap} />
            ) : (
              <img src={activeMoment.image} alt="Story" className="w-full h-full object-cover max-h-[500px]" onClick={handleTap} />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 text-white min-h-[100px] flex flex-col justify-end pointer-events-none">
              <p className="text-sm font-medium tracking-wide text-center leading-relaxed antialiased">{activeMoment.caption}</p>
            </div>

            {viewerPaused && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-full flex items-center justify-center">
                  <div className="w-0 h-0 border-t-[10px] border-b-[10px] border-l-[16px] border-white ml-1" />
                </div>
              </div>
            )}

            {!isFirst && !viewerPaused && (
              <button onClick={(e) => { e.stopPropagation(); setViewerPaused(true); goPrev(); }} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 p-2 rounded-full backdrop-blur-sm transition-all cursor-pointer text-lg">‹</button>
            )}
            {!isLast && !viewerPaused && (
              <button onClick={(e) => { e.stopPropagation(); setViewerPaused(true); goNext(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/60 hover:text-white bg-black/30 hover:bg-black/50 p-2 rounded-full backdrop-blur-sm transition-all cursor-pointer text-lg">›</button>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between text-white border border-white/5 select-none relative" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-slate-350" />
              <span className="text-[11px] text-slate-300 font-medium">Visto por {activeMoment.viewCount || 0} personas</span>
            </div>
            <div className="flex items-center gap-2">
              {reactionSummary.slice(0, 3).map(r => (
                <span key={r.emoji} className="text-sm" title={`${r.emoji} ${r.count}`}>{r.emoji} {r.count > 1 ? r.count : ''}</span>
              ))}
              <div className="relative">
                <button onClick={() => setShowReactionPicker(!showReactionPicker)} className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer ${myReaction ? 'bg-[#3390ec]/30 text-white' : 'bg-[#3390ec]/20 text-white hover:bg-[#3390ec]/30'}`}>
                  {myReaction || <Smile className="w-4 h-4" />}
                  <span className="hidden sm:inline">{myReaction ? 'Reaccionaste' : 'Reaccionar'}</span>
                </button>
                {showReactionPicker && (
                  <div className="absolute bottom-full right-0 mb-2 bg-slate-800 border border-white/10 rounded-2xl p-2 flex gap-1 shadow-xl">
                    {EMOJIS.map(emoji => (
                      <button key={emoji} onClick={async () => { await handleReact(emoji); setShowReactionPicker(false); }} className={`text-2xl p-1.5 hover:bg-white/10 rounded-xl transition-all cursor-pointer ${myReaction === emoji ? 'bg-[#3390ec]/30 scale-110' : ''}`}>{emoji}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
        );
      })()}

      {/* Integration tag for MediaEditor inside standard views */}
      <MediaEditor
        isOpen={!!selectedFileForEdit}
        file={selectedFileForEdit}
        onClose={() => setSelectedFileForEdit(null)}
        onSave={handleFinishedEdit}
      />

    </div>
  );
}
