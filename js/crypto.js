/**
 * AegisVault - Cryptographic Engine
 * Zero-Knowledge Client-Side Encryption using Native Web Crypto API
 * - PBKDF2 (SHA-256, 300,000 iterations) for Key Derivation
 * - AES-256-GCM for Authenticated Encryption
 * - Cryptographically Secure Random Password Generation
 */

const CryptoEngine = (() => {
  const PBKDF2_ITERATIONS = 300000;
  const SALT_BYTE_LENGTH = 16;
  const IV_BYTE_LENGTH = 12; // 96-bit recommended for AES-GCM
  const KEY_ALGORITHM = 'AES-GCM';
  const KEY_LENGTH = 256;

  // Utility: Convert ArrayBuffer to Base64
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Utility: Convert Base64 to ArrayBuffer
  function base64ToBuffer(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Utility: Convert String to ArrayBuffer (UTF-8)
  function strToBuffer(str) {
    return new TextEncoder().encode(str);
  }

  // Utility: Convert ArrayBuffer to String (UTF-8)
  function bufferToStr(buffer) {
    return new TextDecoder().decode(buffer);
  }

  // Generate cryptographically secure random bytes
  function getRandomBytes(length) {
    const bytes = new Uint8Array(length);
    window.crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Derive an AES-256-GCM CryptoKey from a Master Password and Salt
   * @param {string} masterPassword 
   * @param {Uint8Array} salt 
   * @returns {Promise<CryptoKey>}
   */
  async function deriveKey(masterPassword, salt) {
    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      strToBuffer(masterPassword),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: KEY_ALGORITHM,
        length: KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt a JavaScript object / string with AES-256-GCM
   * @param {any} data 
   * @param {CryptoKey} key 
   * @returns {Promise<{iv: string, ciphertext: string}>}
   */
  async function encrypt(data, key) {
    const iv = getRandomBytes(IV_BYTE_LENGTH);
    const encodedData = strToBuffer(typeof data === 'string' ? data : JSON.stringify(data));

    const encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: KEY_ALGORITHM,
        iv: iv
      },
      key,
      encodedData
    );

    return {
      iv: bufferToBase64(iv.buffer),
      ciphertext: bufferToBase64(encryptedBuffer)
    };
  }

  /**
   * Decrypt AES-256-GCM ciphertext
   * @param {string} ciphertextBase64 
   * @param {string} ivBase64 
   * @param {CryptoKey} key 
   * @returns {Promise<any>} Parsed JSON or string
   */
  async function decrypt(ciphertextBase64, ivBase64, key) {
    const iv = base64ToBuffer(ivBase64);
    const ciphertext = base64ToBuffer(ciphertextBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: KEY_ALGORITHM,
        iv: new Uint8Array(iv)
      },
      key,
      ciphertext
    );

    const str = bufferToStr(decryptedBuffer);
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  /**
   * Generate an encrypted canary token to quickly verify master password correctness
   * @param {CryptoKey} key 
   * @returns {Promise<{iv: string, ciphertext: string}>}
   */
  async function createAuthToken(key) {
    return encrypt('AEGIS_CANARY_VALID', key);
  }

  /**
   * Verify master password using the canary token
   * @param {string} ciphertextBase64 
   * @param {string} ivBase64 
   * @param {CryptoKey} key 
   * @returns {Promise<boolean>}
   */
  async function verifyAuthToken(ciphertextBase64, ivBase64, key) {
    try {
      const result = await decrypt(ciphertextBase64, ivBase64, key);
      return result === 'AEGIS_CANARY_VALID';
    } catch {
      return false;
    }
  }

  /**
   * Cryptographically secure password generator
   * @param {object} options
   */
  function generatePassword(options = {}) {
    const {
      length = 16,
      uppercase = true,
      lowercase = true,
      numbers = true,
      symbols = true,
      avoidAmbiguous = true
    } = options;

    let charPool = '';
    const upperChars = avoidAmbiguous ? 'ABCDEFGHJKLMNPQRSTUVWXYZ' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerChars = avoidAmbiguous ? 'abcdefghijkmnopqrstuvwxyz' : 'abcdefghijklmnopqrstuvwxyz';
    const numberChars = avoidAmbiguous ? '23456789' : '0123456789';
    const symbolChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    const guaranteed = [];

    if (uppercase) {
      charPool += upperChars;
      guaranteed.push(upperChars[getRandomInt(0, upperChars.length - 1)]);
    }
    if (lowercase) {
      charPool += lowerChars;
      guaranteed.push(lowerChars[getRandomInt(0, lowerChars.length - 1)]);
    }
    if (numbers) {
      charPool += numberChars;
      guaranteed.push(numberChars[getRandomInt(0, numberChars.length - 1)]);
    }
    if (symbols) {
      charPool += symbolChars;
      guaranteed.push(symbolChars[getRandomInt(0, symbolChars.length - 1)]);
    }

    if (!charPool) {
      charPool = lowerChars + numberChars;
    }

    const passwordArr = [...guaranteed];
    const remaining = length - guaranteed.length;

    for (let i = 0; i < remaining; i++) {
      passwordArr.push(charPool[getRandomInt(0, charPool.length - 1)]);
    }

    // Shuffle array using Fisher-Yates with crypto random values
    for (let i = passwordArr.length - 1; i > 0; i--) {
      const j = getRandomInt(0, i);
      [passwordArr[i], passwordArr[j]] = [passwordArr[j], passwordArr[i]];
    }

    return passwordArr.join('');
  }

  function getRandomInt(min, max) {
    const range = max - min + 1;
    const maxRange = 256;
    const limit = maxRange - (maxRange % range);
    let randomByte;
    do {
      randomByte = getRandomBytes(1)[0];
    } while (randomByte >= limit);
    return min + (randomByte % range);
  }

  /**
   * Password strength calculation and entropy evaluation
   * @param {string} password 
   * @returns {object} { score, label, color, entropyBits, crackTime }
   */
  function evaluateStrength(password) {
    if (!password) {
      return { score: 0, label: 'Empty', color: '#64748b', entropyBits: 0, crackTime: 'Instant' };
    }

    let poolSize = 0;
    if (/[a-z]/.test(password)) poolSize += 26;
    if (/[A-Z]/.test(password)) poolSize += 26;
    if (/[0-9]/.test(password)) poolSize += 10;
    if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

    const entropyBits = Math.round(password.length * Math.log2(poolSize || 1));

    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (password.length >= 16) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password) && /[^a-zA-Z0-9]/.test(password)) score++;

    let label = 'Very Weak';
    let color = '#ef4444';
    let crackTime = 'A few seconds';

    if (entropyBits >= 80) {
      label = 'Military Grade';
      color = '#10b981';
      crackTime = 'Centuries';
    } else if (entropyBits >= 60) {
      label = 'Very Strong';
      color = '#06b6d4';
      crackTime = 'Decades';
    } else if (entropyBits >= 45) {
      label = 'Strong';
      color = '#3b82f6';
      crackTime = 'Years';
    } else if (entropyBits >= 30) {
      label = 'Moderate';
      color = '#f59e0b';
      crackTime = 'A few days';
    } else {
      label = 'Weak';
      color = '#ef4444';
      crackTime = 'Instant / Hours';
    }

    return {
      score: Math.min(score, 5),
      label,
      color,
      entropyBits,
      crackTime
    };
  }

  /**
   * Generate a random AES-256-GCM Vault Master Key
   * @returns {Promise<CryptoKey>}
   */
  async function generateMasterKey() {
    return window.crypto.subtle.generateKey(
      {
        name: KEY_ALGORITHM,
        length: KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Export CryptoKey as Base64 raw bytes
   * @param {CryptoKey} key 
   * @returns {Promise<string>}
   */
  async function exportKeyRaw(key) {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return bufferToBase64(raw);
  }

  /**
   * Import CryptoKey from Base64 raw bytes
   * @param {string} base64Str 
   * @returns {Promise<CryptoKey>}
   */
  async function importKeyRaw(base64Str) {
    const buffer = base64ToBuffer(base64Str);
    return window.crypto.subtle.importKey(
      'raw',
      buffer,
      {
        name: KEY_ALGORITHM,
        length: KEY_LENGTH
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Wrap (encrypt) a CryptoKey using another CryptoKey
   * @param {CryptoKey} targetKey 
   * @param {CryptoKey} wrappingKey 
   * @returns {Promise<{iv: string, ciphertext: string}>}
   */
  async function wrapKey(targetKey, wrappingKey) {
    const rawBase64 = await exportKeyRaw(targetKey);
    return encrypt(rawBase64, wrappingKey);
  }

  /**
   * Unwrap (decrypt) a CryptoKey using a wrapping CryptoKey
   * @param {{iv: string, ciphertext: string}} wrapped 
   * @param {CryptoKey} wrappingKey 
   * @returns {Promise<CryptoKey>}
   */
  async function unwrapKey(wrapped, wrappingKey) {
    const rawBase64 = await decrypt(wrapped.ciphertext, wrapped.iv, wrappingKey);
    return importKeyRaw(rawBase64);
  }

  /**
   * WebAuthn Biometric Support Checker
   */
  async function isBiometricsSupported() {
    try {
      if (!window.PublicKeyCredential) return false;
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
        return false;
      }
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  /**
   * Enroll Biometrics via WebAuthn Platform Authenticator
   * (Touch ID, Face ID, Android Fingerprint, Windows Hello)
   */
  async function enrollBiometrics(userId = 'vault-owner', userName = 'Vault Owner') {
    if (!window.PublicKeyCredential) {
      throw new Error('WebAuthn / Biometrics not supported on this browser.');
    }

    const challenge = getRandomBytes(32);
    const userHandle = strToBuffer(userId);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: challenge,
        rp: {
          name: 'AegisVault',
          id: window.location.hostname || 'localhost'
        },
        user: {
          id: userHandle,
          name: userName,
          displayName: userName
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256
          { alg: -257, type: 'public-key' }  // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          requireResidentKey: false
        },
        timeout: 60000
      }
    });

    if (!credential) {
      throw new Error('Biometric registration was canceled or rejected.');
    }

    return bufferToBase64(credential.rawId);
  }

  /**
   * Authenticate via Biometrics
   */
  async function authenticateBiometrics(credentialIdBase64) {
    if (!window.PublicKeyCredential) {
      throw new Error('Biometrics not supported.');
    }

    const challenge = getRandomBytes(32);
    const allowCredentials = credentialIdBase64 ? [
      {
        id: base64ToBuffer(credentialIdBase64),
        type: 'public-key'
      }
    ] : [];

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: challenge,
        rpId: window.location.hostname || 'localhost',
        userVerification: 'required',
        allowCredentials: allowCredentials,
        timeout: 60000
      }
    });

    if (!assertion) {
      throw new Error('Biometric authentication failed.');
    }

    return true;
  }

  return {
    SALT_BYTE_LENGTH,
    getRandomBytes,
    bufferToBase64,
    base64ToBuffer,
    deriveKey,
    encrypt,
    decrypt,
    createAuthToken,
    verifyAuthToken,
    generatePassword,
    evaluateStrength,
    generateMasterKey,
    exportKeyRaw,
    importKeyRaw,
    wrapKey,
    unwrapKey,
    isBiometricsSupported,
    enrollBiometrics,
    authenticateBiometrics
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CryptoEngine;
}
