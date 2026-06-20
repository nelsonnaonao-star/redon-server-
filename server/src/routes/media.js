import { Router } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const TEMPLATES = {
  catalogo: { duration: 5, transition: 'fade', label: 'Modo Catálogo' },
  oferta: { duration: 3, transition: 'slide', label: 'Modo Oferta Comercial' },
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 8 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'images' && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes en el campo "images"'));
    }
  },
});

const router = Router();

  router.post('/render-slideshow', (req, res) => {
    console.log("🚀 [BACKEND] ¡Petición de video recibida con éxito! Procesando imágenes...");
    upload.array('images', 8)(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Cada imagen debe ser menor a 20 MB' });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({ error: 'Solo se permiten hasta 8 imágenes' });
        }
      }
      return res.status(400).json({ error: err.message || 'Error al procesar archivos' });
    }

    try {
      const files = req.files;
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No se recibieron imágenes' });
      }
      if (files.length < 2) {
        return res.status(400).json({ error: 'Se requieren al menos 2 imágenes' });
      }

      const templateId = req.body.template;
      const explicitDuration = Number(req.body.duration);

      let duration = 5;
      let transition = 'fade';
      let templateName = null;

      if (templateId && TEMPLATES[templateId]) {
        const tpl = TEMPLATES[templateId];
        duration = tpl.duration;
        transition = tpl.transition;
        templateName = tpl.label;
      }

      if (!templateId && !isNaN(explicitDuration) && explicitDuration > 0) {
        duration = explicitDuration;
      }

      if (req.body.transition) {
        transition = req.body.transition;
      }

      const totalSec = files.length * duration;

      console.log(`[MEDIA] POST /render-slideshow 202 — ${files.length} imágenes, ${duration}s c/u, transición=${transition}, plantilla=${templateName || 'personalizada'}, total=${totalSec}s`);

      res.status(202).json({
        status: 'accepted',
        message: 'Renderizado de video iniciado correctamente',
        data: {
          images: files.map(f => ({
            name: f.originalname,
            size: f.size,
            mimetype: f.mimetype,
          })),
          config: {
            duration,
            transition,
            template: templateId || null,
            totalDurationSec: totalSec,
          },
          estimatedDuration: `${totalSec.toFixed(1)}s`,
          timestamp: new Date().toISOString(),
        },
      });

      processSlideshowAsync(files, { duration, transition }).catch(err => {
        console.error('[MEDIA] Error en procesamiento asíncrono:', err.message);
      });
    } catch (err) {
      console.error('[MEDIA] Error en POST /render-slideshow:', err);
      if (!res.headersSent) {
        return res.status(500).json({ error: 'Error interno al procesar el video' });
      }
    }
  });
});

async function processSlideshowAsync(files, config) {
  const startTime = Date.now();
  const jobId = uuidv4().slice(0, 8);
  const tempDir = path.join(tmpdir(), `redon-slideshow-${jobId}`);
  const outputPath = path.join(tmpdir(), `redon-slideshow-${jobId}.mp4`);

  console.log(`[MEDIA:${jobId}] Iniciando procesamiento de ${files.length} imágenes...`);

  try {
    await fs.mkdir(tempDir, { recursive: true });

    const resizedPaths = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const outPath = path.join(tempDir, `img_${i}.jpg`);

      console.log(`[MEDIA:${jobId}] Redimensionando imagen ${i + 1}/${files.length}: ${file.originalname} (${(file.buffer.length / 1024 / 1024).toFixed(2)} MB)`);

      const resized = await sharp(file.buffer)
        .resize(1280, undefined, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      await fs.writeFile(outPath, resized);
      resizedPaths.push(outPath);

      console.log(`[MEDIA:${jobId}] Imagen ${i + 1} redimensionada a ${(resized.length / 1024 / 1024).toFixed(2)} MB`);
    }

    const { duration, transition } = config;

    if (!ffmpegPath) {
      throw new Error('No se encontró el binario de FFmpeg');
    }

    const ffmpegInputs = [];
    const filterParts = [];
    const xfadeLabels = [];

    for (let i = 0; i < resizedPaths.length; i++) {
      const label = `v${i}`;
      ffmpegInputs.push('-loop', '1', '-t', String(duration), '-i', resizedPaths[i]);
      filterParts.push(`[${i}:v]setpts=PTS-STARTPTS[${label}]`);
      xfadeLabels.push(label);
    }

    const xfadeDuration = 1;
    let currentLabel = xfadeLabels[0];

    for (let i = 0; i < xfadeLabels.length - 1; i++) {
      const nextLabel = xfadeLabels[i + 1];
      const xfadeLabel = `xf${i}`;
      const offset = (i + 1) * duration - xfadeDuration;
      const transitionType = transition === 'slide' ? 'slideright' : 'fade';
      filterParts.push(`[${currentLabel}][${nextLabel}]xfade=transition=${transitionType}:duration=${xfadeDuration}:offset=${offset}[${xfadeLabel}]`);
      currentLabel = xfadeLabel;
    }

    const filterComplex = filterParts.join(';\n');

    const args = [
      '-y',
      ...ffmpegInputs,
      '-filter_complex', filterComplex,
      '-map', `[${currentLabel}]`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      outputPath,
    ];

    console.log(`[MEDIA:${jobId}] Ejecutando FFmpeg...`);
    console.log(`[MEDIA:${jobId}] Comando: ${ffmpegPath} ${args.slice(0, 8).join(' ')} ...`);

    await execFileAsync(ffmpegPath, args, { timeout: 5 * 60 * 1000 });

    const stats = await fs.stat(outputPath);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[MEDIA:${jobId}] Video generado exitosamente: ${(stats.size / 1024 / 1024).toFixed(2)} MB en ${elapsed}s — ${outputPath}`);

    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (err) {
    console.error(`[MEDIA:${jobId}] Error en processSlideshowAsync:`, err.message);

    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (_) {}
    try {
      await fs.unlink(outputPath);
    } catch (_) {}

    throw err;
  }
}

export default router;
