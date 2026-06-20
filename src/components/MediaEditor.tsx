import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Sparkles, RotateCw, Contrast, Type, Check, 
  Scissors, Play, Pause, SlidersHorizontal, Zap, 
  Music, Layers, RefreshCw, Volume2, Wand2,
  Image, Smile, Layout, Eye, Loader, Crop, Diamond,
  ArrowUp, Expand, Palette, Monitor, Headphones
} from 'lucide-react';

interface MediaEditorProps {
  isOpen: boolean;
  file: File | null;
  onClose: () => void;
  onSave: (editedFile: File, caption: string) => void;
}

const FILTERS = [
  { id: 'none', name: 'Original' },
  { id: 'cinematic', name: 'Cinematic' },
  { id: 'bw', name: 'B&W' },
  { id: 'vivid', name: 'Vivid' },
  { id: 'warm', name: 'Cálido' },
  { id: 'cyber', name: 'Cyberpunk' },
  { id: 'rain', name: '🌧 Lluvia' }
];

const EXPORT_PRESETS = [
  { id: 'original', name: 'Original', w: 0, h: 0, label: 'Calidad original' },
  { id: 'tiktok', name: 'TikTok / Shorts', w: 1080, h: 1920, label: '9:16 vertical' },
  { id: 'instagram_post', name: 'Instagram Post', w: 1080, h: 1080, label: '1:1 cuadrado' },
  { id: 'instagram_story', name: 'Instagram Story', w: 1080, h: 1920, label: '9:16 vertical' },
  { id: 'youtube', name: 'YouTube', w: 1920, h: 1080, label: '16:9 horizontal' },
  { id: 'twitter', name: 'X / Twitter', w: 1280, h: 720, label: '16:9 horizontal' },
  { id: 'qhd', name: '2K QHD', w: 2560, h: 1440, label: '16:9 ultra' },
  { id: 'uhd', name: '4K UHD', w: 3840, h: 2160, label: '16:9 cine' },
];

const FONTS = [
  { id: 'sans-serif', name: 'Arial (Sencilla)' },
  { id: 'monospace', name: 'Courier New (Mono)' },
  { id: 'Impact, Haettenschweiler, sans-serif', name: 'Impact (Negrita)' },
  { id: 'Georgia, serif', name: 'Georgia (Elegante)' },
  { id: '"Comic Sans MS", cursive', name: 'Casual (Comic)' },
  { id: '"Montserrat", sans-serif', name: 'Premium (Montserrat)' }
];

const TRANSITIONS = [
  { id: 'none', name: 'Ninguno' },
  { id: 'fade-in', name: 'Fade In (Suave)' },
  { id: 'slide-in', name: 'Slide In (Deslizar)' }
];

