# 🛡️ AegisVault — Zero-Knowledge Mobile Password Vault (PWA)

A sleek, fast, and cryptographically fortified mobile password manager designed to run directly on your smartphone as an installable Progressive Web App (PWA) or in any browser.

Built with **Zero-Knowledge Architecture** using the native **Web Crypto API**: your master password and vault credentials never touch any external server or network.

---

## 🔒 Security & Cryptographic Specifications

- **Key Derivation Function (KDF):** `PBKDF2` with `HMAC-SHA256` using **300,000 iterations** (compliant with OWASP recommendations) and a cryptographically secure random 16-byte salt (`window.crypto.getRandomValues`).
- **Authenticated Encryption:** `AES-256-GCM` (Galois/Counter Mode) with unique 12-byte (96-bit) initialization vectors (IV) for every encryption operation. Decryption provides automatic tamper detection (authenticated ciphertext integrity).
- **Zero-Knowledge Principle:** Plaintext passwords are only decrypted into memory during an active session and wiped completely when locked. No backend, no telemetry, no leaks.
- **Auto-Lock Security:** Configurable inactivity timer (1m, 5m, 15m, 30m) automatically wipes keys from memory and locks the UI.
- **Clipboard Hygiene:** Passwords copied to your clipboard are automatically purged after 30 seconds to prevent background app snooping.
- **Encrypted Portability:** Export and import tamper-resistant `.vault` encrypted JSON backups protected with your master password.

---

## 📱 Features

1. **Mobile-First Experience**: Designed specifically for iPhone and Android touchscreens with safe-area notch awareness, bottom navigation, and smooth sheet modals.
2. **Offline-First PWA**: Service Worker caching allows the app to work 100% offline without internet.
3. **Password Health & Audit**: Real-time entropy evaluation, crack time estimation, and detection of weak or duplicated credentials.
4. **Custom Password Generator**: High-entropy password generator with length options, character-set toggles, and ambiguous-character filtering.
5. **Categorized Organization**: Logins, Payment Cards, Encrypted Notes, Wi-Fi keys, and Identity records with fast fuzzy search and favorites.

---

## 🚀 How to Run & Install on Your Phone

### Option A: Run Locally & Access from Your Phone (Local Wi-Fi)

1. Open PowerShell / Terminal in this project directory:
   ```bash
   npx serve -s . -l 3000
   ```
   *(or using Python: `python -m http.server 3000`)*

2. Find your PC's local IP address on Wi-Fi (e.g. run `ipconfig` on Windows, look for `IPv4 Address`, e.g., `192.168.1.5`).
3. On your phone connected to the same Wi-Fi, open your browser and navigate to:
   ```
   http://YOUR_PC_IP:3000
   ```

### Option B: Install Directly to Mobile Home Screen

- **iOS (iPhone / iPad)**:
  1. Open the app in **Safari**.
  2. Tap the **Share** button (box with upward arrow) at the bottom.
  3. Scroll down and tap **Add to Home Screen**.
  4. AegisVault will now launch as a standalone, fullscreen native-style app with its own icon!

- **Android (Chrome)**:
  1. Open the app in **Chrome**.
  2. Tap the three dots menu (⋮) in the top-right corner.
  3. Tap **Add to Home screen** (or **Install app**).
  4. The app installs directly to your app drawer and home screen.

---

## 💻 Tech Stack

- **Core**: Vanilla HTML5, Vanilla JavaScript (ES6+ Modules)
- **Styling**: Vanilla CSS3 (Obsidian & Cyber-cyan dark theme, Glassmorphism, CSS Custom Properties)
- **Cryptography**: Native Web Crypto API (`window.crypto.subtle`)
- **PWA**: Service Worker (`sw.js`), Web App Manifest (`manifest.json`)
