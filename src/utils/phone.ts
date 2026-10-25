/**
 * Normalisasi nomor telepon menjadi format WhatsApp JID
 * Contoh: '081234567890' -> '6281234567890@s.whatsapp.net'
 */
export function formatToWhatsAppJid(input: string): string {
  let cleaned = input.trim().replace(/[^0-9@.a-zA-Z_-]/g, '');

  if (cleaned.endsWith('@s.whatsapp.net') || cleaned.endsWith('@g.us')) {
    return cleaned;
  }

  // Hapus tanda + di awal jika ada
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Ganti awalan 0 menjadi 62 (standar Indonesia)
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }

  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Format nomor telepon bersih tanpa simbol untuk pairing code
 */
export function cleanPhoneNumber(input: string): string {
  let cleaned = input.trim().replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  return cleaned;
}
