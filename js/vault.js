/**
 * AegisVault - Vault Data & State Manager
 * Zero-knowledge encryption backed by Master PIN and Hardware Biometrics (WebAuthn)
 */

const VaultManager = (() => {
  const STORAGE_KEY = 'aegis_vault_data_v2';
  const OLD_STORAGE_KEY = 'aegis_vault_data_v1';
  const SETTINGS_KEY = 'aegis_vault_settings_v2';

  let vaultMasterKey = null; // Stored only in memory while unlocked
  let decryptedItems = [];
  let isUnlocked = false;
  let autoLockTimeoutId = null;
  let autoLockMinutes = 5;
  let onLockCallback = null;

  // Load persistent settings
  function loadSettings() {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.autoLockMinutes !== undefined) {
          autoLockMinutes = parsed.autoLockMinutes;
        }
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        autoLockMinutes
      }));
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }

  loadSettings();

  /**
   * Check if a vault exists
   */
  function isVaultInitialized() {
    return localStorage.getItem(STORAGE_KEY) !== null || localStorage.getItem(OLD_STORAGE_KEY) !== null;
  }

  /**
   * Get raw encrypted payload
   */
  function getRawVaultData() {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(OLD_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Check if biometric unlock is enabled for this vault
   */
  function hasBiometricsEnabled() {
    const data = getRawVaultData();
    return !!(data && data.biometrics && data.biometrics.enabled && data.biometrics.credentialId);
  }

  /**
   * Create a new Vault with Master PIN and optional Biometrics
   */
  async function createVault(pin, enableBiometrics = false) {
    if (!pin || pin.length < 4) {
      throw new Error('Master PIN must be at least 4 digits.');
    }

    // 1. Generate primary random AES-256 Vault Master Key
    const masterKey = await CryptoEngine.generateMasterKey();

    // 2. Derive PIN Key via PBKDF2
    const pinSalt = CryptoEngine.getRandomBytes(CryptoEngine.SALT_BYTE_LENGTH);
    const pinKey = await CryptoEngine.deriveKey(pin, pinSalt);

    // 3. Wrap Master Key with PIN Key
    const pinWrappedKey = await CryptoEngine.wrapKey(masterKey, pinKey);
    const pinAuth = await CryptoEngine.createAuthToken(pinKey);

    // 4. Handle Biometrics (if requested)
    let biometricsData = { enabled: false };
    if (enableBiometrics) {
      try {
        const credId = await CryptoEngine.enrollBiometrics();
        const bioSecret = CryptoEngine.getRandomBytes(32);
        const bioKey = await CryptoEngine.deriveKey(
          CryptoEngine.bufferToBase64(bioSecret.buffer),
          pinSalt
        );
        const bioWrappedKey = await CryptoEngine.wrapKey(masterKey, bioKey);

        biometricsData = {
          enabled: true,
          credentialId: credId,
          bioSecret: CryptoEngine.bufferToBase64(bioSecret.buffer),
          bioWrappedKey: bioWrappedKey
        };
      } catch (err) {
        console.warn('Biometric enrollment skipped or rejected:', err);
      }
    }

    // 5. Initial vault item
    const initialItems = [
      {
        id: crypto.randomUUID(),
        title: 'Welcome to AegisVault',
        category: 'note',
        username: 'secure-user',
        password: CryptoEngine.generatePassword({ length: 20 }),
        url: 'https://github.com',
        notes: 'Your vault is protected by hardware biometrics (Fingerprint / Face ID) backed by your Master PIN. Encryption is client-side AES-256-GCM.',
        favorite: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        history: []
      }
    ];

    // 6. Encrypt items with the Vault Master Key
    const encryptedVault = await CryptoEngine.encrypt(initialItems, masterKey);

    const vaultPayload = {
      version: 2,
      pinSalt: CryptoEngine.bufferToBase64(pinSalt.buffer),
      pinAuth: pinAuth,
      pinWrappedKey: pinWrappedKey,
      biometrics: biometricsData,
      vaultIv: encryptedVault.iv,
      vaultCiphertext: encryptedVault.ciphertext,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultPayload));
    localStorage.removeItem(OLD_STORAGE_KEY);

    // In-memory state
    vaultMasterKey = masterKey;
    decryptedItems = initialItems;
    isUnlocked = true;
    resetAutoLockTimer();

    return { biometricsEnabled: biometricsData.enabled };
  }

  /**
   * Unlock Vault with Master PIN
   */
  async function unlockWithPin(pin) {
    const vaultData = getRawVaultData();
    if (!vaultData) throw new Error('No vault found.');

    // Backward compatibility with v1 if exists
    if (vaultData.version === 1) {
      return unlockV1Legacy(pin);
    }

    const pinSalt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.pinSalt));
    const pinKey = await CryptoEngine.deriveKey(pin, pinSalt);

    // Verify PIN canary
    const isValid = await CryptoEngine.verifyAuthToken(
      vaultData.pinAuth.ciphertext,
      vaultData.pinAuth.iv,
      pinKey
    );

    if (!isValid) {
      throw new Error('Incorrect Master PIN. Please try again.');
    }

    // Unwrap Master Key
    let masterKey;
    try {
      masterKey = await CryptoEngine.unwrapKey(vaultData.pinWrappedKey, pinKey);
    } catch {
      throw new Error('Failed to unwrap encryption key.');
    }

    // Decrypt Vault items
    const items = await CryptoEngine.decrypt(
      vaultData.vaultCiphertext,
      vaultData.vaultIv,
      masterKey
    );

    vaultMasterKey = masterKey;
    decryptedItems = Array.isArray(items) ? items : [];
    isUnlocked = true;
    resetAutoLockTimer();
    return true;
  }

  /**
   * Unlock Vault with Biometrics (Fingerprint / Face ID / Touch ID / Windows Hello)
   */
  async function unlockWithBiometrics() {
    const vaultData = getRawVaultData();
    if (!vaultData || !vaultData.biometrics || !vaultData.biometrics.enabled) {
      throw new Error('Biometric unlock is not enabled on this vault.');
    }

    // Trigger platform biometric verification prompt
    await CryptoEngine.authenticateBiometrics(vaultData.biometrics.credentialId);

    // Unpack biometric secret and unwrap Master Key
    const pinSalt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.pinSalt));
    const bioKey = await CryptoEngine.deriveKey(vaultData.biometrics.bioSecret, pinSalt);

    const masterKey = await CryptoEngine.unwrapKey(
      vaultData.biometrics.bioWrappedKey,
      bioKey
    );

    const items = await CryptoEngine.decrypt(
      vaultData.vaultCiphertext,
      vaultData.vaultIv,
      masterKey
    );

    vaultMasterKey = masterKey;
    decryptedItems = Array.isArray(items) ? items : [];
    isUnlocked = true;
    resetAutoLockTimer();
    return true;
  }

  /**
   * Enable Biometrics while unlocked
   */
  async function enableBiometrics() {
    if (!isUnlocked || !vaultMasterKey) {
      throw new Error('Vault must be unlocked to configure biometrics.');
    }

    const vaultData = getRawVaultData();
    const pinSalt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.pinSalt));

    const credId = await CryptoEngine.enrollBiometrics();
    const bioSecret = CryptoEngine.getRandomBytes(32);
    const bioKey = await CryptoEngine.deriveKey(
      CryptoEngine.bufferToBase64(bioSecret.buffer),
      pinSalt
    );
    const bioWrappedKey = await CryptoEngine.wrapKey(vaultMasterKey, bioKey);

    vaultData.biometrics = {
      enabled: true,
      credentialId: credId,
      bioSecret: CryptoEngine.bufferToBase64(bioSecret.buffer),
      bioWrappedKey: bioWrappedKey
    };
    vaultData.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    resetAutoLockTimer();
    return true;
  }

  /**
   * Disable Biometrics
   */
  function disableBiometrics() {
    if (!isUnlocked) throw new Error('Vault must be unlocked.');
    const vaultData = getRawVaultData();
    if (vaultData) {
      vaultData.biometrics = { enabled: false };
      vaultData.updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    }
  }

  /**
   * Change Master PIN
   */
  async function changePin(currentPin, newPin) {
    if (!isUnlocked || !vaultMasterKey) throw new Error('Vault is locked.');
    if (!newPin || newPin.length < 4) {
      throw new Error('New Master PIN must be at least 4 digits.');
    }

    const vaultData = getRawVaultData();
    const currentSalt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.pinSalt));
    const currentPinKey = await CryptoEngine.deriveKey(currentPin, currentSalt);

    const valid = await CryptoEngine.verifyAuthToken(
      vaultData.pinAuth.ciphertext,
      vaultData.pinAuth.iv,
      currentPinKey
    );
    if (!valid) {
      throw new Error('Current Master PIN is incorrect.');
    }

    // Derive new PIN key
    const newSalt = CryptoEngine.getRandomBytes(CryptoEngine.SALT_BYTE_LENGTH);
    const newPinKey = await CryptoEngine.deriveKey(newPin, newSalt);
    const newPinWrapped = await CryptoEngine.wrapKey(vaultMasterKey, newPinKey);
    const newPinAuth = await CryptoEngine.createAuthToken(newPinKey);

    vaultData.pinSalt = CryptoEngine.bufferToBase64(newSalt.buffer);
    vaultData.pinAuth = newPinAuth;
    vaultData.pinWrappedKey = newPinWrapped;
    vaultData.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    resetAutoLockTimer();
    return true;
  }

  /**
   * Lock Vault
   */
  function lockVault() {
    vaultMasterKey = null;
    decryptedItems = [];
    isUnlocked = false;
    if (autoLockTimeoutId) {
      clearTimeout(autoLockTimeoutId);
      autoLockTimeoutId = null;
    }
    if (typeof onLockCallback === 'function') {
      onLockCallback();
    }
  }

  /**
   * Save items encrypted back to storage
   */
  async function saveVault() {
    if (!isUnlocked || !vaultMasterKey) {
      throw new Error('Vault is locked.');
    }

    const vaultData = getRawVaultData();
    const encryptedVault = await CryptoEngine.encrypt(decryptedItems, vaultMasterKey);
    vaultData.vaultIv = encryptedVault.iv;
    vaultData.vaultCiphertext = encryptedVault.ciphertext;
    vaultData.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
  }

  function resetAutoLockTimer() {
    if (autoLockTimeoutId) {
      clearTimeout(autoLockTimeoutId);
      autoLockTimeoutId = null;
    }
    if (autoLockMinutes > 0 && isUnlocked) {
      autoLockTimeoutId = setTimeout(() => {
        lockVault();
      }, autoLockMinutes * 60 * 1000);
    }
  }

  function getItems() {
    if (!isUnlocked) return [];
    return [...decryptedItems];
  }

  function getItemById(id) {
    if (!isUnlocked) return null;
    return decryptedItems.find(item => item.id === id) || null;
  }

  async function addItem(itemData) {
    if (!isUnlocked) throw new Error('Vault is locked');

    const newItem = {
      id: crypto.randomUUID(),
      title: itemData.title?.trim() || 'Untitled',
      category: itemData.category || 'login',
      username: itemData.username?.trim() || '',
      password: itemData.password || '',
      url: itemData.url?.trim() || '',
      notes: itemData.notes || '',
      favorite: !!itemData.favorite,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      history: []
    };

    decryptedItems.unshift(newItem);
    await saveVault();
    resetAutoLockTimer();
    return newItem;
  }

  async function updateItem(id, updatedFields) {
    if (!isUnlocked) throw new Error('Vault is locked');

    const index = decryptedItems.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found');

    const currentItem = decryptedItems[index];
    const history = currentItem.history ? [...currentItem.history] : [];
    if (updatedFields.password && updatedFields.password !== currentItem.password) {
      history.unshift({
        password: currentItem.password,
        changedAt: new Date().toISOString()
      });
      if (history.length > 5) history.pop();
    }

    const updated = {
      ...currentItem,
      ...updatedFields,
      history,
      updatedAt: new Date().toISOString()
    };

    decryptedItems[index] = updated;
    await saveVault();
    resetAutoLockTimer();
    return updated;
  }

  async function deleteItem(id) {
    if (!isUnlocked) throw new Error('Vault is locked');
    decryptedItems = decryptedItems.filter(item => item.id !== id);
    await saveVault();
    resetAutoLockTimer();
  }

  function exportEncryptedBackup() {
    const rawData = getRawVaultData();
    if (!rawData) throw new Error('No vault data to export');

    const backupObj = {
      app: 'AegisVault',
      exportFormat: 'AES-256-GCM-PIN-BIOMETRIC',
      exportedAt: new Date().toISOString(),
      payload: rawData
    };

    return JSON.stringify(backupObj, null, 2);
  }

  async function importEncryptedBackup(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON backup file.');
    }

    if (!parsed.payload || !parsed.payload.vaultCiphertext) {
      throw new Error('Invalid AegisVault backup structure.');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.payload));
    lockVault();
    return true;
  }

  function destroyVault() {
    lockVault();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(OLD_STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  function getSecurityAudit() {
    if (!isUnlocked) return null;

    const total = decryptedItems.length;
    let weakCount = 0;
    const passwordCounts = {};
    let reusedCount = 0;

    decryptedItems.forEach(item => {
      const pwd = item.password || '';
      const strength = CryptoEngine.evaluateStrength(pwd);
      if (strength.score <= 2) weakCount++;
      if (pwd) passwordCounts[pwd] = (passwordCounts[pwd] || 0) + 1;
    });

    Object.values(passwordCounts).forEach(count => {
      if (count > 1) reusedCount += count;
    });

    let overallScore = 100;
    if (total > 0) {
      const weakPenalty = (weakCount / total) * 50;
      const reusePenalty = (reusedCount / total) * 30;
      overallScore = Math.max(10, Math.round(100 - weakPenalty - reusePenalty));
    }

    return { total, weakCount, reusedCount, overallScore };
  }

  // Helper for backward compatibility
  async function unlockV1Legacy(password) {
    const raw = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    const salt = new Uint8Array(CryptoEngine.base64ToBuffer(raw.salt));
    const key = await CryptoEngine.deriveKey(password, salt);
    const valid = await CryptoEngine.verifyAuthToken(raw.authCiphertext, raw.authIv, key);
    if (!valid) throw new Error('Incorrect Master Password');
    const items = await CryptoEngine.decrypt(raw.vaultCiphertext, raw.vaultIv, key);
    vaultMasterKey = key;
    decryptedItems = Array.isArray(items) ? items : [];
    isUnlocked = true;
    resetAutoLockTimer();
    return true;
  }

  return {
    isVaultInitialized,
    hasBiometricsEnabled,
    createVault,
    unlockWithPin,
    unlockWithBiometrics,
    enableBiometrics,
    disableBiometrics,
    changePin,
    lockVault,
    get isUnlocked() { return isUnlocked; },
    getItems,
    getItemById,
    addItem,
    updateItem,
    deleteItem,
    exportEncryptedBackup,
    importEncryptedBackup,
    destroyVault,
    getSecurityAudit,
    resetAutoLockTimer,
    get autoLockMinutes() { return autoLockMinutes; },
    set autoLockMinutes(val) {
      autoLockMinutes = parseInt(val, 10);
      saveSettings();
      resetAutoLockTimer();
    },
    setOnLock(cb) {
      onLockCallback = cb;
    }
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VaultManager;
}
