/**
 * AegisVault - Mobile App Controller
 * Event orchestration, UI interactions, clipboard hygiene, and tab navigation
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM View Elements
  const viewSetup = document.getElementById('view-setup');
  const viewUnlock = document.getElementById('view-unlock');
  const viewMain = document.getElementById('view-main');
  const toastContainer = document.getElementById('toast-container');

  // Forms & Auth (Master PIN & Biometrics)
  const formSetup = document.getElementById('form-setup');
  const setupPinInput = document.getElementById('setup-pin');
  const setupPinConfirmInput = document.getElementById('setup-pin-confirm');
  const setupEnableBiometrics = document.getElementById('setup-enable-biometrics');
  const bioSetupCard = document.getElementById('bio-setup-card');

  const formUnlock = document.getElementById('form-unlock');
  const unlockPinInput = document.getElementById('unlock-pin');
  const unlockError = document.getElementById('unlock-error');
  const unlockBiometricSection = document.getElementById('unlock-biometric-section');
  const btnTriggerBiometricUnlock = document.getElementById('btn-trigger-biometric-unlock');
  const btnEmergencyReset = document.getElementById('btn-emergency-reset');
  const btnQuickLock = document.getElementById('btn-quick-lock');

  // Search & Filters
  const vaultSearch = document.getElementById('vault-search');
  const clearSearchBtn = document.getElementById('clear-search');
  const categoryFilters = document.getElementById('category-filters');
  const itemsList = document.getElementById('items-list');
  const emptyState = document.getElementById('empty-state');
  const btnEmptyAdd = document.getElementById('btn-empty-add');

  // Modals
  const modalItem = document.getElementById('modal-item');
  const formItem = document.getElementById('form-item');
  const modalItemTitle = document.getElementById('modal-item-title');
  const itemIdInput = document.getElementById('item-id');
  const itemCategorySelect = document.getElementById('item-category');
  const itemTitleInput = document.getElementById('item-title');
  const itemUsernameInput = document.getElementById('item-username');
  const itemPasswordInput = document.getElementById('item-password');
  const itemUrlInput = document.getElementById('item-url');
  const itemNotesInput = document.getElementById('item-notes');
  const itemFavoriteInput = document.getElementById('item-favorite');
  const btnCloseItemModal = document.getElementById('btn-close-item-modal');
  const btnCancelItem = document.getElementById('btn-cancel-item');
  const btnQuickGenFill = document.getElementById('btn-quick-gen-fill');
  const itemStrengthBar = document.querySelector('#item-strength-meter .meter-fill');
  const itemStrengthText = document.querySelector('#item-strength-meter .strength-text');
  const itemStrengthEntropy = document.querySelector('#item-strength-meter .strength-entropy');

  // View Item Modal
  const modalViewItem = document.getElementById('modal-view-item');
  const btnCloseViewModal = document.getElementById('btn-close-view-modal');
  const viewMetaCategory = document.getElementById('view-meta-category');
  const viewTitle = document.getElementById('view-title');
  const viewUsername = document.getElementById('view-username');
  const viewPassword = document.getElementById('view-password');
  const viewUrl = document.getElementById('view-url');
  const viewNotes = document.getElementById('view-notes');
  const viewCreatedAt = document.getElementById('view-created-at');
  const viewUpdatedAt = document.getElementById('view-updated-at');
  const btnViewTogglePw = document.getElementById('btn-view-toggle-pw');
  const btnViewToggleFav = document.getElementById('btn-view-toggle-fav');
  const btnCopyUsername = document.getElementById('btn-copy-username');
  const btnCopyPassword = document.getElementById('btn-copy-password');
  const btnCopyUrl = document.getElementById('btn-copy-url');
  const btnEditItem = document.getElementById('btn-edit-item');
  const btnDeleteItem = document.getElementById('btn-delete-item');
  const viewStrengthBar = document.querySelector('#view-strength-meter .meter-fill');
  const viewStrengthLabel = document.getElementById('view-strength-label');
  const viewCrackTime = document.getElementById('view-crack-time');

  // Generator Tab
  const genOutput = document.getElementById('gen-output');
  const btnCopyGen = document.getElementById('btn-copy-gen');
  const btnRefreshGen = document.getElementById('btn-refresh-gen');
  const genLengthSlider = document.getElementById('gen-length');
  const genLengthVal = document.getElementById('gen-length-val');
  const genUpper = document.getElementById('gen-upper');
  const genLower = document.getElementById('gen-lower');
  const genNumbers = document.getElementById('gen-numbers');
  const genSymbols = document.getElementById('gen-symbols');
  const genAvoidAmbiguous = document.getElementById('gen-avoid-ambiguous');
  const genStrengthBar = document.querySelector('#gen-strength-meter .meter-fill');
  const genStrengthText = document.getElementById('gen-strength-text');
  const genEntropyText = document.getElementById('gen-entropy-text');

  // Settings & Change PIN Modal
  const settingAutolock = document.getElementById('setting-autolock');
  const settingBiometricsToggle = document.getElementById('setting-biometrics-toggle');
  const btnOpenChangePin = document.getElementById('btn-open-change-pin');
  const modalChangePin = document.getElementById('modal-change-pin');
  const formChangePin = document.getElementById('form-change-pin');
  const btnCloseChangePin = document.getElementById('btn-close-change-pin');
  const btnCancelChangePin = document.getElementById('btn-cancel-change-pin');
  const changeCurrentPin = document.getElementById('change-current-pin');
  const changeNewPin = document.getElementById('change-new-pin');
  const changeConfirmPin = document.getElementById('change-confirm-pin');

  const btnExportVault = document.getElementById('btn-export-vault');
  const btnImportVault = document.getElementById('btn-import-vault');
  const btnUnlockImport = document.getElementById('btn-unlock-import');
  const btnImportFirstTime = document.getElementById('btn-import-first-time');
  const fileImportInput = document.getElementById('file-import-input');
  const btnDestroyVault = document.getElementById('btn-destroy-vault');

  // Bottom Navigation
  const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item[data-tab]');
  const btnFloatingAdd = document.getElementById('btn-floating-add');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const btnViewAudit = document.getElementById('btn-view-audit');

  // State Variables
  let currentActiveCategory = 'all';
  let currentSearchQuery = '';
  let viewingItemId = null;
  let isViewingPasswordRevealed = false;
  let clipboardClearTimer = null;

  // Category Icons & Display Names
  const CATEGORY_MAP = {
    login: { icon: '🔑', label: 'Login' },
    card: { icon: '💳', label: 'Card' },
    note: { icon: '📝', label: 'Note' },
    wifi: { icon: '📶', label: 'Wi-Fi' },
    id: { icon: '🪪', label: 'Identity' }
  };

  /* ==================== INITIALIZATION ==================== */
  async function initApp() {
    VaultManager.setOnLock(() => {
      showUnlockView();
      showToast('Vault locked automatically', 'info');
    });

    // Check device biometric support
    const bioAvailable = await CryptoEngine.isBiometricsSupported();
    if (!bioAvailable && bioSetupCard) {
      bioSetupCard.style.opacity = '0.5';
      const desc = bioSetupCard.querySelector('.bio-setup-desc');
      if (desc) desc.textContent = 'Biometrics not available on this connection/browser (requires HTTPS or localhost).';
      if (setupEnableBiometrics) setupEnableBiometrics.checked = false;
    }

    if (VaultManager.isVaultInitialized()) {
      showUnlockView();
    } else {
      showSetupView();
    }

    // Attach user activity listeners to reset auto-lock
    ['mousedown', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
      window.addEventListener(evt, () => {
        if (VaultManager.isUnlocked) {
          VaultManager.resetAutoLockTimer();
        }
      }, { passive: true });
    });

    // Populate initial generator state
    updateGenerator();

    // Populate initial settings
    if (settingAutolock) {
      settingAutolock.value = VaultManager.autoLockMinutes.toString();
    }
    if (settingBiometricsToggle) {
      settingBiometricsToggle.checked = VaultManager.hasBiometricsEnabled();
    }
  }

  /* ==================== VIEW SWITCHING ==================== */
  function showSetupView() {
    viewSetup.classList.remove('hidden');
    viewUnlock.classList.add('hidden');
    viewMain.classList.add('hidden');
    if (setupPinInput) setupPinInput.value = '';
    if (setupPinConfirmInput) setupPinConfirmInput.value = '';
  }

  function showUnlockView() {
    viewSetup.classList.add('hidden');
    viewUnlock.classList.remove('hidden');
    viewMain.classList.add('hidden');
    if (unlockPinInput) unlockPinInput.value = '';
    unlockError.classList.add('hidden');
    unlockError.textContent = '';
    closeAllModals();

    const hasBio = VaultManager.hasBiometricsEnabled();
    if (unlockBiometricSection) {
      unlockBiometricSection.classList.toggle('hidden', !hasBio);
    }

    setTimeout(() => {
      if (!hasBio && unlockPinInput) {
        unlockPinInput.focus();
      }
    }, 150);
  }

  function showMainView() {
    viewSetup.classList.add('hidden');
    viewUnlock.classList.add('hidden');
    viewMain.classList.remove('hidden');
    switchTab('tab-vault');
    renderVaultItems();
    updateSecurityBanner();
  }

  function switchTab(tabId) {
    tabPanes.forEach(pane => {
      pane.classList.toggle('hidden', pane.id !== tabId);
      pane.classList.toggle('active', pane.id === tabId);
    });

    bottomNavItems.forEach(item => {
      const active = item.getAttribute('data-tab') === tabId;
      item.classList.toggle('active', active);
    });

    if (tabId === 'tab-audit') {
      renderSecurityAudit();
    } else if (tabId === 'tab-vault') {
      renderVaultItems();
    }
  }

  /* ==================== TOAST NOTIFICATIONS & HAPTICS ==================== */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    if (navigator.vibrate) {
      navigator.vibrate(type === 'error' ? [50, 50, 50] : [30]);
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function copyToClipboard(text, description = 'Item') {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${description} copied to clipboard (auto-clears in 30s)`, 'success');

      // Clipboard auto-clear security feature
      if (clipboardClearTimer) clearTimeout(clipboardClearTimer);
      clipboardClearTimer = setTimeout(() => {
        navigator.clipboard.readText().then(current => {
          if (current === text) {
            navigator.clipboard.writeText('');
            showToast('Clipboard cleared for security', 'info');
          }
        }).catch(() => {});
      }, 30000);
    }).catch(err => {
      console.error('Clipboard copy failed:', err);
      showToast('Could not copy to clipboard', 'error');
    });
  }

  /* ==================== PASSWORD STRENGTH EVALUATOR UI ==================== */
  function updateStrengthDisplay(password, barEl, textEl, entropyEl) {
    if (!password) {
      if (barEl) { barEl.style.width = '0%'; barEl.style.backgroundColor = '#64748b'; }
      if (textEl) textEl.textContent = 'Enter password';
      if (entropyEl) entropyEl.textContent = '0 bits entropy';
      return;
    }

    const { score, label, color, entropyBits, crackTime } = CryptoEngine.evaluateStrength(password);
    const percent = Math.min(100, Math.max(15, (entropyBits / 90) * 100));

    if (barEl) {
      barEl.style.width = `${percent}%`;
      barEl.style.backgroundColor = color;
    }
    if (textEl) {
      textEl.textContent = label;
      textEl.style.color = color;
    }
    if (entropyEl) {
      entropyEl.textContent = `${entropyBits} bits (~${crackTime})`;
    }
  }

  /* ==================== AUTH LISTENERS (PIN & BIOMETRIC) ==================== */
  formSetup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = setupPinInput.value;
    const confirm = setupPinConfirmInput.value;

    if (pin !== confirm) {
      showToast('Master PINs do not match!', 'error');
      return;
    }

    if (pin.length < 4) {
      showToast('Master PIN must be at least 4 digits.', 'error');
      return;
    }

    const enableBio = setupEnableBiometrics && setupEnableBiometrics.checked;
    const submitBtn = document.getElementById('btn-create-vault');
    setButtonLoading(submitBtn, true);

    try {
      const result = await VaultManager.createVault(pin, enableBio);
      showToast(
        result.biometricsEnabled 
          ? 'Vault initialized with Hardware Biometrics & PIN!' 
          : 'Vault initialized with Master PIN!', 
        'success'
      );
      showMainView();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Biometric Unlock Action
  if (btnTriggerBiometricUnlock) {
    btnTriggerBiometricUnlock.addEventListener('click', async () => {
      unlockError.classList.add('hidden');
      try {
        await VaultManager.unlockWithBiometrics();
        showToast('Unlocked with Biometrics', 'success');
        showMainView();
      } catch (err) {
        console.warn('Biometric unlock issue:', err);
        unlockError.textContent = 'Biometric scan canceled or failed. Enter your Master PIN below.';
        unlockError.classList.remove('hidden');
        if (unlockPinInput) unlockPinInput.focus();
      }
    });
  }

  // Master PIN Unlock Action
  formUnlock.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pin = unlockPinInput.value;
    const submitBtn = document.getElementById('btn-unlock-vault');
    unlockError.classList.add('hidden');
    setButtonLoading(submitBtn, true);

    try {
      await VaultManager.unlockWithPin(pin);
      showToast('Vault unlocked', 'success');
      showMainView();
    } catch (err) {
      unlockError.textContent = err.message || 'Incorrect PIN';
      unlockError.classList.remove('hidden');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  btnQuickLock.addEventListener('click', () => {
    VaultManager.lockVault();
    showToast('Vault locked', 'info');
  });

  btnEmergencyReset.addEventListener('click', () => {
    const confirmed = confirm(
      'WARNING: This will permanently delete all stored passwords and your encrypted vault on this device!\n\nAre you absolutely sure you want to proceed?'
    );
    if (confirmed) {
      VaultManager.destroyVault();
      showSetupView();
      showToast('Vault erased completely', 'info');
    }
  });

  /* ==================== TOGGLE PASSWORD VISIBILITY ==================== */
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const eyeOpen = btn.querySelector('.eye-open');
      const eyeClosed = btn.querySelector('.eye-closed');

      if (input.type === 'password') {
        input.type = 'text';
        if (eyeOpen) eyeOpen.classList.add('hidden');
        if (eyeClosed) eyeClosed.classList.remove('hidden');
      } else {
        input.type = 'password';
        if (eyeOpen) eyeOpen.classList.remove('hidden');
        if (eyeClosed) eyeClosed.classList.add('hidden');
      }
    });
  });

  /* ==================== VAULT ITEMS RENDERING & SEARCH ==================== */
  function renderVaultItems() {
    const items = VaultManager.getItems();
    updateCategoryCounts(items);

    // Apply category filter
    let filtered = items;
    if (currentActiveCategory === 'favorite') {
      filtered = filtered.filter(i => i.favorite);
    } else if (currentActiveCategory !== 'all') {
      filtered = filtered.filter(i => i.category === currentActiveCategory);
    }

    // Apply text search
    if (currentSearchQuery.trim()) {
      const q = currentSearchQuery.toLowerCase();
      filtered = filtered.filter(i => 
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.username && i.username.toLowerCase().includes(q)) ||
        (i.url && i.url.toLowerCase().includes(q)) ||
        (i.notes && i.notes.toLowerCase().includes(q))
      );
    }

    // Sort favorites first, then alphabetically
    filtered.sort((a, b) => {
      if (a.favorite === b.favorite) {
        return (a.title || '').localeCompare(b.title || '');
      }
      return a.favorite ? -1 : 1;
    });

    itemsList.innerHTML = '';

    if (filtered.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      filtered.forEach(item => {
        const card = createItemCardElement(item);
        itemsList.appendChild(card);
      });
    }

    updateSecurityBanner();
  }

  function createItemCardElement(item) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.setAttribute('data-id', item.id);

    const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.login;
    const subtext = item.username || item.url || (item.category === 'note' ? 'Secure Note' : 'No credentials');

    card.innerHTML = `
      <div class="item-left">
        <div class="item-cat-icon">${cat.icon}</div>
        <div class="item-meta">
          <div class="item-title-row">
            <span class="item-title">${escapeHtml(item.title || 'Untitled')}</span>
            ${item.favorite ? '<span class="fav-star">★</span>' : ''}
          </div>
          <span class="item-subtext">${escapeHtml(subtext)}</span>
        </div>
      </div>
      <div class="item-actions">
        ${item.password ? `
          <button class="btn-icon-copy quick-copy-btn" title="Quick Copy Password" aria-label="Copy password">
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
        ` : ''}
      </div>
    `;

    // Click card to open detail sheet
    card.addEventListener('click', (e) => {
      if (e.target.closest('.quick-copy-btn')) return;
      openItemDetailModal(item.id);
    });

    // Quick copy button inside card
    const quickCopy = card.querySelector('.quick-copy-btn');
    if (quickCopy) {
      quickCopy.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(item.password, 'Password');
      });
    }

    return card;
  }

  function updateCategoryCounts(items) {
    const counts = {
      all: items.length,
      favorite: items.filter(i => i.favorite).length,
      login: items.filter(i => i.category === 'login').length,
      card: items.filter(i => i.category === 'card').length,
      note: items.filter(i => i.category === 'note').length,
      wifi: items.filter(i => i.category === 'wifi').length,
      id: items.filter(i => i.category === 'id').length
    };

    for (const [key, count] of Object.entries(counts)) {
      const el = document.getElementById(`count-${key}`);
      if (el) el.textContent = count;
    }
  }

  function updateSecurityBanner() {
    const audit = VaultManager.getSecurityAudit();
    if (!audit) return;

    const bannerScore = document.getElementById('banner-score');
    const bannerSummary = document.getElementById('banner-summary');
    const gaugeCircle = document.getElementById('gauge-circle');

    bannerScore.textContent = audit.overallScore;

    let color = '#10b981';
    let summaryText = 'Excellent! All passwords strong and unique.';

    if (audit.overallScore < 50) {
      color = '#ef4444';
      summaryText = `High risk! Found ${audit.weakCount} weak & ${audit.reusedCount} reused passwords.`;
    } else if (audit.overallScore < 80) {
      color = '#f59e0b';
      summaryText = `Attention: ${audit.weakCount} weak and ${audit.reusedCount} reused credentials.`;
    }

    gaugeCircle.style.borderColor = color;
    gaugeCircle.style.color = color;
    bannerSummary.textContent = summaryText;
  }

  // Filter Chip clicks
  categoryFilters.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      categoryFilters.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentActiveCategory = chip.getAttribute('data-category');
      renderVaultItems();
    });
  });

  // Search Input
  vaultSearch.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value;
    clearSearchBtn.classList.toggle('hidden', !currentSearchQuery);
    renderVaultItems();
  });

  clearSearchBtn.addEventListener('click', () => {
    vaultSearch.value = '';
    currentSearchQuery = '';
    clearSearchBtn.classList.add('hidden');
    renderVaultItems();
    vaultSearch.focus();
  });

  /* ==================== ITEM DETAIL VIEW MODAL ==================== */
  function openItemDetailModal(id) {
    const item = VaultManager.getItemById(id);
    if (!item) return;

    viewingItemId = id;
    isViewingPasswordRevealed = false;

    const cat = CATEGORY_MAP[item.category] || CATEGORY_MAP.login;
    viewMetaCategory.textContent = `${cat.icon} ${cat.label}`;
    viewTitle.textContent = item.title || 'Untitled';

    // Username
    const fieldUser = document.getElementById('field-view-username');
    if (item.username) {
      fieldUser.classList.remove('hidden');
      viewUsername.textContent = item.username;
    } else {
      fieldUser.classList.add('hidden');
    }

    // Password
    const fieldPw = document.getElementById('field-view-password');
    if (item.password) {
      fieldPw.classList.remove('hidden');
      viewPassword.textContent = '••••••••••••';
      viewPassword.classList.add('masked');
      updateStrengthDisplay(item.password, viewStrengthBar, viewStrengthLabel, viewCrackTime);
    } else {
      fieldPw.classList.add('hidden');
    }

    // URL
    const fieldUrl = document.getElementById('field-view-url');
    if (item.url) {
      fieldUrl.classList.remove('hidden');
      viewUrl.textContent = item.url;
      viewUrl.href = item.url.startsWith('http') ? item.url : `https://${item.url}`;
    } else {
      fieldUrl.classList.add('hidden');
    }

    // Notes
    const fieldNotes = document.getElementById('field-view-notes');
    if (item.notes) {
      fieldNotes.classList.remove('hidden');
      viewNotes.textContent = item.notes;
    } else {
      fieldNotes.classList.add('hidden');
    }

    // Favorite Button state
    btnViewToggleFav.textContent = item.favorite ? '★' : '☆';
    btnViewToggleFav.style.color = item.favorite ? '#fbbf24' : 'var(--text-muted)';

    // Timestamps
    viewCreatedAt.textContent = `Added: ${formatDate(item.createdAt)}`;
    viewUpdatedAt.textContent = `Updated: ${formatDate(item.updatedAt)}`;

    modalViewItem.classList.remove('hidden');
  }

  btnViewTogglePw.addEventListener('click', () => {
    const item = VaultManager.getItemById(viewingItemId);
    if (!item || !item.password) return;

    isViewingPasswordRevealed = !isViewingPasswordRevealed;
    if (isViewingPasswordRevealed) {
      viewPassword.textContent = item.password;
      viewPassword.classList.remove('masked');
    } else {
      viewPassword.textContent = '••••••••••••';
      viewPassword.classList.add('masked');
    }
  });

  btnViewToggleFav.addEventListener('click', async () => {
    const item = VaultManager.getItemById(viewingItemId);
    if (!item) return;

    const newFav = !item.favorite;
    await VaultManager.updateItem(viewingItemId, { favorite: newFav });
    btnViewToggleFav.textContent = newFav ? '★' : '☆';
    btnViewToggleFav.style.color = newFav ? '#fbbf24' : 'var(--text-muted)';
    renderVaultItems();
    showToast(newFav ? 'Added to favorites' : 'Removed from favorites', 'info');
  });

  btnCopyUsername.addEventListener('click', () => {
    const item = VaultManager.getItemById(viewingItemId);
    if (item && item.username) copyToClipboard(item.username, 'Username');
  });

  btnCopyPassword.addEventListener('click', () => {
    const item = VaultManager.getItemById(viewingItemId);
    if (item && item.password) copyToClipboard(item.password, 'Password');
  });

  btnCopyUrl.addEventListener('click', () => {
    const item = VaultManager.getItemById(viewingItemId);
    if (item && item.url) copyToClipboard(item.url, 'URL');
  });

  btnCloseViewModal.addEventListener('click', () => {
    modalViewItem.classList.add('hidden');
    viewingItemId = null;
  });

  btnEditItem.addEventListener('click', () => {
    const id = viewingItemId;
    modalViewItem.classList.add('hidden');
    openItemFormModal(id);
  });

  btnDeleteItem.addEventListener('click', async () => {
    const confirmed = confirm('Are you sure you want to delete this record?');
    if (confirmed && viewingItemId) {
      await VaultManager.deleteItem(viewingItemId);
      modalViewItem.classList.add('hidden');
      viewingItemId = null;
      renderVaultItems();
      showToast('Item deleted', 'info');
    }
  });

  /* ==================== ADD / EDIT ITEM MODAL ==================== */
  function openItemFormModal(id = null) {
    formItem.reset();
    itemStrengthBar.style.width = '0%';

    if (id) {
      // Editing
      const item = VaultManager.getItemById(id);
      if (!item) return;
      modalItemTitle.textContent = 'Edit Item';
      itemIdInput.value = item.id;
      itemCategorySelect.value = item.category || 'login';
      itemTitleInput.value = item.title || '';
      itemUsernameInput.value = item.username || '';
      itemPasswordInput.value = item.password || '';
      itemUrlInput.value = item.url || '';
      itemNotesInput.value = item.notes || '';
      itemFavoriteInput.checked = !!item.favorite;
      updateStrengthDisplay(item.password, itemStrengthBar, itemStrengthText, itemStrengthEntropy);
    } else {
      // New Item
      modalItemTitle.textContent = 'Add New Item';
      itemIdInput.value = '';
      itemCategorySelect.value = currentActiveCategory !== 'all' && currentActiveCategory !== 'favorite' ? currentActiveCategory : 'login';
      itemFavoriteInput.checked = false;
    }

    adjustFormFieldsByCategory(itemCategorySelect.value);
    modalItem.classList.remove('hidden');
    setTimeout(() => itemTitleInput.focus(), 150);
  }

  itemCategorySelect.addEventListener('change', (e) => {
    adjustFormFieldsByCategory(e.target.value);
  });

  function adjustFormFieldsByCategory(category) {
    const groupUser = document.getElementById('group-username');
    const groupPw = document.getElementById('group-password');
    const groupUrl = document.getElementById('group-url');

    if (category === 'note') {
      groupUser.classList.add('hidden');
      groupPw.classList.add('hidden');
      groupUrl.classList.add('hidden');
    } else if (category === 'wifi') {
      groupUser.classList.add('hidden');
      groupPw.classList.remove('hidden');
      groupUrl.classList.add('hidden');
      document.querySelector('#group-password label').textContent = 'Wi-Fi Password / Key';
    } else {
      groupUser.classList.remove('hidden');
      groupPw.classList.remove('hidden');
      groupUrl.classList.remove('hidden');
      document.querySelector('#group-password label').textContent = 'Password';
    }
  }

  btnFloatingAdd.addEventListener('click', () => openItemFormModal());
  btnEmptyAdd.addEventListener('click', () => openItemFormModal());
  btnCloseItemModal.addEventListener('click', () => modalItem.classList.add('hidden'));
  btnCancelItem.addEventListener('click', () => modalItem.classList.add('hidden'));

  itemPasswordInput.addEventListener('input', (e) => {
    updateStrengthDisplay(e.target.value, itemStrengthBar, itemStrengthText, itemStrengthEntropy);
  });

  btnQuickGenFill.addEventListener('click', () => {
    const newPass = CryptoEngine.generatePassword({ length: 20 });
    itemPasswordInput.value = newPass;
    itemPasswordInput.type = 'text';
    updateStrengthDisplay(newPass, itemStrengthBar, itemStrengthText, itemStrengthEntropy);
    showToast('Generated 20-character secure password', 'info');
  });

  formItem.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = itemIdInput.value;
    const itemData = {
      category: itemCategorySelect.value,
      title: itemTitleInput.value,
      username: itemUsernameInput.value,
      password: itemPasswordInput.value,
      url: itemUrlInput.value,
      notes: itemNotesInput.value,
      favorite: itemFavoriteInput.checked
    };

    const submitBtn = document.getElementById('btn-save-item');
    setButtonLoading(submitBtn, true);

    try {
      if (id) {
        await VaultManager.updateItem(id, itemData);
        showToast('Item updated', 'success');
      } else {
        await VaultManager.addItem(itemData);
        showToast('Saved to vault', 'success');
      }
      modalItem.classList.add('hidden');
      renderVaultItems();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  /* ==================== STANDALONE PASSWORD GENERATOR TAB ==================== */
  function updateGenerator() {
    const options = {
      length: parseInt(genLengthSlider.value, 10),
      uppercase: genUpper.checked,
      lowercase: genLower.checked,
      numbers: genNumbers.checked,
      symbols: genSymbols.checked,
      avoidAmbiguous: genAvoidAmbiguous.checked
    };

    const password = CryptoEngine.generatePassword(options);
    genOutput.textContent = password;
    genLengthVal.textContent = options.length;
    updateStrengthDisplay(password, genStrengthBar, genStrengthText, genEntropyText);
  }

  genLengthSlider.addEventListener('input', updateGenerator);
  [genUpper, genLower, genNumbers, genSymbols, genAvoidAmbiguous].forEach(cb => {
    cb.addEventListener('change', updateGenerator);
  });

  btnRefreshGen.addEventListener('click', updateGenerator);
  btnCopyGen.addEventListener('click', () => {
    copyToClipboard(genOutput.textContent, 'Generated password');
  });

  /* ==================== SECURITY AUDIT TAB ==================== */
  function renderSecurityAudit() {
    const audit = VaultManager.getSecurityAudit();
    if (!audit) return;

    document.getElementById('stat-total').textContent = audit.total;
    document.getElementById('stat-weak').textContent = audit.weakCount;
    document.getElementById('stat-reused').textContent = audit.reusedCount;

    const recommendations = document.getElementById('audit-recommendations');
    recommendations.innerHTML = '';

    const items = VaultManager.getItems();
    const weakOrReused = [];
    const pwdCount = {};

    items.forEach(i => {
      if (i.password) {
        pwdCount[i.password] = (pwdCount[i.password] || 0) + 1;
      }
    });

    items.forEach(i => {
      const issues = [];
      if (i.password) {
        const str = CryptoEngine.evaluateStrength(i.password);
        if (str.score <= 2) issues.push('Weak Password');
        if (pwdCount[i.password] > 1) issues.push('Reused Password');
      }
      if (issues.length > 0) {
        weakOrReused.push({ item: i, issues });
      }
    });

    if (weakOrReused.length === 0) {
      recommendations.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="48" height="48" stroke="#10b981" stroke-width="1.5" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
          <h4 style="margin-top: 10px;">Security Health Flawless</h4>
          <p>No weak or reused credentials found in your vault.</p>
        </div>
      `;
    } else {
      weakOrReused.forEach(({ item, issues }) => {
        const row = document.createElement('div');
        row.className = 'audit-item-row';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(item.title)}</strong>
            <div style="font-size: 12px; color: #f87171;">${issues.join(' • ')}</div>
          </div>
          <button class="btn btn-secondary btn-sm" style="font-size: 12px; padding: 6px 10px;">Update</button>
        `;
        row.querySelector('button').addEventListener('click', () => {
          openItemFormModal(item.id);
        });
        recommendations.appendChild(row);
      });
    }
  }

  btnViewAudit.addEventListener('click', () => {
    switchTab('tab-audit');
  });

  /* ==================== SETTINGS & CHANGE MASTER PIN ==================== */
  settingAutolock.addEventListener('change', (e) => {
    VaultManager.autoLockMinutes = e.target.value;
    showToast(`Auto-lock set to ${e.target.value == 0 ? 'Never' : e.target.value + ' min'}`, 'info');
  });

  if (settingBiometricsToggle) {
    settingBiometricsToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        try {
          await VaultManager.enableBiometrics();
          showToast('Biometric unlock enabled!', 'success');
        } catch (err) {
          e.target.checked = false;
          showToast('Could not enable biometrics: ' + err.message, 'error');
        }
      } else {
        VaultManager.disableBiometrics();
        showToast('Biometric unlock disabled', 'info');
      }
    });
  }

  if (btnOpenChangePin) {
    btnOpenChangePin.addEventListener('click', () => {
      formChangePin.reset();
      modalChangePin.classList.remove('hidden');
      changeCurrentPin.focus();
    });
  }

  if (btnCloseChangePin) {
    btnCloseChangePin.addEventListener('click', () => modalChangePin.classList.add('hidden'));
  }
  if (btnCancelChangePin) {
    btnCancelChangePin.addEventListener('click', () => modalChangePin.classList.add('hidden'));
  }

  if (formChangePin) {
    formChangePin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = changeCurrentPin.value;
      const nw = changeNewPin.value;
      const cnf = changeConfirmPin.value;

      if (nw !== cnf) {
        showToast('New PINs do not match!', 'error');
        return;
      }

      const btn = document.getElementById('btn-submit-change-pin');
      setButtonLoading(btn, true);

      try {
        await VaultManager.changePin(cur, nw);
        modalChangePin.classList.add('hidden');
        showToast('Master PIN successfully updated!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  /* ==================== BACKUP & RESTORE ==================== */
  btnExportVault.addEventListener('click', () => {
    try {
      const backupJson = VaultManager.exportEncryptedBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().slice(0, 10);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AegisVault-Backup-${dateStr}.vault`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Encrypted backup downloaded', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  });

  function triggerFileImport() {
    fileImportInput.value = '';
    fileImportInput.click();
  }

  btnImportVault.addEventListener('click', triggerFileImport);
  btnUnlockImport.addEventListener('click', triggerFileImport);
  btnImportFirstTime.addEventListener('click', triggerFileImport);

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        await VaultManager.importEncryptedBackup(evt.target.result);
        showToast('Backup restored. Please unlock with backup master password.', 'success');
        showUnlockView();
      } catch (err) {
        showToast('Import error: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });

  btnDestroyVault.addEventListener('click', () => {
    const confirmed = confirm(
      'Are you completely sure? This will wipe the encrypted vault from this device. If you do not have a backup, your passwords will be gone forever.'
    );
    if (confirmed) {
      VaultManager.destroyVault();
      showSetupView();
      showToast('Vault destroyed', 'info');
    }
  });

  /* ==================== TAB NAVIGATION ==================== */
  bottomNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const target = item.getAttribute('data-tab');
      if (target) switchTab(target);
    });
  });

  /* ==================== PWA INSTALLATION LOGIC ==================== */
  let deferredInstallPrompt = null;
  const modalInstallGuide = document.getElementById('modal-install-guide');
  const btnCloseInstallGuide = document.getElementById('btn-close-install-guide');
  const btnDismissInstallGuide = document.getElementById('btn-dismiss-install-guide');
  const nativeInstallPromptWrap = document.getElementById('native-install-prompt-wrap');
  const btnTriggerNativeInstall = document.getElementById('btn-trigger-native-install');

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent standard minibar on mobile
    e.preventDefault();
    deferredInstallPrompt = e;
    if (nativeInstallPromptWrap) {
      nativeInstallPromptWrap.classList.remove('hidden');
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    showToast('AegisVault successfully installed as an app!', 'success');
  });

  function openInstallGuide() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          showToast('Installing AegisVault...', 'success');
        }
        deferredInstallPrompt = null;
        if (nativeInstallPromptWrap) nativeInstallPromptWrap.classList.add('hidden');
      });
    } else {
      if (modalInstallGuide) modalInstallGuide.classList.remove('hidden');
    }
  }

  document.querySelectorAll('.btn-install-pwa').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openInstallGuide();
    });
  });

  if (btnTriggerNativeInstall) {
    btnTriggerNativeInstall.addEventListener('click', () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            showToast('Installing AegisVault...', 'success');
          }
          deferredInstallPrompt = null;
          if (modalInstallGuide) modalInstallGuide.classList.add('hidden');
        });
      }
    });
  }

  if (btnCloseInstallGuide) {
    btnCloseInstallGuide.addEventListener('click', () => modalInstallGuide.classList.add('hidden'));
  }
  if (btnDismissInstallGuide) {
    btnDismissInstallGuide.addEventListener('click', () => modalInstallGuide.classList.add('hidden'));
  }

  /* ==================== HELPERS ==================== */
  function closeAllModals() {
    modalItem.classList.add('hidden');
    modalViewItem.classList.add('hidden');
    if (modalChangePin) modalChangePin.classList.add('hidden');
    if (modalInstallGuide) modalInstallGuide.classList.add('hidden');
  }

  // Close modals on overlay backdrop tap
  [modalItem, modalViewItem, modalChangePin, modalInstallGuide].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    }
  });

  function setButtonLoading(btn, isLoading) {
    if (!btn) return;
    const textSpan = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner');
    btn.disabled = isLoading;
    if (textSpan) textSpan.classList.toggle('hidden', isLoading);
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
  }

  function formatDate(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoStr;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Kickoff App
  initApp();
});
