/**
 * Evidence Upload Handler
 * Menangani file upload dengan drag-and-drop, progress, dan preview
 */

(function() {
  'use strict';

  // State management
  const selectedFiles = [];
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB
  
  const ALLOWED_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'audio/mpeg',
    'audio/mp4',
    'audio/x-m4a',
    'video/mp4',
    'video/webm'
  ];

  const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.mp3', '.m4a', '.mp4'];

  // File icons mapping
  const FILE_ICONS = {
    'application/pdf': '📄',
    'image/jpeg': '🖼️',
    'image/png': '🖼️',
    'image/webp': '🖼️',
    'audio/mpeg': '🎵',
    'audio/mp4': '🎵',
    'audio/x-m4a': '🎵',
    'video/mp4': '🎬',
    'video/webm': '🎬',
    'default': '📎'
  };

  /**
   * Initialize file upload handlers
   */
  function initEvidenceUpload() {
    const dropZone = document.getElementById('fileDropZone');
    const fileInput = document.getElementById('evidenceFiles');
    const fileWarnings = document.getElementById('fileWarnings');

    if (!dropZone || !fileInput) return;

    // Show warnings
    if (fileWarnings) {
      fileWarnings.style.display = 'block';
    }

    // Click to open file dialog
    dropZone.addEventListener('click', () => fileInput.click());

    // File input change
    fileInput.addEventListener('change', (e) => {
      handleFiles(Array.from(e.target.files));
      fileInput.value = ''; // Reset for re-selection
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleFiles(Array.from(e.dataTransfer.files));
    });

    // Keyboard accessibility
    dropZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Make dropZone focusable
    dropZone.setAttribute('tabindex', '0');
    dropZone.setAttribute('role', 'button');
    dropZone.setAttribute('aria-label', 'Klik atau seret file bukti ke sini');
  }

  /**
   * Handle selected files
   */
  function handleFiles(files) {
    const errors = [];
    const fileList = document.getElementById('fileList');
    const fileListItems = document.getElementById('fileListItems');

    for (const file of files) {
      // Check max files
      if (selectedFiles.length >= MAX_FILES) {
        errors.push(`Batas maksimal ${MAX_FILES} file tercapai`);
        break;
      }

      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: Terlalu besar (maks 10MB)`);
        continue;
      }

      // Check total size
      const currentTotal = selectedFiles.reduce((sum, f) => sum + f.size, 0);
      if (currentTotal + file.size > MAX_TOTAL_SIZE) {
        errors.push(`${file.name}: Total ukuran melebihi 25MB`);
        continue;
      }

      // Check file type
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        errors.push(`${file.name}: Tipe file tidak didukung`);
        continue;
      }

      // Check for duplicates
      const isDuplicate = selectedFiles.some(f => 
        f.name === file.name && f.size === file.size
      );
      if (isDuplicate) {
        errors.push(`${file.name}: File sudah dipilih`);
        continue;
      }

      // Add to selected files
      selectedFiles.push({
        file,
        id: generateId(),
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'selected' // selected, uploading, uploaded, error
      });
    }

    // Show errors
    if (errors.length > 0) {
      showError(errors.join('\n'));
    }

    // Update UI
    updateFileListUI();
  }

  /**
   * Update file list UI
   */
  function updateFileListUI() {
    const fileList = document.getElementById('fileList');
    const fileListItems = document.getElementById('fileListItems');
    const fileCount = selectedFiles.length;

    if (!fileList || !fileListItems) return;

    if (fileCount === 0) {
      fileList.style.display = 'none';
      return;
    }

    fileList.style.display = 'block';
    clearElement(fileListItems);

    selectedFiles.forEach((item, index) => {
      const fileEl = createFileItemElement(item, index);
      fileListItems.appendChild(fileEl);
    });

    // Update drop zone text
    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
      const p = dropZone.querySelector('p');
      if (p) {
        p.textContent = `${fileCount} file dipilih (${MAX_FILES - fileCount} slot tersisa)`;
      }
    }
  }

  /**
   * Create file item element
   */
  function createFileItemElement(item, index) {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.id = `file-item-${item.id}`;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'file-icon';
    icon.textContent = FILE_ICONS[item.type] || FILE_ICONS.default;
    div.appendChild(icon);

    // File info
    const info = document.createElement('div');
    info.className = 'file-info';

    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = item.name;
    name.title = item.name;
    info.appendChild(name);

    const meta = document.createElement('div');
    meta.className = 'file-meta';
    
    const size = document.createElement('span');
    size.textContent = formatFileSize(item.size);
    meta.appendChild(size);

    const status = document.createElement('span');
    status.className = `file-status ${item.status}`;
    status.textContent = getStatusText(item.status);
    status.id = `file-status-${item.id}`;
    meta.appendChild(status);

    info.appendChild(meta);

    // Progress bar (for uploading state)
    if (item.status === 'uploading') {
      const progress = document.createElement('div');
      progress.className = 'file-progress';
      progress.id = `file-progress-${item.id}`;
      
      const progressBar = document.createElement('div');
      progressBar.className = 'file-progress-bar';
      progressBar.style.width = '0%';
      progressBar.id = `file-progress-bar-${item.id}`;
      progress.appendChild(progressBar);
      
      info.appendChild(progress);
    }

    div.appendChild(info);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'file-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Hapus file';
    removeBtn.setAttribute('aria-label', `Hapus ${item.name}`);
    removeBtn.disabled = item.status === 'uploading';
    removeBtn.addEventListener('click', () => removeFile(item.id));
    div.appendChild(removeBtn);

    return div;
  }

  /**
   * Remove file from selection
   */
  function removeFile(fileId) {
    const index = selectedFiles.findIndex(f => f.id === fileId);
    if (index !== -1) {
      selectedFiles.splice(index, 1);
      updateFileListUI();
    }
  }

  /**
   * Clear all selected files
   */
  function clearFiles() {
    selectedFiles.length = 0;
    updateFileListUI();
  }

  /**
   * Get selected files for upload
   */
  function getSelectedFiles() {
    return selectedFiles.map(item => item.file);
  }

  /**
   * Upload files with progress
   */
  async function uploadFiles(reportId, onProgress) {
    const results = [];
    const totalFiles = selectedFiles.length;
    let completedFiles = 0;

    for (const item of selectedFiles) {
      if (item.status === 'uploaded') {
        results.push({ success: true, file: item.name });
        completedFiles++;
        continue;
      }

      try {
        // Update status to uploading
        item.status = 'uploading';
        updateFileStatusUI(item.id, 'uploading');

        // Create FormData
        const formData = new FormData();
        formData.append('evidence', item.file);

        // Upload with progress tracking
        const result = await uploadSingleFile(reportId, formData, item.id, (progress) => {
          if (onProgress) {
            onProgress({
              file: item.name,
              progress,
              completed: completedFiles,
              total: totalFiles
            });
          }
        });

        if (result.success) {
          item.status = 'uploaded';
          updateFileStatusUI(item.id, 'clean');
          results.push({ success: true, file: item.name, evidence: result.evidence });
        } else {
          item.status = 'error';
          updateFileStatusUI(item.id, 'rejected');
          results.push({ success: false, file: item.name, error: result.error });
        }
      } catch (err) {
        item.status = 'error';
        updateFileStatusUI(item.id, 'rejected');
        results.push({ success: false, file: item.name, error: err.message });
      }

      completedFiles++;
    }

    return results;
  }

  /**
   * Upload single file
   */
  function uploadSingleFile(reportId, formData, fileId, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          updateFileProgressUI(fileId, percentComplete);
          if (onProgress) onProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve({ success: true });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            resolve({ success: false, error: error.error || 'Upload gagal' });
          } catch {
            resolve({ success: false, error: 'Upload gagal' });
          }
        }
      });

      xhr.addEventListener('error', () => {
        resolve({ success: false, error: 'Network error' });
      });

      xhr.addEventListener('abort', () => {
        resolve({ success: false, error: 'Upload dibatalkan' });
      });

      xhr.open('POST', `/api/reports/${reportId}/evidence`);
      xhr.send(formData);
    });
  }

  /**
   * Update file status UI
   */
  function updateFileStatusUI(fileId, status) {
    const statusEl = document.getElementById(`file-status-${fileId}`);
    if (statusEl) {
      statusEl.className = `file-status ${status}`;
      statusEl.textContent = getStatusText(status);
    }
  }

  /**
   * Update file progress UI
   */
  function updateFileProgressUI(fileId, percent) {
    const progressBar = document.getElementById(`file-progress-bar-${fileId}`);
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
  }

  /**
   * Get status text
   */
  function getStatusText(status) {
    const texts = {
      'selected': 'Dipilih',
      'uploading': 'Mengupload...',
      'uploaded': 'Berhasil',
      'clean': 'Terverifikasi',
      'pending': 'Memproses...',
      'rejected': 'Ditolak',
      'error': 'Gagal'
    };
    return texts[status] || status;
  }

  /**
   * Format file size
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Generate unique ID
   */
  function generateId() {
    return 'file-' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Show error message
   */
  function showError(message) {
    // Use existing alert system if available
    if (typeof showTopSystemAlert === 'function') {
      showTopSystemAlert(message);
    } else {
      alert(message);
    }
  }

  /**
   * Quick escape - clear all files and reset UI
   */
  function quickEscape() {
    clearFiles();
    
    // Hide file list
    const fileList = document.getElementById('fileList');
    if (fileList) fileList.style.display = 'none';
    
    // Reset drop zone text
    const dropZone = document.getElementById('fileDropZone');
    if (dropZone) {
      const p = dropZone.querySelector('p');
      if (p) {
        p.textContent = 'Klik atau seret file ke sini';
      }
    }
    
    // Hide warnings
    const fileWarnings = document.getElementById('fileWarnings');
    if (fileWarnings) fileWarnings.style.display = 'none';
  }

  // Expose functions globally
  window.evidenceUpload = {
    init: initEvidenceUpload,
    handleFiles,
    clearFiles,
    getSelectedFiles,
    uploadFiles,
    quickEscape,
    getSelectedCount: () => selectedFiles.length,
    hasFiles: () => selectedFiles.length > 0
  };

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEvidenceUpload);
  } else {
    initEvidenceUpload();
  }
})();
