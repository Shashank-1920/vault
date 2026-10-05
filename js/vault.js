/**
 * AegisVault - Vault Data & State Manager
 * Handles zero-knowledge storage, in-memory lifecycle, and auto-lock security
 */

const VaultManager = (() => {
  const STORAGE_KEY = 'aegis_vault_data_v1';
  const SETTINGS_KEY = 'aegis_vault_settings_v1';

  let cryptoKey = null;
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
   * Check if a vault already exists on this device
   */
  function isVaultInitialized() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Get raw encrypted payload from local storage
   */
  function getRawVaultData() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  }

  /**
   * Create a new Vault with Master Password
   */
  async function createVault(masterPassword) {
    if (!masterPassword || masterPassword.length < 8) {
      throw new Error('Master password must be at least 8 characters long.');
    }

    const salt = CryptoEngine.getRandomBytes(CryptoEngine.SALT_BYTE_LENGTH);
    const key = await CryptoEngine.deriveKey(masterPassword, salt);
    const authCanary = await CryptoEngine.createAuthToken(key);

    const initialItems = [
      {
        id: crypto.randomUUID(),
        title: 'Welcome to AegisVault',
        category: 'note',
        username: 'secure-user',
        password: CryptoEngine.generatePassword({ length: 20 }),
        url: 'https://github.com',
        notes: 'Welcome! Your vault is protected by client-side AES-256-GCM encryption with 300,000 PBKDF2 iterations. Passwords never leave your device in plaintext.',
        favorite: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const encryptedVault = await CryptoEngine.encrypt(initialItems, key);

    const vaultPayload = {
      version: 1,
      salt: CryptoEngine.bufferToBase64(salt.buffer),
      authIv: authCanary.iv,
      authCiphertext: authCanary.ciphertext,
      vaultIv: encryptedVault.iv,
      vaultCiphertext: encryptedVault.ciphertext,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultPayload));

    // Set state
    cryptoKey = key;
    decryptedItems = initialItems;
    isUnlocked = true;
    resetAutoLockTimer();

    return true;
  }

  /**
   * Unlock an existing vault with master password
   */
  async function unlockVault(masterPassword) {
    const vaultData = getRawVaultData();
    if (!vaultData) {
      throw new Error('No vault found on this device.');
    }

    const salt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.salt));
    const key = await CryptoEngine.deriveKey(masterPassword, salt);

    // Verify auth canary
    const isValid = await CryptoEngine.verifyAuthToken(
      vaultData.authCiphertext,
      vaultData.authIv,
      key
    );

    if (!isValid) {
      throw new Error('Incorrect Master Password. Please verify and try again.');
    }

    // Decrypt items
    try {
      const items = await CryptoEngine.decrypt(
        vaultData.vaultCiphertext,
        vaultData.vaultIv,
        key
      );
      decryptedItems = Array.isArray(items) ? items : [];
    } catch (e) {
      throw new Error('Vault decryption failed. Integrity check mismatch.');
    }

    cryptoKey = key;
    isUnlocked = true;
    resetAutoLockTimer();
    return true;
  }

  /**
   * Lock the vault and wipe keys from memory
   */
  function lockVault() {
    cryptoKey = null;
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
   * Reset the auto-lock countdown timer on user activity
   */
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

  /**
   * Save items encrypted back to storage
   */
  async function saveVault() {
    if (!isUnlocked || !cryptoKey) {
      throw new Error('Vault is locked. Cannot save modifications.');
    }

    const vaultData = getRawVaultData();
    if (!vaultData) {
      throw new Error('Vault data missing from storage.');
    }

    const encryptedVault = await CryptoEngine.encrypt(decryptedItems, cryptoKey);
    vaultData.vaultIv = encryptedVault.iv;
    vaultData.vaultCiphertext = encryptedVault.ciphertext;
    vaultData.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
  }

  /**
   * Get all decrypted items
   */
  function getItems() {
    if (!isUnlocked) return [];
    return [...decryptedItems];
  }

  /**
   * Get item by id
   */
  function getItemById(id) {
    if (!isUnlocked) return null;
    return decryptedItems.find(item => item.id === id) || null;
  }

  /**
   * Add a new item to the vault
   */
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

  /**
   * Update existing item
   */
  async function updateItem(id, updatedFields) {
    if (!isUnlocked) throw new Error('Vault is locked');

    const index = decryptedItems.findIndex(i => i.id === id);
    if (index === -1) throw new Error('Item not found');

    const currentItem = decryptedItems[index];

    // If password changed, push to history
    const history = currentItem.history ? [...currentItem.history] : [];
    if (updatedFields.password && updatedFields.password !== currentItem.password) {
      history.unshift({
        password: currentItem.password,
        changedAt: new Date().toISOString()
      });
      // Keep last 5 password histories
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

  /**
   * Delete item from vault
   */
  async function deleteItem(id) {
    if (!isUnlocked) throw new Error('Vault is locked');
    decryptedItems = decryptedItems.filter(item => item.id !== id);
    await saveVault();
    resetAutoLockTimer();
  }

  /**
   * Change Master Password
   */
  async function changeMasterPassword(currentPassword, newPassword) {
    if (!isUnlocked) throw new Error('Vault is locked');
    if (!newPassword || newPassword.length < 8) {
      throw new Error('New master password must be at least 8 characters long.');
    }

    // Verify current master password
    const vaultData = getRawVaultData();
    const currentSalt = new Uint8Array(CryptoEngine.base64ToBuffer(vaultData.salt));
    const testKey = await CryptoEngine.deriveKey(currentPassword, currentSalt);
    const valid = await CryptoEngine.verifyAuthToken(vaultData.authCiphertext, vaultData.authIv, testKey);

    if (!valid) {
      throw new Error('Current master password is incorrect.');
    }

    // Generate new salt and derive new key
    const newSalt = CryptoEngine.getRandomBytes(CryptoEngine.SALT_BYTE_LENGTH);
    const newKey = await CryptoEngine.deriveKey(newPassword, newSalt);
    const newAuthCanary = await CryptoEngine.createAuthToken(newKey);
    const newEncryptedVault = await CryptoEngine.encrypt(decryptedItems, newKey);

    vaultData.salt = CryptoEngine.bufferToBase64(newSalt.buffer);
    vaultData.authIv = newAuthCanary.iv;
    vaultData.authCiphertext = newAuthCanary.ciphertext;
    vaultData.vaultIv = newEncryptedVault.iv;
    vaultData.vaultCiphertext = newEncryptedVault.ciphertext;
    vaultData.updatedAt = new Date().toISOString();

    localStorage.setItem(STORAGE_KEY, JSON.stringify(vaultData));
    cryptoKey = newKey;
    resetAutoLockTimer();
    return true;
  }

  /**
   * Export encrypted vault backup file
   */
  function exportEncryptedBackup() {
    const rawData = getRawVaultData();
    if (!rawData) throw new Error('No vault data to export');

    const backupObj = {
      app: 'AegisVault',
      exportFormat: 'AES-256-GCM-ENCRYPTED',
      exportedAt: new Date().toISOString(),
      payload: rawData
    };

    return JSON.stringify(backupObj, null, 2);
  }

  /**
   * Import vault backup (replace or merge)
   */
  async function importEncryptedBackup(jsonString) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      throw new Error('Invalid JSON backup file.');
    }

    if (!parsed.payload || !parsed.payload.salt || !parsed.payload.vaultCiphertext) {
      throw new Error('Invalid AegisVault backup structure.');
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed.payload));
    lockVault();
    return true;
  }

  /**
   * Permanent vault destruction / wipe
   */
  function destroyVault() {
    lockVault();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SETTINGS_KEY);
  }

  /**
   * Security Audit: find weak, reused, or compromised passwords
   */
  function getSecurityAudit() {
    if (!isUnlocked) return null;

    const total = decryptedItems.length;
    let weakCount = 0;
    const passwordCounts = {};
    let reusedCount = 0;

    decryptedItems.forEach(item => {
      const pwd = item.password || '';
      const strength = CryptoEngine.evaluateStrength(pwd);
      if (strength.score <= 2) {
        weakCount++;
      }
      if (pwd) {
        passwordCounts[pwd] = (passwordCounts[pwd] || 0) + 1;
      }
    });

    Object.values(passwordCounts).forEach(count => {
      if (count > 1) {
        reusedCount += count;
      }
    });

    let overallScore = 100;
    if (total > 0) {
      const weakPenalty = (weakCount / total) * 50;
      const reusePenalty = (reusedCount / total) * 30;
      overallScore = Math.max(10, Math.round(100 - weakPenalty - reusePenalty));
    }

    return {
      total,
      weakCount,
      reusedCount,
      overallScore
    };
  }

  return {
    isVaultInitialized,
    createVault,
    unlockVault,
    lockVault,
    get isUnlocked() { return isUnlocked; },
    getItems,
    getItemById,
    addItem,
    updateItem,
    deleteItem,
    changeMasterPassword,
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
