const DISCOVERY_URL = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;
let notesFileId = null;

const clientIdEl = document.getElementById('clientId');
const folderIdEl = document.getElementById('folderId');
const fileNameEl = document.getElementById('fileName');
const notesInputEl = document.getElementById('notesInput');
const connectBtnEl = document.getElementById('connectBtn');
const disconnectBtnEl = document.getElementById('disconnectBtn');
const loadBtnEl = document.getElementById('loadBtn');
const saveBtnEl = document.getElementById('saveBtn');
const statusEl = document.getElementById('status');

const SETTINGS_KEY = 'drive-notes-settings-v1';

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#b91c1c' : '#065f46';
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function writeSettings() {
  localStorage.setItem(
    SETTINGS_KEY,
    JSON.stringify({
      clientId: clientIdEl.value.trim(),
      folderId: folderIdEl.value.trim(),
      fileName: fileNameEl.value.trim(),
    })
  );
}

function loadSettingsIntoForm() {
  const settings = readSettings();
  clientIdEl.value = settings.clientId || '';
  folderIdEl.value = settings.folderId || '';
  fileNameEl.value = settings.fileName || 'phone-notes.txt';
}

function setConnectedUI(isConnected) {
  connectBtnEl.disabled = isConnected;
  disconnectBtnEl.disabled = !isConnected;
  loadBtnEl.disabled = !isConnected;
  saveBtnEl.disabled = !isConnected;
}

async function getToken() {
  const clientId = clientIdEl.value.trim();
  if (!clientId) {
    setStatus('Please enter your Google OAuth Client ID.', true);
    return;
  }

  writeSettings();

  if (!window.google || !window.google.accounts) {
    setStatus('Google Identity Services failed to load. Check your internet connection.', true);
    return;
  }

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        setStatus(`Google sign-in error: ${response.error}`, true);
        return;
      }
      accessToken = response.access_token;
      setConnectedUI(true);
      setStatus('Connected. You can load and save your notes now.');
    },
  });

  tokenClient.requestAccessToken({ prompt: 'consent' });
}

function disconnect() {
  accessToken = null;
  notesFileId = null;
  setConnectedUI(false);
  setStatus('Disconnected from Google Drive.');
}

async function driveRequest(path, options = {}) {
  if (!accessToken) {
    throw new Error('Not connected.');
  }

  const response = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Drive API error ${response.status}: ${errorText}`);
  }

  return response.status === 204 ? null : response.json();
}

async function findExistingNotesFile() {
  const folderId = folderIdEl.value.trim();
  const fileName = fileNameEl.value.trim();

  if (!folderId || !fileName) {
    throw new Error('Please provide both Folder ID and File Name.');
  }

  writeSettings();

  const query = encodeURIComponent(
    `name='${fileName.replace(/'/g, "\\'")}' and '${folderId}' in parents and trashed=false`
  );

  const result = await driveRequest(`files?q=${query}&fields=files(id,name)&pageSize=1`);
  return result.files?.[0] || null;
}

async function loadFromDrive() {
  try {
    setStatus('Loading notes from Drive...');
    const file = await findExistingNotesFile();

    if (!file) {
      notesFileId = null;
      notesInputEl.value = '';
      setStatus('No file found yet. Write your notes and press Save to create one.');
      return;
    }

    notesFileId = file.id;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.status}`);
    }

    notesInputEl.value = await response.text();
    setStatus(`Loaded "${file.name}" from Drive.`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function saveToDrive() {
  try {
    setStatus('Saving notes to Drive...');
    const folderId = folderIdEl.value.trim();
    const fileName = fileNameEl.value.trim();

    if (!folderId || !fileName) {
      throw new Error('Please provide both Folder ID and File Name.');
    }

    writeSettings();

    if (!notesFileId) {
      const existing = await findExistingNotesFile();
      notesFileId = existing?.id || null;
    }

    const metadata = notesFileId
      ? { name: fileName }
      : {
          name: fileName,
          parents: [folderId],
          mimeType: 'text/plain',
        };

    const boundary = 'drive-notes-boundary';
    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: text/plain\r\n\r\n' +
      `${notesInputEl.value}\r\n` +
      `--${boundary}--`;

    const method = notesFileId ? 'PATCH' : 'POST';
    const uploadPath = notesFileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${notesFileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

    const uploadResponse = await fetch(uploadPath, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${await uploadResponse.text()}`);
    }

    const uploaded = await uploadResponse.json();
    notesFileId = uploaded.id;
    setStatus(`Saved to Google Drive file "${fileName}".`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function init() {
  loadSettingsIntoForm();
  setConnectedUI(false);

  connectBtnEl.addEventListener('click', getToken);
  disconnectBtnEl.addEventListener('click', disconnect);
  loadBtnEl.addEventListener('click', loadFromDrive);
  saveBtnEl.addEventListener('click', saveToDrive);

  [clientIdEl, folderIdEl, fileNameEl].forEach((el) => {
    el.addEventListener('change', writeSettings);
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  }

  fetch(DISCOVERY_URL).catch(() => {
    // Light availability check; app still works without this result.
  });
}

window.addEventListener('DOMContentLoaded', init);