export const MediaEditor: React.FC<MediaEditorProps> = ({
  isOpen,
  file,
  onClose,
  onSave
}) => {
  // Main Panel Navigation
  const [activeSubPanel, setActiveSubPanel] = useState<'none' | 'filters' | 'adjusts' | 'text' | 'trim' | 'audio' | 'transitions' | 'ai' | 'stickers' | 'collage' | 'kinetic' | 'transform'>('none');
  
  // Custom states for active pro filters and sliders
  const [activeFilter, setActiveFilter] = useState('none');
  const [caption, setCaption] = useState('');
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [isAutoEnhanced, setIsAutoEnhanced] = useState(false);
  
  // Text Overlay Customizer
  const [textOverlay, setTextOverlay] = useState('');
  const [textFont, setTextFont] = useState('sans-serif');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState({ x: 50, y: 40 });
  const [textBg, setTextBg] = useState(true);
  
  // Audio Layering (Video only)
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [uploadedAudioName, setUploadedAudioName] = useState<string>('');
  const [originalVolume, setOriginalVolume] = useState<number>(100); // 0-100
  const [uploadedVolume, setUploadedVolume] = useState<number>(80); // 0-100
  
  // Video Transitions
  const [videoTransition, setVideoTransition] = useState<string>('none');
  const [animationTriggerKey, setAnimationTriggerKey] = useState<number>(0);

  // AI Enhancement states
  const [aiMode, setAiMode] = useState<'none' | 'upscale' | 'removebg' | 'expand'>('none');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedFile, setProcessedFile] = useState<File | null>(null);
  
  // AR Stickers states
  const [activeStickers, setActiveStickers] = useState<{id: string; emoji: string; x: number; y: number; scale: number}[]>([]);
  const stickerCounter = useRef(0);

  // Collage states
  const [collageImages, setCollageImages] = useState<File[]>([]);
  const [collageLayout, setCollageLayout] = useState<'2grid' | '3grid' | '4grid'>('2grid');

  // Kinetic text animation states
  const [textAnimation, setTextAnimation] = useState<string>('none');
  const [textAnimationSpeed, setTextAnimationSpeed] = useState(1);

  // Variable playback speed (video only)
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // Export resolution
  const [exportPreset, setExportPreset] = useState('original');
  const [showExportPanel, setShowExportPanel] = useState(false);

  // Rain effect particles
  const rainCanvasRef = useRef<HTMLCanvasElement>(null);
  const rainAnimRef = useRef<number>(0);

  // Zoom / Ken Burns
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Preview mode
  const [isPreview, setIsPreview] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  // Refs
  const imageRef = useRef<HTMLImageElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const STICKER_PRESETS = [
    { id: 'heart', emoji: '❤️' },
    { id: 'fire', emoji: '🔥' },
    { id: 'star', emoji: '⭐' },
    { id: 'crown', emoji: '👑' },
    { id: 'rainbow', emoji: '🌈' },
    { id: 'sparkle', emoji: '✨' },
    { id: 'smile', emoji: '😊' },
    { id: 'sunglasses', emoji: '😎' },
    { id: 'rocket', emoji: '🚀' },
    { id: 'party', emoji: '🎉' },
    { id: 'unicorn', emoji: '🦄' },
    { id: 'butterfly', emoji: '🦋' },
  ];

  const TEXT_ANIMATIONS = [
    { id: 'none', name: 'Estático' },
    { id: 'typewriter', name: 'Máquina de escribir' },
    { id: 'bounce', name: 'Rebote cinético' },
    { id: 'wave', name: 'Onda vibrante' },
    { id: 'glow', name: 'Neón pulsante' },
    { id: 'shake', name: 'Shake (Temblor)' },
    { id: 'flip', name: 'Flip 3D' },
    { id: 'rainbow', name: 'Arcoíris' },
    { id: 'gradient', name: 'Gradiente cinético' },
    { id: 'glitch', name: 'Glitch digital' },
  ];

  // Video-specific trimming states
  const [isPlay, setIsPlay] = useState(false);
  const [videoDuration, setVideoDuration] = useState(15);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(15);

  // Sync video and extra audio play states
  React.useEffect(() => {
    if (videoRef.current) {
      if (isPlay) {
        videoRef.current.play().catch(() => {});
        if (audioRef.current && uploadedAudioUrl) {
          audioRef.current.currentTime = Math.max(0, videoRef.current.currentTime - trimStart);
          audioRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.pause();
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }
    }
  }, [isPlay, uploadedAudioUrl, trimStart]);

  // Sync original volume changes
  React.useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = originalVolume / 100;
    }
  }, [originalVolume]);

  // Sync secondary audio track volume changes
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = uploadedVolume / 100;
    }
  }, [uploadedVolume]);

  // Sync playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Rain effect animation loop
  useEffect(() => {
    if (activeFilter !== 'rain' || !rainCanvasRef.current) return;
    const canvas = rainCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const resize = () => { canvas.width = parent.clientWidth; canvas.height = parent.clientHeight; };
    resize();
    const drops: { x: number; y: number; speed: number; len: number }[] = [];
    for (let i = 0; i < 120; i++) {
      drops.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, speed: 4 + Math.random() * 6, len: 10 + Math.random() * 15 });
    }
    let running = true;
    const animate = () => {
      if (!running) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(160,190,255,0.35)';
      ctx.lineWidth = 1.5;
      for (const d of drops) {
        d.y += d.speed;
        if (d.y > canvas.height) { d.y = -d.len; d.x = Math.random() * canvas.width; }
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1.5, d.y + d.len);
        ctx.stroke();
      }
      rainAnimRef.current = requestAnimationFrame(animate);
    };
    animate();
    window.addEventListener('resize', resize);
    return () => { running = false; cancelAnimationFrame(rainAnimRef.current); window.removeEventListener('resize', resize); };
  }, [activeFilter]);

  if (!isOpen || !file) return null;

  const effectiveFile = processedFile || file;
  const isVideo = effectiveFile?.type?.startsWith('video/') ?? file.type.startsWith('video/');
  const fileUrl = (effectiveFile?.size ?? file.size) > 0 
    ? URL.createObjectURL(effectiveFile ?? file) 
    : (isVideo 
        ? "https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4" 
        : "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80"
      );

  const handleRotation = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleResetAdjustments = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setIsAutoEnhanced(false);
  };

  // Auto-Enhance preset: contrast +10% (110), saturation +15% (115), and a touch of sharpness/brightness
  const handleAutoEnhance = () => {
    setBrightness(105);
    setContrast(115);
    setSaturation(125);
    setIsAutoEnhanced(true);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audioFile = e.target.files?.[0];
    if (audioFile) {
      setUploadedAudioName(audioFile.name);
      const url = URL.createObjectURL(audioFile);
      setUploadedAudioUrl(url);
      
      // Reset play state to ensure user can tap play to hear both combined
      setIsPlay(false);
    }
  };

  // Render image with all edits baked into a canvas, then save
  const renderImageWithEdits = async (imgFile: File): Promise<File> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(imgFile); return; }

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Allocate space for rotation
        const rad = rotation * Math.PI / 180;
        const cos = Math.abs(Math.cos(rad));
        const sin = Math.abs(Math.sin(rad));
        const rw = Math.ceil(w * cos + h * sin);
        const rh = Math.ceil(w * sin + h * cos);
        canvas.width = rw;
        canvas.height = rh;

        // Build canvas-compatible filter string (percentages → decimals)
        const cf = (val: number) => (val / 100).toFixed(2);
        let canvasFilter = `brightness(${cf(brightness)}) contrast(${cf(contrast)}) saturate(${cf(saturation)})`;
        if (activeFilter === 'bw') canvasFilter += ' grayscale(1)';
        else if (activeFilter === 'cinematic') canvasFilter += ' saturate(1.5) contrast(1.25) sepia(0.15)';
        else if (activeFilter === 'vivid') canvasFilter += ' saturate(2) brightness(1.05)';
        else if (activeFilter === 'warm') canvasFilter += ' sepia(0.3) saturate(1.1)';
        else if (activeFilter === 'cyber') canvasFilter += ' hue-rotate(60deg) saturate(1.5) contrast(1.1)';
        const isRain = activeFilter === 'rain';

        ctx.filter = canvasFilter;

        // Draw image with rotation + zoom + pan (Ken Burns)
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rad);
        ctx.scale(zoomLevel, zoomLevel);
        ctx.translate(panX, panY);
        ctx.drawImage(img, -w / 2, -h / 2);
        ctx.resetTransform();

        // Draw text overlay
        if (textOverlay) {
          const fontSize = Math.max(14, Math.min(w, h) * 0.045);
          ctx.font = `${fontSize}px ${textFont}`;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          // Add dark background box behind text for readability
          const metrics = ctx.measureText(textOverlay);
          const tw = metrics.width + 20;
          const th = fontSize * 1.6;
          const tx = (textPosition.x / 100) * canvas.width;
          const ty = (textPosition.y / 100) * canvas.height;
          if (textBg) {
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.roundRect?.(tx - tw / 2, ty - th / 2, tw, th, 8) ?? ctx.fillRect(tx - tw / 2, ty - th / 2, tw, th);
            ctx.fill();
          }
          ctx.fillStyle = textColor;
          ctx.font = `${fontSize}px ${textFont}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(textOverlay, tx, ty);
        }

        // Draw stickers
        for (const s of activeStickers) {
          const fontSize = Math.max(24, Math.min(w, h) * 0.08);
          ctx.font = `${fontSize}px serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(s.emoji, (s.x / 100) * canvas.width, (s.y / 100) * canvas.height);
        }

        // Rain overlay
        if (isRain) {
          const drops = 150;
          const seed = Date.now() % 1000;
          ctx.strokeStyle = 'rgba(180,200,255,0.35)';
          ctx.lineWidth = 1.5;
          for (let i = 0; i < drops; i++) {
            const x = ((i * 137.5 + seed) % canvas.width);
            const y = ((i * 271.3 + seed * 2) % canvas.height);
            const len = 8 + (i % 12);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 1.5, y + len);
            ctx.stroke();
          }
        }

        const quality = 0.92;
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(new File([blob], 'edited_' + imgFile.name, { type: 'image/jpeg' }));
          } else {
            resolve(imgFile);
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(imgFile);
      img.src = URL.createObjectURL(imgFile);
    });
  };

  // Render video with all edits baked in using canvas.captureStream + MediaRecorder
  const renderVideoWithEdits = async (videoFile: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const videoEl = document.createElement('video');
      videoEl.src = URL.createObjectURL(videoFile);
      videoEl.muted = true;
      videoEl.crossOrigin = 'anonymous';
      videoEl.preload = 'auto';
      videoEl.playsInline = true;

      videoEl.onloadedmetadata = () => {
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const duration = videoEl.duration;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(videoFile); return; }

        // Build canvas filter string
        const cf = (val: number) => (val / 100).toFixed(2);
        let canvasFilter = `brightness(${cf(brightness)}) contrast(${cf(contrast)}) saturate(${cf(saturation)})`;
        if (activeFilter === 'bw') canvasFilter += ' grayscale(1)';
        else if (activeFilter === 'cinematic') canvasFilter += ' saturate(1.5) contrast(1.25) sepia(0.15)';
        else if (activeFilter === 'vivid') canvasFilter += ' saturate(2) brightness(1.05)';
        else if (activeFilter === 'warm') canvasFilter += ' sepia(0.3) saturate(1.1)';
        else if (activeFilter === 'cyber') canvasFilter += ' hue-rotate(60deg) saturate(1.5) contrast(1.1)';
        const isRain = activeFilter === 'rain';
        const preset = EXPORT_PRESETS.find(p => p.id === exportPreset);
        const targetW = preset?.w && preset.w > 0 ? preset.w : vw;
        const targetH = preset?.h && preset.h > 0 ? preset.h : vh;
        canvas.width = targetW;
        canvas.height = targetH;
        const scaleX = targetW / vw;
        const scaleY = targetH / vh;

        // Audio setup
        let audioCtx: AudioContext | null = null;
        let source: MediaElementAudioSourceNode | null = null;
        let dest: MediaStreamAudioDestinationNode | null = null;
        try {
          audioCtx = new AudioContext();
          source = audioCtx.createMediaElementSource(videoEl);
          dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
        } catch { /* audio may fail, continue without */ }

        const fps = 60;
        const canvasStream = canvas.captureStream(fps);
        const allTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
        if (dest?.stream.getAudioTracks().length) {
          allTracks.push(...dest.stream.getAudioTracks());
        }
        const combined = new MediaStream(allTracks);

        const mime = MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(combined, { mimeType: mime });
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

        const startTime = trimStart || 0;
        const endTime = Math.min(trimEnd || duration, duration);
        const totalFrames = Math.ceil((endTime - startTime) * fps);
        let frameIndex = 0;

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime });
          const ext = mime.includes('mp4') ? 'mp4' : 'webm';
          resolve(new File([blob], `edited_${videoFile.name.replace(/\.[^.]+$/, '')}.${ext}`, { type: mime }));
          audioCtx?.close();
        };

        recorder.start();

        videoEl.currentTime = startTime;
        videoEl.playbackRate = playbackSpeed;

        const renderFrame = () => {
          if (frameIndex >= totalFrames || videoEl.ended || videoEl.currentTime >= endTime) {
            videoEl.pause();
            recorder.stop();
            return;
          }

          // Apply filters + rotation + zoom + scale for target resolution
          ctx.filter = canvasFilter;
          ctx.save();
          ctx.scale(scaleX, scaleY);
          ctx.translate(canvas.width / 2 / scaleX, canvas.height / 2 / scaleY);
          ctx.rotate(rotation * Math.PI / 180);
          ctx.scale(zoomLevel, zoomLevel);
          ctx.translate(panX, panY);
          ctx.drawImage(videoEl, -vw / 2, -vh / 2);
          ctx.restore();
          ctx.filter = 'none';

          // Draw text overlay
          if (textOverlay) {
            const fontSize = Math.max(14, Math.min(targetW, targetH) * 0.045);
            ctx.font = `${fontSize}px ${textFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const metrics = ctx.measureText(textOverlay);
            const tw = metrics.width + 20;
            const th = fontSize * 1.6;
            const tx = (textPosition.x / 100) * canvas.width;
            const ty = (textPosition.y / 100) * canvas.height;
            if (textBg) {
              ctx.fillStyle = 'rgba(0,0,0,0.7)';
              ctx.roundRect?.(tx - tw / 2, ty - th / 2, tw, th, 8) ?? ctx.fillRect(tx - tw / 2, ty - th / 2, tw, th);
              ctx.fill();
            }
            ctx.fillStyle = textColor;
            ctx.font = `${fontSize}px ${textFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(textOverlay, tx, ty);
          }

          // Draw stickers
          for (const s of activeStickers) {
            const fontSize = Math.max(24, Math.min(targetW, targetH) * 0.08);
            ctx.font = `${fontSize}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(s.emoji, (s.x / 100) * canvas.width, (s.y / 100) * canvas.height);
          }

          // Rain overlay on video
          if (isRain) {
            const drops = 200;
            const seed = (frameIndex * 37) % 1000;
            ctx.strokeStyle = 'rgba(180,200,255,0.3)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < drops; i++) {
              const x = ((i * 137.5 + seed + frameIndex * 3) % canvas.width);
              const y = ((i * 271.3 + seed * 2 + frameIndex * 8) % canvas.height);
              const len = 10 + (i % 15);
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(x - 2, y + len);
              ctx.stroke();
            }
          }

          frameIndex++;
          const nextTime = startTime + (frameIndex / fps) / playbackSpeed;
          if (nextTime < endTime) {
            videoEl.currentTime = nextTime;
            videoEl.requestVideoFrameCallback
              ? videoEl.requestVideoFrameCallback(renderFrame)
              : setTimeout(renderFrame, 1000 / fps);
          } else {
            videoEl.pause();
            recorder.stop();
          }
        };

        videoEl.play().then(renderFrame).catch(() => {
          audioCtx?.close();
          resolve(videoFile);
        });
      };

      videoEl.onerror = () => resolve(videoFile);
    });
  };

  const handleApplyChanges = async () => {
    const finalCaption = caption || 'Momento';

    const baseFile = processedFile || file;
    let outputFile = baseFile;
    if (isVideo) {
      outputFile = await renderVideoWithEdits(baseFile);
    } else {
      outputFile = await renderImageWithEdits(baseFile);
    }
    
    onSave(outputFile, finalCaption);
  };

  // CSS Filter formulation based on active sliders and presets
  const filterStyle = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)` + 
    (activeFilter === 'bw' ? ' grayscale(100%)' : '') +
    (activeFilter === 'cinematic' ? ' saturate(1.5) contrast(1.25) sepia(0.15)' : '') +
    (activeFilter === 'vivid' ? ' saturate(2) brightness(1.05)' : '') +
    (activeFilter === 'warm' ? ' sepia(0.3) saturate(1.1)' : '') +
    (activeFilter === 'cyber' ? ' hue-rotate(60deg) saturate(1.5) contrast(1.1)' : '') +
    (activeFilter === 'rain' ? ' brightness(1.05) contrast(1.1)' : '');

  // Handle trimming adjustments which also seeks video in real-time
  const handleTrimStartChange = (val: number) => {
    setTrimStart(val);
    if (val > trimEnd) {
      setTrimEnd(val);
    }
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleTrimEndChange = (val: number) => {
    setTrimEnd(val);
    if (val < trimStart) {
      setTrimStart(val);
    }
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const duration = e.currentTarget.duration;
    if (duration && !isNaN(duration)) {
      setVideoDuration(duration);
      setTrimEnd(duration);
    }
  };

  const handleVideoTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.currentTime < trimStart) {
      video.currentTime = trimStart;
      if (audioRef.current && uploadedAudioUrl) {
        audioRef.current.currentTime = 0;
      }
    }
    if (video.currentTime >= trimEnd) {
      video.currentTime = trimStart;
      if (audioRef.current && uploadedAudioUrl) {
        audioRef.current.currentTime = 0;
      }
    }
  };

  // Force-restarting animation when transition is selected or toggled play
  const handleTransitionSelect = (transId: string) => {
    setVideoTransition(transId);
    setAnimationTriggerKey(prev => prev + 1);
    if (videoRef.current) {
      videoRef.current.currentTime = trimStart;
    }
  };

  // === AI Enhancements ===
  const handleUpscale = () => {
    if (isVideo) return;
    setIsProcessing(true);
    setAiMode('upscale');
    const img = imageRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth * 2;
    canvas.height = img.naturalHeight * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) {
        setProcessedFile(new File([blob], 'upscaled_' + file.name, { type: file.type }));
      }
      setIsProcessing(false);
    }, file.type, 0.95);
  };

  const handleRemoveBackground = () => {
    if (isVideo) return;
    setIsProcessing(true);
    setAiMode('removebg');
    const img = imageRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    // Sample bg color from top-left corner
    const r0 = data[0], g0 = data[1], b0 = data[2];
    const threshold = 60;
    for (let i = 0; i < data.length; i += 4) {
      const dr = data[i] - r0;
      const dg = data[i+1] - g0;
      const db = data[i+2] - b0;
      const dist = Math.sqrt(dr*dr + dg*dg + db*db);
      if (dist < threshold) {
        data[i+3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const newFile = new File([blob], 'nobg_' + file.name, { type: 'image/png' });
        setProcessedFile(newFile);
      }
      setIsProcessing(false);
    }, 'image/png');
  };

  const handleExpandCanvas = () => {
    if (isVideo) return;
    setIsProcessing(true);
    setAiMode('expand');
    const img = imageRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    const pad = Math.round(img.naturalWidth * 0.2);
    canvas.width = img.naturalWidth + pad * 2;
    canvas.height = img.naturalHeight + pad * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Fill with blurred average color
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.naturalWidth;
    tempCanvas.height = img.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCtx.drawImage(img, 0, 0);
    const avgData = tempCtx.getImageData(0, 0, 10, 10).data;
    let tr = 0, tg = 0, tb = 0;
    for (let i = 0; i < avgData.length; i += 4) {
      tr += avgData[i]; tg += avgData[i+1]; tb += avgData[i+2];
    }
    const n = avgData.length / 4;
    ctx.fillStyle = `rgb(${tr/n|0},${tg/n|0},${tb/n|0})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad, pad);
    canvas.toBlob((blob) => {
      if (blob) {
        setProcessedFile(new File([blob], 'expanded_' + file.name, { type: file.type }));
      }
      setIsProcessing(false);
    }, file.type, 0.95);
  };

  const handleAddSticker = (emoji: string) => {
    const id = `sticker-${stickerCounter.current++}`;
    setActiveStickers(prev => [...prev, { id, emoji, x: 50 + Math.random() * 20 - 10, y: 50 + Math.random() * 20 - 10, scale: 1 }]);
  };

  const handleRemoveSticker = (id: string) => {
    setActiveStickers(prev => prev.filter(s => s.id !== id));
  };

  // === Collage ===
  const handleCollageImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      const maxCollage = collageLayout === '2grid' ? 1 : collageLayout === '3grid' ? 2 : 3;
      const remaining = maxCollage - collageImages.length;
      setCollageImages(prev => [...prev, ...newFiles.slice(0, remaining)]);
    }
  };

  const handleCollageRemove = (index: number) => {
    setCollageImages(prev => prev.filter((_, i) => i !== index));
  };

  const getCollageMaxImages = () => collageLayout === '2grid' ? 2 : collageLayout === '3grid' ? 3 : 4;

  // === Kinetic Text ===
  const getTextAnimationClass = () => {
    if (textAnimation === 'none' || !textOverlay) return '';
    return `kinetic-text-${textAnimation}`;
  };

  const getTextAnimationStyle = (): React.CSSProperties => {
    const speed = textAnimationSpeed;
    const base: React.CSSProperties = {
      animationDuration: `${1 / speed}s`,
    };
    if (textAnimation === 'typewriter') {
      return { ...base, overflow: 'hidden', whiteSpace: 'nowrap', borderRight: '2px solid currentColor', animation: `kinetic-typewriter ${1.5/speed}s steps(${textOverlay.length}) forwards, kinetic-blink-caret ${0.5/speed}s step-end infinite` };
    }
    if (textAnimation === 'bounce') {
      return { ...base, animation: `kinetic-bounce ${0.6/speed}s ease infinite` };
    }
    if (textAnimation === 'wave') {
      return { ...base, animation: `kinetic-wave ${0.8/speed}s ease-in-out infinite` };
    }
    if (textAnimation === 'glow') {
      return { ...base, animation: `kinetic-glow ${1.2/speed}s ease-in-out infinite` };
    }
    if (textAnimation === 'shake') {
      return { ...base, animation: `kinetic-shake ${0.3/speed}s ease-in-out infinite` };
    }
    if (textAnimation === 'flip') {
      return { ...base, animation: `kinetic-flip ${0.8/speed}s ease-in-out infinite` };
    }
    if (textAnimation === 'rainbow') {
      return { ...base, animation: `kinetic-rainbow ${2/speed}s linear infinite` };
    }
    if (textAnimation === 'gradient') {
      return { ...base, background: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)', backgroundSize: '300% 100%', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', animation: `kinetic-gradient ${2/speed}s linear infinite` };
    }
    if (textAnimation === 'glitch') {
      return { ...base, animation: `kinetic-glitch ${0.8/speed}s step-end infinite` };
    }
    return {};
  };

  // Framer motion or CSS inline style based transition animation keyframe
  const getTransitionStyle = () => {
    if (!isPlay) return {};
    if (videoTransition === 'fade-in') {
      return { animation: `video-fade-in-anim 1.4s ease-out forwards` };
    }
    if (videoTransition === 'slide-in') {
      return { animation: `video-slide-in-anim 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards` };
    }
    return {};
  };

  // Reusable content block (image/video + text + stickers)
  const contentBlock = (
    <div
      key={`${videoTransition}-${animationTriggerKey}`}
      className="relative transition-all duration-300 rounded-3xl overflow-hidden shadow-2xl bg-black/40 border border-white/10"
      style={{
        transform: `rotate(${rotation}deg) scale(${zoomLevel}) translate(${panX}px, ${panY}px)`,
        ...getTransitionStyle()
      }}
    >
      {!isVideo ? (
                <img
                  ref={imageRef}
                  src={fileUrl}
                  alt="Preview to Edit"
                  className="max-h-[48vh] md:max-h-[55vh] object-contain rounded-3xl transition-all duration-300"
                  style={{
                    filter: filterStyle
                  }}
                />
              ) : (
                <div className="relative rounded-3xl overflow-hidden max-h-[48vh] md:max-h-[55vh]">
                  <video 
                    ref={videoRef}
                    src={fileUrl} 
                    className="max-h-[48vh] md:max-h-[55vh] object-contain"
                    controls={false}
                    loop
                    onLoadedMetadata={handleVideoLoadedMetadata}
                    onTimeUpdate={handleVideoTimeUpdate}
                    id="editor-video-preview"
                    style={{
                      filter: filterStyle
                    }}
                  />
                  
                  {/* Invisible tag for synced loaded secondary audio track */}
                  {uploadedAudioUrl && (
                    <audio 
                      ref={audioRef}
                      src={uploadedAudioUrl}
                      loop
                    />
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setIsPlay(!isPlay)}
                      className="p-4 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all cursor-pointer"
                    >
                      {isPlay ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
                    </motion.button>
                  </div>

                  {/* Speed badge */}
                  {playbackSpeed !== 1 && (
                    <div className="absolute top-2 left-2 bg-black/80 backdrop-blur px-2 py-0.5 rounded-full border border-white/15 shadow-lg">
                      <span className="text-[10px] font-bold text-yellow-300">{playbackSpeed}x</span>
                    </div>
                  )}
                </div>
              )}

              {/* Text Overlay Rendered directly on top with selected fonts and custom color */}
              {textOverlay && (
                <motion.div 
                  drag
                  dragMomentum={false}
                  className={`absolute px-4 py-2 border border-white/20 select-none shadow-2xl text-xs md:text-sm text-center max-w-[220px] rounded-2xl cursor-move whitespace-pre-wrap leading-tight ${textBg ? 'bg-black/85' : 'bg-transparent'} ${getTextAnimationClass()}`}
                  style={{ 
                    top: `${textPosition.y}%`, 
                    left: `${textPosition.x}%`,
                    transform: 'translate(-50%, -50%)',
                    fontFamily: textFont,
                    color: textColor,
                    ...getTextAnimationStyle(),
                  }}
                  onDrag={(_, info) => {
                    const parent = imageRef.current?.parentElement;
                    if (parent) {
                      const rect = parent.getBoundingClientRect();
                      setTextPosition({
                        x: ((info.point.x - rect.left) / rect.width) * 100,
                        y: ((info.point.y - rect.top) / rect.height) * 100,
                      });
                    }
                  }}
                >
                  {textOverlay}
                </motion.div>
              )}

              {/* Rain overlay effect */}
              {activeFilter === 'rain' && (
                <canvas
                  ref={rainCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none z-20"
                />
              )}

              {/* AR Stickers rendered on top */}
              {activeStickers.map((s) => (
                <motion.div
                  key={s.id}
                  drag
                  dragMomentum={false}
                  className="absolute text-3xl cursor-move select-none drop-shadow-2xl z-30"
                  style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%) scale(1)' }}
                  onDrag={(_, info) => {
                    const parent = imageRef.current?.parentElement;
                    if (parent) {
                      const rect = parent.getBoundingClientRect();
                      setActiveStickers(prev => prev.map(st =>
                        st.id === s.id ? { ...st, x: ((info.point.x - rect.left) / rect.width) * 100, y: ((info.point.y - rect.top) / rect.height) * 100 } : st
                      ));
                    }
                  }}
                  onDoubleClick={() => handleRemoveSticker(s.id)}
                >
                  {s.emoji}
                </motion.div>
              ))}
            </div>
          );

  // ===== PREVIEW MODE =====
  if (isPreview) {
    return (
      <div
        className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
        onClick={() => setIsPreview(false)}
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes video-fade-in-anim { 0% { opacity: 0; filter: blur(5px) ${filterStyle}; } 100% { opacity: 1; filter: blur(0px) ${filterStyle}; } }
          @keyframes video-slide-in-anim { 0% { transform: translateY(40px) scale(0.95); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
          .kinetic-text-typewriter { overflow: hidden; white-space: nowrap; border-right: 2px solid currentColor; animation: kinetic-typewriter 1.5s steps(30) forwards, kinetic-blink-caret 0.5s step-end infinite; }
          @keyframes kinetic-typewriter { from { width: 0 } to { width: 100% } }
          @keyframes kinetic-blink-caret { 50% { border-color: transparent } }
          .kinetic-text-bounce { animation: kinetic-bounce 0.6s ease infinite; }
          @keyframes kinetic-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
          .kinetic-text-wave { animation: kinetic-wave 0.8s ease-in-out infinite; }
          @keyframes kinetic-wave { 0%,100% { transform: skewX(0deg) } 25% { transform: skewX(-8deg) translateY(-4px) } 75% { transform: skewX(8deg) translateY(4px) } }
          .kinetic-text-glow { animation: kinetic-glow 1.2s ease-in-out infinite; }
          @keyframes kinetic-glow { 0%,100% { text-shadow: 0 0 5px currentColor, 0 0 10px currentColor } 50% { text-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor } }
          .kinetic-text-shake { animation: kinetic-shake 0.3s ease-in-out infinite; }
          @keyframes kinetic-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-5px) rotate(-2deg) } 75% { transform: translateX(5px) rotate(2deg) } }
          .kinetic-text-flip { animation: kinetic-flip 0.8s ease-in-out infinite; backface-visibility: hidden; }
          @keyframes kinetic-flip { 0% { transform: perspective(400px) rotateY(0deg) } 50% { transform: perspective(400px) rotateY(180deg) } 100% { transform: perspective(400px) rotateY(360deg) } }
          .kinetic-text-rainbow { animation: kinetic-rainbow 2s linear infinite; }
          @keyframes kinetic-rainbow { 0% { color: #ff6b6b } 17% { color: #feca57 } 33% { color: #48dbfb } 50% { color: #ff9ff3 } 67% { color: #54a0ff } 83% { color: #5f27cd } 100% { color: #ff6b6b } }
          .kinetic-text-glitch { animation: kinetic-glitch 0.8s step-end infinite; position: relative; }
          @keyframes kinetic-glitch { 0% { transform: translate(0) } 20% { transform: translate(-3px, 2px) } 40% { transform: translate(3px, -1px) } 60% { transform: translate(-2px, -2px) } 80% { transform: translate(2px, 1px) } 100% { transform: translate(0) } }
        `}} />
        <div className="scale-[1.8] md:scale-[2.2] pointer-events-none">
          {contentBlock}
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/10 text-white/50 text-[11px] font-bold">
          Tocá para volver al editor
        </div>
      </div>
    );
  }

  // ===== EDITOR MODE =====
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 overflow-hidden select-none">
      
      {/* Style block for transitions & kinetic animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes video-fade-in-anim { 0% { opacity: 0; filter: blur(5px) ${filterStyle}; } 100% { opacity: 1; filter: blur(0px) ${filterStyle}; } }
        @keyframes video-slide-in-anim { 0% { transform: translateY(40px) scale(0.95); opacity: 0; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .kinetic-text-typewriter { overflow: hidden; white-space: nowrap; border-right: 2px solid currentColor; animation: kinetic-typewriter 1.5s steps(30) forwards, kinetic-blink-caret 0.5s step-end infinite; }
        @keyframes kinetic-typewriter { from { width: 0 } to { width: 100% } }
        @keyframes kinetic-blink-caret { 50% { border-color: transparent } }
        .kinetic-text-bounce { animation: kinetic-bounce 0.6s ease infinite; }
        @keyframes kinetic-bounce { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-12px) } }
        .kinetic-text-wave { animation: kinetic-wave 0.8s ease-in-out infinite; }
        @keyframes kinetic-wave { 0%,100% { transform: skewX(0deg) } 25% { transform: skewX(-8deg) translateY(-4px) } 75% { transform: skewX(8deg) translateY(4px) } }
        .kinetic-text-glow { animation: kinetic-glow 1.2s ease-in-out infinite; }
        @keyframes kinetic-glow { 0%,100% { text-shadow: 0 0 5px currentColor, 0 0 10px currentColor } 50% { text-shadow: 0 0 20px currentColor, 0 0 40px currentColor, 0 0 60px currentColor } }
        .kinetic-text-shake { animation: kinetic-shake 0.3s ease-in-out infinite; }
        @keyframes kinetic-shake { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-5px) rotate(-2deg) } 75% { transform: translateX(5px) rotate(2deg) } }
        .kinetic-text-flip { animation: kinetic-flip 0.8s ease-in-out infinite; backface-visibility: hidden; }
        @keyframes kinetic-flip { 0% { transform: perspective(400px) rotateY(0deg) } 50% { transform: perspective(400px) rotateY(180deg) } 100% { transform: perspective(400px) rotateY(360deg) } }
        .kinetic-text-rainbow { animation: kinetic-rainbow 2s linear infinite; }
        @keyframes kinetic-rainbow { 0% { color: #ff6b6b } 17% { color: #feca57 } 33% { color: #48dbfb } 50% { color: #ff9ff3 } 67% { color: #54a0ff } 83% { color: #5f27cd } 100% { color: #ff6b6b } }
        .kinetic-text-glitch { animation: kinetic-glitch 0.8s step-end infinite; position: relative; }
        @keyframes kinetic-glitch { 0% { transform: translate(0) } 20% { transform: translate(-3px, 2px) } 40% { transform: translate(3px, -1px) } 60% { transform: translate(-2px, -2px) } 80% { transform: translate(2px, 1px) } 100% { transform: translate(0) } }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: brand; cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}} />

      {/* Absolute header buttons */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => { setActiveSubPanel('none'); onClose(); }}
        className="absolute left-6 top-6 z-50 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3.5 rounded-full backdrop-blur-md cursor-pointer transition-all border border-white/5"
        title="Descartar y Cerrar"
      >
        <X className="w-5 h-5" />
      </motion.button>

      <div className="absolute right-6 top-6 z-50 flex items-center gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          onClick={handleAutoEnhance}
          className={`px-4 py-2.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-lg ${
            isAutoEnhanced 
              ? 'bg-emerald-500 text-white shadow-emerald-500/20' 
              : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500 shadow-indigo-600/30'
          }`}
          title="Auto-Mejora Inteligente"
        >
          <Wand2 className={`w-3.5 h-3.5 ${isAutoEnhanced ? 'animate-bounce' : 'animate-pulse'}`} />
          <span>{isAutoEnhanced ? '¡Mejorado!' : 'Auto-Mejora'}</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsPreview(true)}
          className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full backdrop-blur-md cursor-pointer transition-all border border-white/10 shadow-lg"
          title="Vista previa de todos los cambios"
        >
          <Eye className="w-5 h-5" />
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.9 }}
          onClick={handleApplyChanges}
          className="bg-brand hover:bg-brand-dark active:scale-95 text-white p-3.5 rounded-full shadow-lg shadow-brand/40 cursor-pointer transition-all flex items-center justify-center"
          title="Aplicar cambios y compartir"
        >
          <Check className="w-5 h-5" />
        </motion.button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-4xl h-[85vh] flex flex-col justify-between items-center relative"
        id="immersive-pro-media-editor"
      >
        {/* Central Visual Canvas Area */}
        <div className="flex-1 w-full flex items-center justify-center p-4 relative overflow-hidden group">
          {contentBlock}
          
          {/* Minimal input overlay for captioning bottom */}
          <div className="absolute bottom-1 right-1/2 translate-x-1/2 w-full max-w-sm px-4">
            <input 
              type="text"
              placeholder="Escribe un comentario o pie de foto..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-black/75 backdrop-blur-md border border-white/15 rounded-2xl p-2.5 px-4 text-xs text-white placeholder-white/40 focus:outline-none focus:border-brand text-center"
            />
          </div>
        </div>

        {/* Floating Contextual Panel above lower toolbar */}
          <div className="w-full max-w-lg mb-4 min-h-[5rem] relative flex items-center justify-center z-40 px-3">
            <AnimatePresence mode="wait">
              
              {/* 1. FILTERS (Zap) */}
              {activeSubPanel === 'filters' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-center gap-2 overflow-x-auto"
                >
                  {FILTERS.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setActiveFilter(f.id)}
                      className={`shrink-0 text-[11px] font-bold px-3.5 py-2 rounded-lg border transition-all cursor-pointer ${
                        activeFilter === f.id 
                          ? 'border-brand bg-brand/20 text-brand' 
                          : 'border-white/5 bg-white/5 text-white/80 hover:bg-white/10'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                </motion.div>
              )}

              {/* 2. DYNAMIC GRANULAR ADJUSTS (SlidersHorizontal) */}
              {activeSubPanel === 'adjusts' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-4 rounded-2xl flex flex-col gap-3"
                >
                  {/* Slider controls */}
                  <div className="flex flex-col gap-2">
                    {/* Brightness slider */}
                    <div className="flex items-center justify-between text-white/80 text-[10px] font-semibold gap-3">
                      <span className="w-20">Brillo:</span>
                      <input 
                        type="range"
                        min="0"
                        max="200"
                        value={brightness}
                        onChange={(e) => setBrightness(parseInt(e.target.value))}
                        className="flex-1 accent-brand bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="w-8 text-right font-mono text-brand">{brightness}%</span>
                    </div>

                    {/* Contrast slider */}
                    <div className="flex items-center justify-between text-white/80 text-[10px] font-semibold gap-3">
                      <span className="w-20">Contraste:</span>
                      <input 
                        type="range"
                        min="0"
                        max="200"
                        value={contrast}
                        onChange={(e) => setContrast(parseInt(e.target.value))}
                        className="flex-1 accent-brand bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="w-8 text-right font-mono text-brand">{contrast}%</span>
                    </div>

                    {/* Saturation slider */}
                    <div className="flex items-center justify-between text-white/80 text-[10px] font-semibold gap-3">
                      <span className="w-20">Saturación:</span>
                      <input 
                        type="range"
                        min="0"
                        max="200"
                        value={saturation}
                        onChange={(e) => setSaturation(parseInt(e.target.value))}
                        className="flex-1 accent-brand bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="w-8 text-right font-mono text-brand">{saturation}%</span>
                    </div>
                  </div>

                  {/* Reset Actions and metadata */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-2">
                    <span className="text-[9px] text-white/40">Calibración de color pro activa</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoEnhance}
                        className="px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                      >
                        <Wand2 className="w-3 h-3" />
                        <span>Auto-Mejora</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleResetAdjustments}
                        className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Restablecer</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 3. TEXT CUSTOMIZER (Type) */}
              {activeSubPanel === 'text' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  {/* Row 1: Text type inside canvas */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/50 font-bold shrink-0">TEXTO:</span>
                    <input
                      type="text"
                      value={textOverlay}
                      onChange={(e) => setTextOverlay(e.target.value)}
                      placeholder="Superpón texto arrastrable..."
                      className="bg-transparent border-none text-xs text-white flex-1 outline-none font-semibold focus:outline-none placeholder-white/30"
                    />
                    {textOverlay && (
                      <button 
                        onClick={() => setTextOverlay('')}
                        className="text-[10px] text-rose-400 hover:text-white font-bold px-2 py-0.5 rounded bg-rose-500/10"
                      >
                        Vaciar
                      </button>
                    )}
                  </div>

                  {/* Row 1.5: Toggle text background */}
                  <div className="flex items-center gap-2 border-t border-white/5 pt-1.5 pb-1">
                    <span className="text-[10px] text-white/50 font-semibold">Fondo texto:</span>
                    <button
                      onClick={() => setTextBg(!textBg)}
                      className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                        textBg ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      {textBg ? '☑ Con fondo' : '☐ Sin fondo'}
                    </button>
                  </div>

                  {/* Row 2: Select font typography & color picker */}
                  <div className="flex items-center gap-3 border-t border-white/5 pt-2">
                    <span className="text-[10px] text-white/50 font-semibold">Fuente:</span>
                    <select
                      value={textFont}
                      onChange={(e) => setTextFont(e.target.value)}
                      className="bg-slate-900 border border-white/10 text-white rounded px-2 py-1 text-[10px] flex-1 font-semibold focus:ring-0 focus:outline-none"
                    >
                      {FONTS.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>

                    <span className="text-[10px] text-white/50 font-semibold">Color:</span>
                    <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-0.5 rounded border border-white/10">
                      <input 
                        type="color"
                        value={textColor}
                        onChange={(e) => setTextColor(e.target.value)}
                        className="w-4 h-4 rounded-full border-0 cursor-pointer overflow-hidden p-0 bg-transparent"
                      />
                      <span className="text-[9px] font-mono select-all uppercase text-white/85">{textColor}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* 4. VIDEO TRIMMER (Scissors) */}
              {activeSubPanel === 'trim' && isVideo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-1.5 text-[10px]"
                >
                  <div className="flex justify-between font-bold text-white/60 px-1">
                    <span>Recorte Clip:</span>
                    <span className="font-mono text-brand">{trimStart.toFixed(1)}s - {trimEnd.toFixed(1)}s</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="range" 
                      min="0" 
                      max={videoDuration} 
                      step="0.1" 
                      value={trimStart} 
                      onChange={(e) => handleTrimStartChange(parseFloat(e.target.value))}
                      className="flex-1 accent-brand h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                    <input 
                      type="range" 
                      min="0" 
                      max={videoDuration} 
                      step="0.1" 
                      value={trimEnd} 
                      onChange={(e) => handleTrimEndChange(parseFloat(e.target.value))}
                      className="flex-1 accent-brand h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </motion.div>
              )}

              {/* 5. AUDIO LAYERER (Music) */}
              {activeSubPanel === 'audio' && isVideo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3.5 rounded-2xl flex flex-col gap-3"
                >
                  {/* File trigger zone */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-white/80 font-bold">Pista Adicional de Fondo</span>
                      <span className="text-[9px] text-brand truncate max-w-[200px] font-mono">
                        {uploadedAudioName || "Sin audio subido (.mp3/.wav)"}
                      </span>
                    </div>

                    <input 
                      type="file"
                      ref={audioInputRef}
                      onChange={handleAudioUpload}
                      accept="audio/*"
                      className="hidden"
                    />

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => audioInputRef.current?.click()}
                        className="px-3 py-1.5 bg-brand hover:bg-blue-600 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition-all"
                      >
                        <Music className="w-3 h-3" />
                        <span>{uploadedAudioUrl ? "Cambiar" : "Subir"}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSubPanel('musiclib')}
                        className="px-3 py-1.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg text-[10px] font-bold text-white flex items-center gap-1 transition-all"
                      >
                        <Layers className="w-3 h-3" />
                        <span>Biblioteca</span>
                      </button>
                    </div>
                  </div>

                  {/* Dual mixer volumes */}
                  <div className="grid grid-cols-2 gap-3 border-t border-white/5 pt-2 text-[9px] text-white/60">
                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span>Audio Original:</span>
                        <span>{originalVolume}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={originalVolume}
                        onChange={(e) => setOriginalVolume(parseInt(e.target.value))}
                        className="w-full accent-brand bg-white/20 h-1 rounded appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span>Audio Importado:</span>
                        <span>{uploadedVolume}%</span>
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={uploadedVolume}
                        disabled={!uploadedAudioUrl}
                        onChange={(e) => setUploadedVolume(parseInt(e.target.value))}
                        className="w-full accent-brand bg-white/20 h-1 rounded appearance-none cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Music Library Picker */}
              {activeSubPanel === 'musiclib' && isVideo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2 max-h-64 overflow-y-auto"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 font-bold flex items-center gap-1.5">
                      <Headphones className="w-3 h-3 text-emerald-400" />
                      <span>Biblioteca Musical — toca para previsualizar</span>
                    </span>
                    <button
                      onClick={() => setActiveSubPanel('audio')}
                      className="text-[9px] text-brand hover:text-white px-2 py-0.5 rounded"
                    >
                      Volver
                    </button>
                  </div>
                  <MusicPickerInline
                    onSelect={(track) => {
                      setUploadedAudioName(track.title + ' - ' + track.artist);
                      setUploadedAudioUrl(track.file_url);
                      setActiveSubPanel('audio');
                    }}
                  />
                </motion.div>
              )}

              {/* 6. TRANSITIONS & EFFECTS (Layers) */}
              {activeSubPanel === 'transitions' && isVideo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <label className="text-[10px] text-white/50 font-bold px-1 select-none">
                    Efecto Dinámico al inicio del clip:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {TRANSITIONS.map((trans) => (
                      <button
                        key={trans.id}
                        type="button"
                        onClick={() => handleTransitionSelect(trans.id)}
                        className={`text-[10px] font-bold py-2 rounded-xl border transition-all cursor-pointer ${
                          videoTransition === trans.id
                            ? 'border-brand bg-brand/20 text-white'
                            : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {trans.name}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 7. AI ENHANCEMENTS - Upscale, Remove BG, Expand (Wand2) */}
              {activeSubPanel === 'ai' && !isVideo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <div className="text-[10px] text-white/50 font-bold mb-1 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-yellow-400" />
                    <span>IA Generativa — Mejora tu contenido</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={handleUpscale}
                      disabled={isProcessing}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-gradient-to-br from-purple-900/60 to-indigo-900/60 hover:from-purple-700/60 hover:to-indigo-700/60 border border-purple-500/20 rounded-xl text-[10px] font-bold text-white transition-all disabled:opacity-40"
                    >
                      <ArrowUp className="w-4 h-4 text-purple-400" />
                      <span>Upscale 2x</span>
                      {isProcessing && aiMode === 'upscale' && <Loader className="w-3 h-3 animate-spin" />}
                    </button>
                    <button
                      onClick={handleRemoveBackground}
                      disabled={isProcessing}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-gradient-to-br from-emerald-900/60 to-teal-900/60 hover:from-emerald-700/60 hover:to-teal-700/60 border border-emerald-500/20 rounded-xl text-[10px] font-bold text-white transition-all disabled:opacity-40"
                    >
                      <Crop className="w-4 h-4 text-emerald-400" />
                      <span>Quitar fondo</span>
                      {isProcessing && aiMode === 'removebg' && <Loader className="w-3 h-3 animate-spin" />}
                    </button>
                    <button
                      onClick={handleExpandCanvas}
                      disabled={isProcessing}
                      className="flex flex-col items-center gap-1 py-2.5 px-2 bg-gradient-to-br from-amber-900/60 to-orange-900/60 hover:from-amber-700/60 hover:to-orange-700/60 border border-amber-500/20 rounded-xl text-[10px] font-bold text-white transition-all disabled:opacity-40"
                    >
                      <Expand className="w-4 h-4 text-amber-400" />
                      <span>Expandir</span>
                      {isProcessing && aiMode === 'expand' && <Loader className="w-3 h-3 animate-spin" />}
                    </button>
                  </div>
                  {processedFile && (
                    <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-1">
                      <span className="text-[9px] text-emerald-400">✓ Procesado. Guarda para aplicar.</span>
                      <button
                        onClick={() => { setProcessedFile(null); setAiMode('none'); }}
                        className="text-[9px] text-rose-400 hover:text-white px-2 py-0.5 rounded bg-rose-500/10"
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 8. AR STICKERS (Smile) */}
              {activeSubPanel === 'stickers' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/50 font-bold flex items-center gap-1.5">
                      <Smile className="w-3 h-3 text-pink-400" />
                      <span>Pegatinas AR — Toca para añadir, doble clic para quitar</span>
                    </span>
                    {activeStickers.length > 0 && (
                      <button
                        onClick={() => setActiveStickers([])}
                        className="text-[9px] text-rose-400 hover:text-white px-2 py-0.5 rounded bg-rose-500/10"
                      >
                        Limpiar todo
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {STICKER_PRESETS.map((sticker) => (
                      <button
                        key={sticker.id}
                        onClick={() => handleAddSticker(sticker.emoji)}
                        className="text-2xl py-1.5 rounded-lg bg-white/5 hover:bg-white/15 hover:scale-110 transition-all active:scale-95 border border-white/5"
                        title={sticker.id}
                      >
                        {sticker.emoji}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* 9. COLLAGE INTELIGENTE (Layout) */}
              {activeSubPanel === 'collage' && !isVideo && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <div className="text-[10px] text-white/50 font-bold flex items-center gap-1.5">
                    <Layout className="w-3 h-3 text-cyan-400" />
                    <span>Collage Inteligente</span>
                  </div>
                  <div className="flex gap-2">
                    {(['2grid', '3grid', '4grid'] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => setCollageLayout(l)}
                        className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all ${
                          collageLayout === l ? 'border-cyan-400 bg-cyan-400/20 text-cyan-300' : 'border-white/10 bg-white/5 text-white/70'
                        }`}
                      >
                        {l === '2grid' ? '2 fotos' : l === '3grid' ? '3 fotos' : '4 fotos'}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleCollageImageAdd}
                      className="hidden"
                      id="collage-input"
                    />
                    <label
                      htmlFor="collage-input"
                      className="text-[10px] font-bold px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/20 text-cyan-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
                    >
                      <Image className="w-3 h-3" />
                      <span>Añadir imágenes ({collageImages.length}/{getCollageMaxImages() - 1})</span>
                    </label>
                  </div>
                  {collageImages.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-2">
                      {collageImages.map((img, i) => (
                        <div key={i} className="flex items-center gap-1 bg-white/10 rounded px-2 py-1">
                          <span className="text-[9px] text-white/70 truncate max-w-[60px]">{img.name}</span>
                          <button onClick={() => handleCollageRemove(i)} className="text-rose-400 text-[9px]">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {/* 11. KINETIC TEXT ANIMATION (Eye) */}
              {activeSubPanel === 'kinetic' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <div className="text-[10px] text-white/50 font-bold flex items-center gap-1.5">
                    <Eye className="w-3 h-3 text-violet-400" />
                    <span>Animación Cinética de Texto — Estilo TikTok</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {TEXT_ANIMATIONS.map((anim) => (
                      <button
                        key={anim.id}
                        onClick={() => setTextAnimation(anim.id)}
                        className={`text-[9px] font-bold py-1.5 px-1.5 rounded-lg border transition-all ${
                          textAnimation === anim.id ? 'border-violet-400 bg-violet-400/20 text-violet-200' : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {anim.name}
                      </button>
                    ))}
                  </div>
                  {textAnimation !== 'none' && (
                    <div className="flex items-center gap-2 border-t border-white/5 pt-2">
                      <span className="text-[9px] text-white/50">Velocidad:</span>
                      <input
                        type="range"
                        min="0.25"
                        max="3"
                        step="0.25"
                        value={textAnimationSpeed}
                        onChange={(e) => setTextAnimationSpeed(parseFloat(e.target.value))}
                        className="flex-1 accent-violet-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[9px] font-mono text-violet-300 w-8">{textAnimationSpeed}x</span>
                    </div>
                  )}
                </motion.div>
              )}

              {/* 11. TRANSFORM - Zoom, Pan, Speed (Diamond/Expand) */}
              {activeSubPanel === 'transform' && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-3"
                >
                  {/* Speed (video only) */}
                  {isVideo && (
                    <div>
                      <div className="text-[10px] text-white/50 font-bold mb-1.5 flex items-center gap-1.5">
                        <Zap className="w-3 h-3 text-yellow-400" />
                        <span>Velocidad de reproducción</span>
                      </div>
                      <div className="grid grid-cols-6 gap-1.5">
                        {[0.25, 0.5, 1, 1.5, 2, 4].map((s) => (
                          <button
                            key={s}
                            onClick={() => setPlaybackSpeed(s)}
                            className={`text-[10px] font-bold py-1.5 rounded-lg border transition-all ${
                              playbackSpeed === s 
                                ? 'border-yellow-400 bg-yellow-400/20 text-yellow-200' 
                                : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                          >
                            {s}x
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Zoom */}
                  <div className={isVideo ? 'border-t border-white/5 pt-2' : ''}>
                    <div className="flex items-center justify-between text-[10px] font-bold text-white/50 mb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Expand className="w-3 h-3 text-cyan-400" />
                        <span>Zoom / Ken Burns</span>
                      </span>
                      <button
                        onClick={() => { setZoomLevel(1); setPanX(0); setPanY(0); }}
                        className="text-[9px] text-rose-400 hover:text-white px-2 py-0.5 rounded bg-rose-500/10"
                      >
                        Restablecer
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white/40 w-8">Zoom:</span>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="0.05"
                        value={zoomLevel}
                        onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                        className="flex-1 accent-cyan-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                      />
                      <span className="text-[9px] font-mono text-cyan-300 w-10 text-right">{zoomLevel.toFixed(2)}x</span>
                    </div>
                    {zoomLevel > 1 && (
                      <div className="grid grid-cols-2 gap-2 mt-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/40">Pan X:</span>
                          <input
                            type="range"
                            min="-200"
                            max="200"
                            step="1"
                            value={panX}
                            onChange={(e) => setPanX(parseInt(e.target.value))}
                            className="flex-1 accent-cyan-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/40">Pan Y:</span>
                          <input
                            type="range"
                            min="-200"
                            max="200"
                            step="1"
                            value={panY}
                            onChange={(e) => setPanY(parseInt(e.target.value))}
                            className="flex-1 accent-cyan-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* 12. EXPORT RESOLUTION */}
              {activeSubPanel === 'export' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-0 w-full bg-black/95 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex flex-col gap-2"
                >
                  <div className="text-[10px] text-white/50 font-bold flex items-center gap-1.5 mb-1">
                    <Monitor className="w-3 h-3 text-emerald-400" />
                    <span>Exportar — Resolución profesional</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {EXPORT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setExportPreset(p.id)}
                        className={`text-[10px] font-bold py-2 px-2 rounded-xl border transition-all text-left ${
                          exportPreset === p.id
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300'
                            : 'border-white/5 bg-white/5 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        <div>{p.name}</div>
                        <div className="text-[8px] opacity-60">{p.label}{p.w > 0 ? ` • ${p.w}×${p.h}` : ''}</div>
                      </button>
                    ))}
                  </div>
                  {exportPreset !== 'original' && (
                    <div className="border-t border-white/5 pt-2 mt-1 text-[9px] text-emerald-400/70 flex items-center gap-1.5">
                      <Check className="w-3 h-3" />
                      <span>Exportando a {EXPORT_PRESETS.find(p => p.id === exportPreset)?.w}×{EXPORT_PRESETS.find(p => p.id === exportPreset)?.h}</span>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          {/* Core Floating Bottom Control Deck */}
          <div className="mb-4 bg-white/10 backdrop-blur-md p-4 rounded-3xl border border-white/10 flex gap-6 items-center shadow-2xl">
            
            {/* Filters toggle */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'filters' ? 'none' : 'filters')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'filters' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Filtros Profesionales"
            >
              <Zap className="w-5 h-5" />
            </button>

            {/* Adjustments toggle (brightness/contrast/saturation granular sliders) */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'adjusts' ? 'none' : 'adjusts')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'adjusts' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Ajustes de imagen (Brillo, Contraste, Saturación)"
            >
              <SlidersHorizontal className="w-5 h-5" />
            </button>

            {/* Rotation action */}
            <button
              onClick={handleRotation}
              className="p-2.5 rounded-full text-white/60 hover:text-white hover:bg-white/5 cursor-pointer transition-all active:scale-95"
              title="Rotar 90 grados"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            {/* Text addition */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'text' ? 'none' : 'text')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'text' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Añadir Texto"
            >
              <Type className="w-5 h-5" />
            </button>

            {/* Trimmer toggle if video */}
            {isVideo && (
              <button
                onClick={() => setActiveSubPanel(prev => prev === 'trim' ? 'none' : 'trim')}
                className={`p-2.5 rounded-full cursor-pointer transition-all ${
                  activeSubPanel === 'trim' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="Sincronizador / Recortador"
              >
                <Scissors className="w-5 h-5" />
              </button>
            )}

            {/* Audio layering track toggler */}
            {(isVideo) && (
              <button
                onClick={() => setActiveSubPanel(prev => prev === 'audio' ? 'none' : 'audio')}
                className={`p-2.5 rounded-full cursor-pointer transition-all ${
                  activeSubPanel === 'audio' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="Mezclar capas de Audio"
              >
                <Volume2 className="w-5 h-5" />
              </button>
            )}

            {/* Effects & transitions helper */}
            {isVideo && (
              <button
                onClick={() => setActiveSubPanel(prev => prev === 'transitions' ? 'none' : 'transitions')}
                className={`p-2.5 rounded-full cursor-pointer transition-all ${
                  activeSubPanel === 'transitions' ? 'bg-brand text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="Transiciones y efectos"
              >
                <Layers className="w-5 h-5" />
              </button>
            )}

            {/* ——— SEPARATOR ——— */}
            <div className="w-px h-6 bg-white/10" />

            {/* AI Enhancement */}
            {!isVideo && (
              <button
                onClick={() => setActiveSubPanel(prev => prev === 'ai' ? 'none' : 'ai')}
                className={`p-2.5 rounded-full cursor-pointer transition-all ${
                  activeSubPanel === 'ai' ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="IA Generativa (Mejora, Fondo, Expandir)"
              >
                <Sparkles className="w-5 h-5" />
              </button>
            )}

            {/* AR Stickers */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'stickers' ? 'none' : 'stickers')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'stickers' ? 'bg-pink-500 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Pegatinas AR / Stickers"
            >
              <Smile className="w-5 h-5" />
            </button>

            {/* Collage */}
            {!isVideo && (
              <button
                onClick={() => setActiveSubPanel(prev => prev === 'collage' ? 'none' : 'collage')}
                className={`p-2.5 rounded-full cursor-pointer transition-all ${
                  activeSubPanel === 'collage' ? 'bg-cyan-500 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                title="Collage Inteligente"
              >
                <Layout className="w-5 h-5" />
              </button>
            )}

            {/* Slideshow — Crear Video con Imágenes */}
            {/* Kinetic Text Animation */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'kinetic' ? 'none' : 'kinetic')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'kinetic' ? 'bg-violet-500 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Animación Cinética de Texto"
            >
              <Eye className="w-5 h-5" />
            </button>

            {/* Transform: Speed / Zoom / Pan */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'transform' ? 'none' : 'transform')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'transform' ? 'bg-cyan-500 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Velocidad / Zoom / Ken Burns"
            >
              <Expand className="w-5 h-5" />
            </button>

            {/* Separator */}
            <div className="w-px h-6 bg-white/10" />

            {/* Export Resolution */}
            <button
              onClick={() => setActiveSubPanel(prev => prev === 'export' ? 'none' : 'export')}
              className={`p-2.5 rounded-full cursor-pointer transition-all ${
                activeSubPanel === 'export' ? 'bg-emerald-500 text-white scale-110 shadow-lg' : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
              title="Exportar resolución profesional"
            >
              <Monitor className="w-5 h-5" />
            </button>

          </div>

        </motion.div>
      </div>
    );
  };

// ─── Inline Music Picker (inside editor) ──────────────────────────
import { getMusicLibrary, getMusicCategories, MusicTrack } from '../services/stickerService';

const MusicPickerInline: React.FC<{ onSelect: (track: MusicTrack) => void }> = ({ onSelect }) => {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCat, setActiveCat] = useState('Todas');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  React.useEffect(() => {
    getMusicLibrary().then(setTracks);
    getMusicCategories().then(cats => setCategories(['Todas', ...cats]));
  }, []);

  const filtered = activeCat === 'Todas' ? tracks : tracks.filter(t => t.category === activeCat);

  const handlePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) audioRef.current.src = track.file_url;
      audioRef.current?.play().catch(() => {});
      setPlayingId(track.id);
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-1">
      {categories.length > 1 && (
        <div className="flex gap-1 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCat(cat)}
              className={`shrink-0 text-[9px] font-bold px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
                activeCat === cat ? 'bg-emerald-500/30 text-emerald-300' : 'bg-white/5 text-white/50 hover:bg-white/10'
              }`}
            >{cat}</button>
          ))}
        </div>
      )}
      {filtered.map(track => (
        <div key={track.id} className="flex items-center gap-2 px-1 py-1.5 hover:bg-white/5 rounded-lg transition-all cursor-pointer">
          <button onClick={() => handlePlay(track)}
            className="shrink-0 w-6 h-6 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center cursor-pointer"
          >
            {playingId === track.id
              ? <Pause className="w-3 h-3 text-white" />
              : <Play className="w-3 h-3 text-white ml-0.5" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-white truncate">{track.title}</p>
            <p className="text-[8px] text-white/40 truncate">{track.artist}</p>
          </div>
          <span className="text-[8px] text-white/30 font-mono">{formatDuration(track.duration)}</span>
          <button onClick={() => onSelect(track)}
            className="shrink-0 text-[9px] font-bold px-2 py-0.5 bg-brand/30 hover:bg-brand/50 text-white rounded-lg transition-all cursor-pointer"
          >
            Usar
          </button>
        </div>
      ))}
      {filtered.length === 0 && (
        <p className="text-[10px] text-white/30 text-center py-4">Sin música disponible</p>
      )}
      <audio ref={audioRef} className="hidden" />
    </div>
  );
};


