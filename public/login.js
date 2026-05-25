/* D:\Project\fund-tracker\public\login.js */

// Global State
let currentMode = 'login'; // 'login' or 'register'

// Check session on page load
document.addEventListener('DOMContentLoaded', async () => {
  // If guest mode is enabled, redirect directly to app home page
  if (localStorage.getItem('fundTrackerGuestMode') === 'true') {
    showToast('以本地免登录模式登录，正在跳转...', 'success');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
    return;
  }

  // If in local Vite development mode (port 5173), there is no backend server
  if (window.location.port === '5173') {
    const emailInput = document.getElementById('email');
    if (emailInput) emailInput.focus();
    return;
  }

  // Check if we are already logged in
  try {
    // Check session with a cache-buster query parameter to prevent browser caching
    const res = await fetch('/api/auth/me?_t=' + Date.now(), {
      cache: 'no-store',
      headers: {
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache'
      }
    });
    const contentType = res.headers.get("content-type");
    if (res.ok && contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (data.authenticated) {
        // Already authenticated, redirect to app home page
        showToast('已登录，正在跳转至主页...', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
    }
  } catch (err) {
    console.error('Session check failed:', err);
  }
  
  // Set default form focus and initial active tab styles
  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.focus();
});

// ========== Email Suffix Autocomplete ==========
const EMAIL_DOMAINS = [
  'qq.com', '163.com', '126.com', 'gmail.com', 'outlook.com',
  'hotmail.com', 'yahoo.com', 'foxmail.com', 'sina.com', 'sohu.com',
  'icloud.com', '139.com', '189.cn', 'yeah.net'
];

let activeSuggestionIndex = -1;

function setupEmailAutocomplete() {
  const emailInput = document.getElementById('email');
  const suggestionsEl = document.getElementById('email-suggestions');
  if (!emailInput || !suggestionsEl) return;

  emailInput.addEventListener('input', () => {
    const value = emailInput.value;
    const atIndex = value.indexOf('@');

    if (atIndex === -1 || atIndex === 0) {
      hideSuggestions();
      return;
    }

    const prefix = value.substring(0, atIndex);
    const typedDomain = value.substring(atIndex + 1).toLowerCase();

    // Filter matching domains
    const matches = EMAIL_DOMAINS.filter(d => d.startsWith(typedDomain));

    if (matches.length === 0 || (matches.length === 1 && matches[0] === typedDomain)) {
      hideSuggestions();
      return;
    }

    renderSuggestions(prefix, typedDomain, matches);
  });

  emailInput.addEventListener('keydown', (e) => {
    if (!suggestionsEl.classList.contains('visible')) return;
    const items = suggestionsEl.querySelectorAll('.email-suggestion-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
      updateActiveItem(items);
    } else if (e.key === 'Enter' && activeSuggestionIndex >= 0) {
      e.preventDefault();
      items[activeSuggestionIndex].click();
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  // Close on blur (with delay to allow click)
  emailInput.addEventListener('blur', () => {
    setTimeout(() => hideSuggestions(), 150);
  });
}

function renderSuggestions(prefix, typedDomain, matches) {
  const suggestionsEl = document.getElementById('email-suggestions');
  const emailInput = document.getElementById('email');
  activeSuggestionIndex = -1;

  // Position the dropdown directly below the email input using fixed coordinates
  const rect = emailInput.getBoundingClientRect();
  suggestionsEl.style.top = (rect.bottom + 6) + 'px';
  suggestionsEl.style.left = rect.left + 'px';
  suggestionsEl.style.width = rect.width + 'px';

  suggestionsEl.innerHTML = matches.map((domain, i) => {
    const remaining = domain.substring(typedDomain.length);
    return `<div class="email-suggestion-item" data-email="${prefix}@${domain}" data-index="${i}">
      <i class="icon-mail"></i>
      <span><span class="email-prefix">${prefix}@${typedDomain}</span><span class="email-suffix">${remaining}</span></span>
    </div>`;
  }).join('');

  // Click handler for each item
  suggestionsEl.querySelectorAll('.email-suggestion-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur
      const emailInput = document.getElementById('email');
      emailInput.value = item.dataset.email;
      hideSuggestions();
      // Trigger input event so floating label updates
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      emailInput.focus();
    });
  });

  suggestionsEl.classList.add('visible');
}

function updateActiveItem(items) {
  items.forEach((el, i) => {
    el.classList.toggle('active', i === activeSuggestionIndex);
  });
}

function hideSuggestions() {
  const suggestionsEl = document.getElementById('email-suggestions');
  if (suggestionsEl) {
    suggestionsEl.classList.remove('visible');
    activeSuggestionIndex = -1;
  }
}

// Initialize autocomplete after DOM ready
document.addEventListener('DOMContentLoaded', setupEmailAutocomplete);

let isSwitching = false; // Prevent overlapping transitions
const ALL_MORPH_CLASSES = ['morph-out-left', 'morph-in-right', 'morph-out-right', 'morph-in-left', 'switch-animate'];

// Toggle Tab Switching
async function switchTab(mode) {
  if (currentMode === mode || isSwitching) return;
  isSwitching = true;
  
  // Determine slide direction: login→register = right, register→login = left
  const goingRight = (mode === 'register');
  currentMode = mode;
  
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabRegisterBtn = document.getElementById('tab-register-btn');
  const tabSlider = document.getElementById('tab-slider');
  const formTitle = document.getElementById('form-title');
  const formSubtitle = document.getElementById('form-subtitle');
  const submitBtnText = document.getElementById('submit-btn-text');
  const formContainer = document.querySelector('.auth-form-container');
  
  // 1. Slide the pill indicator & update active text styles
  if (goingRight) {
    tabSlider.classList.add('slide-right');
    tabLoginBtn.classList.remove('active');
    tabRegisterBtn.classList.add('active');
  } else {
    tabSlider.classList.remove('slide-right');
    tabRegisterBtn.classList.remove('active');
    tabLoginBtn.classList.add('active');
  }
  
  // 2. Slide-out the form in the same direction as the pill
  if (formContainer) {
    formContainer.classList.remove(...ALL_MORPH_CLASSES);
    void formContainer.offsetWidth;
    formContainer.classList.add(goingRight ? 'morph-out-left' : 'morph-out-right');
    
    // Wait for slide-out to finish
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  
  // 3. Swap text contents silently while invisible & reset inputs
  document.getElementById('auth-form').reset();
  
  if (mode === 'login') {
    formTitle.textContent = '欢迎回来';
    formSubtitle.textContent = '请输入您的电子邮箱与密码以进入控制台';
    submitBtnText.textContent = '立即安全登录';
  } else {
    formTitle.textContent = '快速注册';
    formSubtitle.textContent = '仅需几秒钟即可创建您专属的云端基金追踪账户';
    submitBtnText.textContent = '立即注册新账户';
  }
  
  // 4. Slide-in from the opposite side (new content enters from the direction the pill went)
  if (formContainer) {
    formContainer.classList.remove(...ALL_MORPH_CLASSES);
    void formContainer.offsetWidth;
    formContainer.classList.add(goingRight ? 'morph-in-right' : 'morph-in-left');
  }
  
  // 5. Restore focus and unlock switching
  const emailInput = document.getElementById('email');
  if (emailInput) emailInput.focus();
  
  isSwitching = false;
}

// Toggle Password Visibility
function togglePasswordVisibility() {
  const passwordInput = document.getElementById('password');
  const toggleIcon = document.getElementById('password-toggle-icon');
  
  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleIcon.className = 'icon-eye-off';
  } else {
    passwordInput.type = 'password';
    toggleIcon.className = 'icon-eye';
  }
}

// Handle Form Submission
async function handleAuthSubmit(event) {
  event.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const submitBtn = document.getElementById('submit-btn');
  
  if (!email || !password) {
    showToast('请填写完整的邮箱和密码', 'error');
    return;
  }
  
  // Set Loading State
  submitBtn.classList.add('loading');
  
  // If running in local Vite development mode (port 5173), bypass backend call and auto-login
  if (window.location.port === '5173') {
    showToast('本地开发模式：自动验证成功！正在进入控制台...', 'success');
    localStorage.setItem('fundTrackerSyncedUser', email);
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
    return;
  }
  
  const endpoint = currentMode === 'login' ? '/api/auth/login' : '/api/auth/register';
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      if (currentMode === 'login') {
        showToast('登录成功！正在进入控制台...', 'success');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      } else {
        showToast('账户注册成功！正在为您自动登录...', 'success');
        // Automatically switch to login state or auto login
        setTimeout(() => {
          currentMode = 'login';
          handleAuthSubmit(event);
        }, 1500);
      }
    } else {
      showToast(result.error || '操作失败，请重试', 'error');
      submitBtn.classList.remove('loading');
    }
  } catch (error) {
    console.error('Auth request failed:', error);
    showToast('网络请求失败，请检查网络连接', 'error');
    submitBtn.classList.remove('loading');
  }
}

// Highly Elegant Toast Notification Engine
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Select icon class
  let iconClass = 'icon-info';
  if (type === 'success') iconClass = 'icon-check-circle';
  if (type === 'error') iconClass = 'icon-alert-triangle';
  
  toast.innerHTML = `
    <i class="${iconClass}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('transitionend', () => {
      toast.remove();
    });
  }, 3500);
}

// ========== Guest Mode / Login-Free Functionality ==========

function triggerGuestMode() {
  const overlay = document.getElementById('guest-modal-overlay');
  if (overlay) {
    overlay.classList.add('visible');
  }
}

function closeGuestModal() {
  const overlay = document.getElementById('guest-modal-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
  }
}

function confirmGuestMode() {
  closeGuestModal();
  
  // Set guest mode flag
  localStorage.setItem('fundTrackerGuestMode', 'true');
  
  showToast('进入免登录本地模式！正在跳转至主页...', 'success');
  
  // Smooth redirect to app home page
  setTimeout(() => {
    window.location.href = '/';
  }, 1200);
}

// Close guest modal if clicking outside
document.addEventListener('click', (e) => {
  const overlay = document.getElementById('guest-modal-overlay');
  if (overlay && e.target === overlay) {
    closeGuestModal();
  }
});
