/**
 * Malware Scanner Module
 * Signature scanner + optional ClamAV integration
 */

const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

const SCANNER_MODE = process.env.EVIDENCE_SCANNER_MODE || 'standard';

// Known malicious file signatures (untuk testing)
const MALICIOUS_SIGNATURES = {
  // EICAR test file (standard antivirus test)
  eicar: 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*',
  
  // PHP shell signatures
  phpShell: [
    '<?php eval(',
    '<?php system(',
    '<?php exec(',
    'c99shell',
    'r57shell',
    'WSO '
  ],
  
  // JavaScript malicious patterns
  jsMalicious: [
    'eval(atob(',
    'document.write(unescape(',
    'String.fromCharCode(60,115,99,114,105,112,116)',
    'window.location="data:text/html'
  ],
  
  // Suspicious file headers
  suspiciousHeaders: [
    'MZ', // Windows executable
    '#!/bin/', // Shell script
    '#!/usr/bin/', // Shell script
    '<%', // ASP/JSP
    '<?php' // PHP
  ]
};

// File type specific checks
const FILE_TYPE_CHECKS = {
  'application/pdf': {
    maxPages: 1000,
    checkJavaScript: true,
    checkEmbeddedFiles: true,
    checkLaunchActions: true
  },
  'image/jpeg': {
    checkExifOverflow: true,
    maxDimension: 20000
  },
  'image/png': {
    checkChunkOverflow: true,
    maxDimension: 20000
  }
};

/**
 * Scan file buffer untuk malicious content
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} mimeType - MIME type file
 * @param {string} fileName - Nama file
 * @returns {Promise<{clean: boolean, result: string, details?: object}>}
 */
async function scanWithClamAv(fileBuffer) {
  const host = process.env.CLAMAV_HOST;
  const port = Number(process.env.CLAMAV_PORT || 3310);
  if (!host) return null;

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.write('zINSTREAM\0');
      const chunkSize = Buffer.alloc(4);
      chunkSize.writeUInt32BE(fileBuffer.length, 0);
      socket.write(chunkSize);
      socket.write(fileBuffer);
      const end = Buffer.alloc(4);
      end.writeUInt32BE(0, 0);
      socket.write(end);
    });

    let response = '';
    socket.on('data', (chunk) => { response += chunk.toString('utf8'); });
    socket.on('error', () => resolve({ available: true, clean: false, error: 'ClamAV connection failed' }));
    socket.on('end', () => {
      const clean = response.includes('OK') && !response.includes('FOUND');
      resolve({ available: true, clean, result: clean ? 'ClamAV: clean' : 'ClamAV: malware detected' });
    });
    socket.setTimeout(5000, () => {
      socket.destroy();
      resolve({ available: true, clean: false, error: 'ClamAV timeout' });
    });
  });
}

function validateScannerForProduction() {
  if (process.env.EVIDENCE_SCANNER_MODE !== 'strict') {
    throw new Error('EVIDENCE_SCANNER_MODE=strict wajib untuk production evidence');
  }
}

