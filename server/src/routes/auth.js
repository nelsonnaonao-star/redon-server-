import { Router } from 'express';
import { getOne, getAll, run } from '../db.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '..', '..', '..', '.env') });

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || 'https://akgsylutbpgolurkcavh.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || '',
);

const router = Router();

// ─── SMS Password Recovery ────────────────────────────────────────────

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Step 1: Send reset code via SMS
router.post('/send-reset-code', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: 'Teléfono requerido' });

    const cleanPhone = phone.replace(/[\s+()\-]/g, '').trim();
    if (cleanPhone.length < 4) return res.status(400).json({ error: 'Teléfono inválido' });

    // Look up profile in Supabase
    const { data: profiles, error } = await supabaseAdmin
      .from('profiles')
      .select('id, phone_number, username')
      .ilike('phone_number', `%${cleanPhone}%`)
      .limit(1);

    if (error) {
      console.error('[SMS-RECOVERY] Supabase lookup error:', error);
      return res.status(500).json({ error: 'Error al buscar el usuario' });
    }

    const profile = profiles?.[0];
    if (!profile) return res.status(404).json({ error: 'No se encontró un usuario con ese teléfono' });

    // Invalidate any previous unused codes for this profile
    run('UPDATE password_reset_codes SET used = 1 WHERE profile_id = ? AND used = 0', [profile.id]);

    // Generate new code (15 min expiry)
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    run(
      'INSERT INTO password_reset_codes (profile_id, code, phone, expires_at) VALUES (?, ?, ?, ?)',
      [profile.id, code, profile.phone_number, expiresAt],
    );

    // Mask phone for response
    const maskedPhone = profile.phone_number.length > 4
      ? profile.phone_number.slice(0, -4).replace(/\d/g, '*') + profile.phone_number.slice(-4)
      : profile.phone_number;

    console.log(`[SMS-RECOVERY] Code for ${profile.phone_number}: ${code}`);

    // TODO: Integrate with real SMS provider (Twilio, etc.)
    res.json({
      message: 'Código enviado por SMS',
      maskedPhone,
      expiresIn: 900,
    });
  } catch (err) {
    console.error('[SMS-RECOVERY] Error:', err);
    res.status(500).json({ error: 'Error interno al enviar el código' });
  }
});

// Step 2: Verify reset code
router.post('/verify-reset-code', (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) return res.status(400).json({ error: 'Teléfono y código requeridos' });

    const cleanPhone = phone.replace(/[\s+()\-]/g, '').trim();
    const now = new Date().toISOString();

    const record = getOne(
      `SELECT id, profile_id, expires_at FROM password_reset_codes
       WHERE phone LIKE ? AND code = ? AND used = 0 AND expires_at > ?
       ORDER BY id DESC LIMIT 1`,
      [`%${cleanPhone}%`, code, now],
    );

    if (!record) return res.status(400).json({ error: 'Código inválido o expirado' });

    res.json({ message: 'Código verificado', profileId: record.profile_id });
  } catch (err) {
    console.error('[SMS-RECOVERY] Verify error:', err);
    res.status(500).json({ error: 'Error al verificar el código' });
  }
});

// Step 3: Update password
router.post('/update-password', async (req, res) => {
  try {
    const { phone, code, newPassword } = req.body;
    if (!phone || !code || !newPassword) {
      return res.status(400).json({ error: 'Teléfono, código y nueva contraseña requeridos' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
    }

    const cleanPhone = phone.replace(/[\s+()\-]/g, '').trim();
    const now = new Date().toISOString();

    const record = getOne(
      `SELECT id, profile_id FROM password_reset_codes
       WHERE phone LIKE ? AND code = ? AND used = 0 AND expires_at > ?
       ORDER BY id DESC LIMIT 1`,
      [`%${cleanPhone}%`, code, now],
    );

    if (!record) return res.status(400).json({ error: 'Código inválido o expirado. Solicita uno nuevo.' });

    // Update password via Supabase Admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      record.profile_id,
      { password: newPassword },
    );

    if (error) {
      console.error('[SMS-RECOVERY] Supabase update error:', error);
      return res.status(500).json({ error: 'Error al actualizar la contraseña' });
    }

    // Mark code as used
    run('UPDATE password_reset_codes SET used = 1 WHERE id = ?', [record.id]);

    console.log(`[SMS-RECOVERY] Password updated for profile ${record.profile_id}`);
    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('[SMS-RECOVERY] Update password error:', err);
    res.status(500).json({ error: 'Error al actualizar la contraseña' });
  }
});

export default router;
