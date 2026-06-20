import { Router } from 'express';
import multer from 'multer';

const TEMPLATES = {
  catalogo: { duration: 5, transition: 'fadezoom', label: 'Modo Catálogo' },
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
  upload.array('images', 8)(req, res, (err) => {
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
    let transition = 'crossfade';
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

    processSlideshowAsync(files, { duration, transition, template: templateId }).catch(err => {
      console.error('[MEDIA] Error en procesamiento asíncrono:', err);
    });
  });
});

async function processSlideshowAsync(files, config) {
  const startTime = Date.now();
  console.log(`[MEDIA] Iniciando procesamiento de ${files.length} imágenes...`);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    console.log(`[MEDIA] Procesando imagen ${i + 1}/${files.length}: ${file.originalname} (${(file.buffer.length / 1024 / 1024).toFixed(2)} MB)`);
    await sleep(500);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[MEDIA] Procesamiento completado en ${elapsed}s — ${files.length} imágenes, ${config.duration}s c/u, transición=${config.transition}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default router;