async function scanFile(fileBuffer, mimeType, fileName) {
  const findings = [];

  const clamResult = await scanWithClamAv(fileBuffer);
  if (clamResult) {
    if (!clamResult.clean) {
      return {
        clean: false,
        result: clamResult.result || clamResult.error || 'ClamAV mendeteksi ancaman',
        details: { engine: 'clamav' }
      };
    }
  } else if (SCANNER_MODE === 'strict' && process.env.CLAMAV_HOST) {
    return {
      clean: false,
      result: 'Scanner tidak tersedia (fail-closed)',
      details: { engine: 'clamav', failClosed: true }
    };
  }

  // 1. Check EICAR test file
  if (fileBuffer.toString('ascii').includes(MALICIOUS_SIGNATURES.eicar)) {
    findings.push({
      type: 'eicar',
      severity: 'high',
      description: 'EICAR test file terdeteksi'
    });
  }

  // 2. Check for embedded scripts in non-script files
  if (!mimeType.startsWith('text/') && !mimeType.includes('javascript')) {
    const content = fileBuffer.toString('utf8', 0, Math.min(10000, fileBuffer.length));
    
    for (const pattern of MALICIOUS_SIGNATURES.phpShell) {
      if (content.includes(pattern)) {
        findings.push({
          type: 'php_shell',
          severity: 'critical',
          description: 'PHP shell code terdeteksi'
        });
        break;
      }
    }
    
    for (const pattern of MALICIOUS_SIGNATURES.jsMalicious) {
      if (content.includes(pattern)) {
        findings.push({
          type: 'js_malicious',
          severity: 'high',
          description: 'Malicious JavaScript terdeteksi'
        });
        break;
      }
    }
  }

  // 3. Check suspicious headers
  const header = fileBuffer.toString('ascii', 0, 20);
  for (const sig of MALICIOUS_SIGNATURES.suspiciousHeaders) {
    if (header.startsWith(sig)) {
      // Hanya flag jika tidak sesuai dengan MIME type
      if (mimeType === 'image/jpeg' && sig === 'MZ') {
        findings.push({
          type: 'mismatch',
          severity: 'critical',
          description: 'File mengklaim sebagai JPEG tapi berisi executable'
        });
      }
    }
  }

  // 4. Check for polyglot files (file yang valid dalam beberapa format)
  if (mimeType.startsWith('image/')) {
    const content = fileBuffer.toString('ascii', 0, 1000);
    if (content.includes('<!DOCTYPE') || content.includes('<html')) {
      findings.push({
        type: 'polyglot',
        severity: 'high',
        description: 'Gambar mengandung HTML'
      });
    }
  }

  // 5. Check file size anomalies
  if (fileBuffer.length === 0) {
    findings.push({
      type: 'empty',
      severity: 'medium',
      description: 'File kosong'
    });
  }

  // 6. PDF specific checks
  if (mimeType === 'application/pdf') {
    const content = fileBuffer.toString('latin1');
    
    // Check for JavaScript in PDF
    if (content.includes('/JavaScript') || content.includes('/JS')) {
      findings.push({
        type: 'pdf_javascript',
        severity: 'high',
        description: 'PDF mengandung JavaScript'
      });
    }
    
    // Check for embedded files
    if (content.includes('/EmbeddedFile')) {
      findings.push({
        type: 'pdf_embedded',
        severity: 'medium',
        description: 'PDF mengandung file ter-embed'
      });
    }
    
    // Check for launch actions
    if (content.includes('/Launch')) {
      findings.push({
        type: 'pdf_launch',
        severity: 'critical',
        description: 'PDF mengandung launch action'
      });
    }
  }

  // Determine result
  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasHigh = findings.some(f => f.severity === 'high');
  
  if (hasCritical || hasHigh) {
    return {
      clean: false,
      result: 'File berbahaya terdeteksi',
      details: {
        findings,
        // Jangan kirim detail sensitif ke client
        summary: `${findings.length} masalah ditemukan`
      }
    };
  }

  if (findings.length > 0) {
    return {
      clean: true, // Tetap allow, tapi catat
      result: 'File memiliki potensi masalah minor',
      details: {
        findings,
        summary: `${findings.length} peringatan minor`
      }
    };
  }

  return {
    clean: true,
    result: 'File aman',
    details: {
      findings: [],
      summary: 'Tidak ada masalah terdeteksi'
    }
  };
}

/**
 * Scan file dari path
 */
async function scanFileFromPath(filePath, mimeType, fileName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return await scanFile(fileBuffer, mimeType, fileName);
  } catch (err) {
    return {
      clean: false,
      result: 'Gagal membaca file untuk scan',
      details: { error: err.message }
    };
  }
}

/**
 * Generate hash untuk file (untuk cache hasil scan)
 */
function generateFileHash(fileBuffer) {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Check apakah file hash sudah pernah di-scan
 */
const scanCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 jam

function getCachedScanResult(fileHash) {
  const cached = scanCache.get(fileHash);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  if (cached) {
    scanCache.delete(fileHash);
  }
  return null;
}

function setCachedScanResult(fileHash, result) {
  // Cleanup cache jika terlalu besar
  if (scanCache.size >= CACHE_MAX_SIZE) {
    const oldestKey = scanCache.keys().next().value;
    scanCache.delete(oldestKey);
  }
  
  scanCache.set(fileHash, {
    result,
    timestamp: Date.now()
  });
}

/**
 * Scan dengan cache
 */
async function scanFileWithCache(fileBuffer, mimeType, fileName) {
  const fileHash = generateFileHash(fileBuffer);
  
  // Check cache
  const cachedResult = getCachedScanResult(fileHash);
  if (cachedResult) {
    return { ...cachedResult, fromCache: true };
  }
  
  // Scan
  const result = await scanFile(fileBuffer, mimeType, fileName);
  
  // Cache result
  setCachedScanResult(fileHash, result);
  
  return { ...result, fromCache: false };
}

/**
 * Dapatkan statistik scanner
 */
function getScannerStats() {
  return {
    cacheSize: scanCache.size,
    cacheMaxSize: CACHE_MAX_SIZE,
    cacheTTL: CACHE_TTL
  };
}

/**
 * Clear scan cache
 */
function clearScanCache() {
  scanCache.clear();
}

module.exports = {
  scanFile,
  scanFileFromPath,
  scanFileWithCache,
  generateFileHash,
  getScannerStats,
  clearScanCache,
  validateScannerForProduction,
  MALICIOUS_SIGNATURES
};
