/**
 * Metadata Stripper Module
 * Menghapus metadata sensitif dari gambar
 * Menggunakan sharp untuk image processing
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// MIME types yang mendukung metadata stripping
const SUPPORTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

/**
 * Strip metadata dari gambar
 * @param {Buffer} imageBuffer - Buffer gambar
 * @param {string} mimeType - MIME type gambar
 * @returns {Promise<{success: boolean, buffer?: Buffer, stripped: string[], error?: string}>}
 */
async function stripImageMetadata(imageBuffer, mimeType) {
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return {
      success: true,
      buffer: imageBuffer,
      stripped: [],
      note: 'MIME type tidak mendukung metadata stripping'
    };
  }

  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();
    
    // Metadata yang akan dihapus
    const stripped = [];
    
    // EXIF data (GPS, camera, etc.)
    if (metadata.exif) {
      stripped.push('EXIF');
    }
    
    // IPTC data (caption, keywords, etc.)
    if (metadata.iptc) {
      stripped.push('IPTC');
    }
    
    // XMP data (Adobe metadata)
    if (metadata.xmp) {
      stripped.push('XMP');
    }
    
    // ICC profile (color profile - bisa identifikasi perangkat)
    if (metadata.icc) {
      stripped.push('ICC');
    }

    // Strip semua metadata dengan mengonversi ulang
    let processedBuffer;
    
    switch (mimeType) {
      case 'image/jpeg':
        processedBuffer = await image
          .jpeg({
            quality: 90,
            mozjpeg: true // Kompresi lebih baik
          })
          .toBuffer();
        break;
        
      case 'image/png':
        processedBuffer = await image
          .png({
            compressionLevel: 9
          })
          .toBuffer();
        break;
        
      case 'image/webp':
        processedBuffer = await image
          .webp({
            quality: 90
          })
          .toBuffer();
        break;
        
      default:
        processedBuffer = imageBuffer;
    }

    // Verifikasi bahwa metadata sudah dihapus
    const verifyMetadata = await sharp(processedBuffer).metadata();
    const remainingMetadata = [];
    
    if (verifyMetadata.exif) remainingMetadata.push('EXIF');
    if (verifyMetadata.iptc) remainingMetadata.push('IPTC');
    if (verifyMetadata.xmp) remainingMetadata.push('XMP');

    return {
      success: true,
      buffer: processedBuffer,
      stripped,
      remaining: remainingMetadata,
      originalSize: imageBuffer.length,
      processedSize: processedBuffer.length
    };
  } catch (err) {
    console.error('Metadata stripping error:', err.message);
    
    // Jika gagal, kembalikan buffer asli
    // Production: mungkin lebih baik reject file
    return {
      success: false,
      buffer: imageBuffer,
      stripped: [],
      error: 'Gagal menghapus metadata: ' + err.message
    };
  }
}

/**
 * Dapatkan info metadata gambar tanpa menghapusnya
 */
async function getImageMetadata(imageBuffer, mimeType) {
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return {
      hasMetadata: false,
      note: 'MIME type tidak mendukung'
    };
  }

  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    return {
      hasMetadata: !!(metadata.exif || metadata.iptc || metadata.xmp),
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      channels: metadata.channels,
      depth: metadata.depth,
      density: metadata.density,
      hasExif: !!metadata.exif,
      hasIptc: !!metadata.iptc,
      hasXmp: !!metadata.xmp,
      hasIcc: !!metadata.icc,
      // Jangan kirim isi metadata sensitif!
      exifLength: metadata.exif ? metadata.exif.length : 0
    };
  } catch (err) {
    return {
      hasMetadata: false,
      error: err.message
    };
  }
}

/**
 * Validasi dimensi gambar
 */
async function validateImageDimensions(imageBuffer, mimeType, maxDimension = 4096) {
  if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
    return { valid: true, note: 'Bukan gambar' };
  }

  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    if (metadata.width > maxDimension || metadata.height > maxDimension) {
      return {
        valid: false,
        error: `Dimensi gambar terlalu besar (maks ${maxDimension}x${maxDimension})`,
        width: metadata.width,
        height: metadata.height
      };
    }

    return {
      valid: true,
      width: metadata.width,
      height: metadata.height
    };
  } catch (err) {
    return {
      valid: false,
      error: 'Gagal membaca dimensi gambar: ' + err.message
    };
  }
}

module.exports = {
  stripImageMetadata,
  getImageMetadata,
  validateImageDimensions,
  SUPPORTED_IMAGE_TYPES
};
