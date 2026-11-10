/**
 * Qubrix Associates - Client-Side Controller
 * Performance & SEO Optimized (Zero Layout Shifts, Lazy Chart Init, Smooth Input Handling)
 */

const RESEND_DELAY = 30;

// Utility selector
const $ = (id) => document.getElementById(id);

// Backend API Endpoints (Enquiry Verification Flow)
const API = {
  send: '/api/generateCode/Sendcode/',
  resend: '/api/generateCode/resendCode/',
  verify: '/api/valdiateOtp/check_otp/',
  enquiry: '/api/valdiateOtp/submitenquiry/'
};

// CSRF Cookie Extraction for Django
const getCookie = (name) => {
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
};

// HTTP Request Utility with CSRF Handling
async function postJSON(url, payload) {
  try {
    const csrfToken = getCookie('csrftoken') || document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: response.ok, status: response.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null };
  }
}

// User-friendly error message formatter
function apiMessage(res, fallback) {
  if (res.status === 0) return 'Cannot reach the server. Check network connection or verify Django server is active.';
  if (res.status === 429) return 'Too many requests. Please wait a moment and try again.';
  const d = res.data;
  if (d && typeof d === 'object') {
    if (typeof d.message === 'string') return d.message;
    if (typeof d.detail === 'string') return d.detail;
  }
  return fallback;
}

// Cloudflare Turnstile Helpers
const getCaptchaToken = (containerId) => {
  const container = $(containerId);
  return container?.querySelector('[name="cf-turnstile-response"]')?.value || '';
};

const resetCaptcha = (containerId) => {
  if (window.turnstile && typeof window.turnstile.reset === 'function') {
    window.turnstile.reset('#' + containerId);
  }
};

// Indian Rupee currency formatter
const formatINR = (val) => '₹' + Math.round(val).toLocaleString('en-IN');

// Cooldown Timer Factory
const makeCooldown = (onTick, onDone) => {
  let timer = null;
  const stop = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };
  const start = () => {
    stop();
    let left = RESEND_DELAY;
    onTick(left);
    timer = setInterval(() => {
      left--;
      if (left > 0) {
        onTick(left);
      } else {
        stop();
        onDone();
      }
    }, 1000);
  };
  return { start, stop, running: () => timer !== null };
};

/* ==========================================================================
   Funds Carousel (With Swipe & Button Navigation)
   ========================================================================== */
let currentSlide = 0;
const maxSlides = 2;
const slideWidth = 310;

const carouselTrack = $('carouselTrack');
const carouselPrev = $('carouselPrev');
const carouselNext = $('carouselNext');

function slideCarousel(direction) {
  if (!carouselTrack) return;
  currentSlide = Math.min(maxSlides, Math.max(0, currentSlide + direction));
  carouselTrack.style.transform = `translateX(-${currentSlide * slideWidth}px)`;
}

if (carouselPrev) carouselPrev.addEventListener('click', () => slideCarousel(-1));
if (carouselNext) carouselNext.addEventListener('click', () => slideCarousel(1));

// Touch / swipe support for mobile carousel
if (carouselTrack) {
  let touchStartX = 0;
  let touchEndX = 0;

  carouselTrack.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  carouselTrack.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) slideCarousel(1);
      else slideCarousel(-1);
    }
  }, { passive: true });
}

/* ==========================================================================
   SIP & Lump-Sum Calculator (requestAnimationFrame & Lazy Chart Init)
   ========================================================================== */
let calcMode = 'SIP';
let chartInstance = null;
let chartInitStarted = false;
let rafPending = false;

const calcTabSip = $('calcTabSip');
const calcTabLump = $('calcTabLump');
const sliderAmount = $('sliderAmount');
const sliderRate = $('sliderRate');
const sliderTenure = $('sliderTenure');

function setCalcMode(mode) {
  calcMode = mode;
  const isSip = mode === 'SIP';

  if (calcTabSip) calcTabSip.classList.toggle('active', isSip);
  if (calcTabLump) calcTabLump.classList.toggle('active', !isSip);
  
  const labelInvest = $('labelInvestment');
  const maxLabel = $('amountMaxLabel');
  if (labelInvest) labelInvest.textContent = isSip ? 'Monthly Investment Amount' : 'One-Time Lump Sum Amount';
  if (maxLabel) maxLabel.textContent = isSip ? '₹2,00,000' : '₹25,00,000';

  if (sliderAmount) {
    sliderAmount.max = isSip ? 200000 : 2500000;
    sliderAmount.step = isSip ? 500 : 5000;
    sliderAmount.value = isSip ? 10000 : 100000;
  }

  scheduleCalculatorUpdate();
}

if (calcTabSip) calcTabSip.addEventListener('click', () => setCalcMode('SIP'));
if (calcTabLump) calcTabLump.addEventListener('click', () => setCalcMode('LUMPSUM'));

// Debounced update with requestAnimationFrame for smooth interaction (prevents INP latency)
function scheduleCalculatorUpdate() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    updateCalculators();
    rafPending = false;
  });
}

[sliderAmount, sliderRate, sliderTenure].forEach((slider) => {
  if (slider) {
    slider.addEventListener('input', scheduleCalculatorUpdate, { passive: true });
  }
});

function updateCalculators() {
  if (!sliderAmount || !sliderRate || !sliderTenure) return;

  const amount = parseFloat(sliderAmount.value) || 0;
  const rate = parseFloat(sliderRate.value) || 0;
  const tenure = parseFloat(sliderTenure.value) || 0;

  const dispAmount = $('dispInvestAmount');
  const dispRate = $('dispReturnRate');
  const dispTenure = $('dispTenure');

  if (dispAmount) dispAmount.textContent = formatINR(amount);
  if (dispRate) dispRate.textContent = rate.toFixed(1) + '%';
  if (dispTenure) dispTenure.textContent = tenure + (tenure === 1 ? ' Year' : ' Years');

  let invested;
  let total;

  if (calcMode === 'SIP') {
    const monthlyRate = rate / 100 / 12;
    const months = tenure * 12;
    invested = amount * months;
    if (monthlyRate > 0) {
      total = amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
    } else {
      total = invested;
    }
  } else {
    invested = amount;
    total = amount * Math.pow(1 + rate / 100, tenure);
  }

  const gains = Math.max(0, total - invested);

  const resInvested = $('resInvested');
  const resGains = $('resGains');
  const resTotal = $('resTotal');

  if (resInvested) resInvested.textContent = formatINR(invested);
  if (resGains) resGains.textContent = formatINR(gains);
  if (resTotal) resTotal.textContent = formatINR(total);

  // Lazy initialize chart if not already created
  if (!chartInstance && !chartInitStarted) {
    initCalculatorChart(invested, gains);
  } else if (chartInstance) {
    chartInstance.data.datasets[0].data = [invested, gains];
    chartInstance.update('none'); // Update without full layout animation for performance
  }
}

function initCalculatorChart(initialInvested = 1200000, initialGains = 1323391) {
  const chartCanvas = $('calculatorChart');
  if (!chartCanvas || typeof window.Chart !== 'function') return;

  chartInitStarted = true;
  chartInstance = new Chart(chartCanvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Invested Capital', 'Est. Returns'],
      datasets: [{
        data: [initialInvested, initialGains],
        backgroundColor: ['#cbd5e1', '#10b981'],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 400
      },
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ' ' + ctx.label + ': ' + formatINR(ctx.raw)
          }
        }
      }
    }
  });
}

// Defer Chart.js initialization using IntersectionObserver (Major SEO / PageSpeed optimization)
function setupLazyCalculator() {
  const calcSection = $('calculators');
  if (!calcSection) {
    initCalculatorChart();
    return;
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !chartInstance) {
          updateCalculators();
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px 0px' });

    observer.observe(calcSection);
  } else {
    // Fallback for older browsers
    initCalculatorChart();
  }
}

/* ==========================================================================
   Enquiry Form & OTP Verification Flow (Preserved Intact)
   ========================================================================== */
const enquiry = {
  form: $('enquiryForm'),
  phone: $('enquiryPhone'),
  sendBtn: $('enquirySendBtn'),
  resendBtn: $('enquiryResendBtn'),
  block: $('enquiryOtpBlock'),
  code: $('enquiryCode'),
  verifyBtn: $('enquiryVerifyBtn'),
  status: $('enquiryOtpStatus'),
  submit: $('enquirySubmit'),
  verified: false
};

const enquiryCooldown = makeCooldown(
  (left) => {
    if (enquiry.resendBtn) {
      enquiry.resendBtn.disabled = true;
      enquiry.resendBtn.textContent = `Resend OTP (${left}s)`;
    }
  },
  () => {
    if (enquiry.resendBtn) {
      enquiry.resendBtn.textContent = 'Resend OTP';
      enquiry.resendBtn.disabled = enquiry.verified;
    }
  }
);

function setEnquiryStatus(text, type = '') {
  if (!enquiry.status) return;
  enquiry.status.textContent = text;
  enquiry.status.className = 'enquiry-otp-status' + (type ? ' ' + type : '');
}

function resetEnquiryOtp() {
  enquiryCooldown.stop();
  enquiry.verified = false;
  if (enquiry.block) enquiry.block.classList.remove('show');
  if (enquiry.code) {
    enquiry.code.value = '';
    enquiry.code.disabled = true;
    enquiry.code.readOnly = false;
  }
  if (enquiry.phone) enquiry.phone.readOnly = false;
  if (enquiry.verifyBtn) {
    enquiry.verifyBtn.hidden = true;
    enquiry.verifyBtn.disabled = false;
  }
  if (enquiry.resendBtn) {
    enquiry.resendBtn.disabled = true;
    enquiry.resendBtn.textContent = 'Resend OTP';
  }
  if (enquiry.sendBtn) enquiry.sendBtn.disabled = false;
  if (enquiry.submit) {
    enquiry.submit.disabled = true;
    enquiry.submit.textContent = 'Submit Enquiry';
  }
  setEnquiryStatus('');
}

async function requestEnquiryOtp(url, isResend) {
  if (!enquiry.phone) return;
  const phone = enquiry.phone.value.trim();

  if (!/^\d{10}$/.test(phone)) {
    if (enquiry.block) enquiry.block.classList.add('show');
    setEnquiryStatus('Enter a valid 10-digit phone number first.', 'err');
    return;
  }

  const token = getCaptchaToken('enquiryCaptcha');
  if (!token) {
    if (enquiry.block) enquiry.block.classList.add('show');
    setEnquiryStatus('Complete the CAPTCHA verification first.', 'err');
    return;
  }

  if (enquiry.sendBtn) enquiry.sendBtn.disabled = true;
  if (enquiry.resendBtn) enquiry.resendBtn.disabled = true;

  const res = await postJSON(url, { phone, captcha_token: token });
  resetCaptcha('enquiryCaptcha');

  if (!res.ok) {
    if (enquiry.sendBtn) enquiry.sendBtn.disabled = isResend;
    if (enquiry.resendBtn) enquiry.resendBtn.disabled = !isResend;
    if (enquiry.block) enquiry.block.classList.add('show');
    setEnquiryStatus(apiMessage(res, 'Could not send OTP. Please try again.'), 'err');
    return;
  }

  if (enquiry.code) {
    enquiry.code.value = '';
    enquiry.code.disabled = false;
    enquiry.code.focus();
  }
  if (enquiry.verifyBtn) enquiry.verifyBtn.hidden = true;
  if (enquiry.block) enquiry.block.classList.add('show');

  setEnquiryStatus(isResend ? 'OTP resent.' : 'OTP sent to your phone.', 'ok');
  enquiryCooldown.start();
}

async function verifyEnquiryOtp() {
  if (!enquiry.code || !enquiry.phone) return;
  const otp = enquiry.code.value.trim();
  if (!otp) return;

  if (enquiry.verifyBtn) enquiry.verifyBtn.disabled = true;
  const res = await postJSON(API.verify, { phone: enquiry.phone.value.trim(), otp });

  if (!res.ok) {
    if (enquiry.verifyBtn) enquiry.verifyBtn.disabled = false;
    setEnquiryStatus(apiMessage(res, 'Incorrect OTP. Please check and try again.'), 'err');
    return;
  }

  enquiry.verified = true;
  enquiryCooldown.stop();
  if (enquiry.resendBtn) {
    enquiry.resendBtn.textContent = 'Resend OTP';
    enquiry.resendBtn.disabled = true;
  }
  if (enquiry.code) enquiry.code.readOnly = true;
  if (enquiry.phone) enquiry.phone.readOnly = true;
  if (enquiry.verifyBtn) {
    enquiry.verifyBtn.hidden = true;
    enquiry.verifyBtn.disabled = false;
  }
  if (enquiry.submit) enquiry.submit.disabled = false;
  setEnquiryStatus('Phone number verified successfully.', 'ok');
}

// Bind enquiry event listeners
if (enquiry.sendBtn) {
  enquiry.sendBtn.addEventListener('click', () => requestEnquiryOtp(API.send, false));
}
if (enquiry.resendBtn) {
  enquiry.resendBtn.addEventListener('click', () => {
    if (!enquiryCooldown.running() && !enquiry.verified) requestEnquiryOtp(API.resend, true);
  });
}
if (enquiry.verifyBtn) {
  enquiry.verifyBtn.addEventListener('click', verifyEnquiryOtp);
}
if (enquiry.code) {
  enquiry.code.addEventListener('input', () => {
    enquiry.code.value = enquiry.code.value.replace(/\D/g, '');
    if (enquiry.verifyBtn) {
      enquiry.verifyBtn.hidden = enquiry.verified || enquiry.code.value.length === 0;
    }
  });
}
if (enquiry.phone) {
  enquiry.phone.addEventListener('input', () => {
    enquiry.phone.value = enquiry.phone.value.replace(/\D/g, '');
    if (enquiry.block && enquiry.block.classList.contains('show')) resetEnquiryOtp();
  });
}
if (enquiry.form) {
  enquiry.form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!enquiry.verified) return;

    const payload = {
      name: $('enquiryName')?.value?.trim() || '',
      phone: enquiry.phone.value.trim(),
      email: $('enquiryEmail')?.value?.trim() || '',
      otp: enquiry.code.value.trim(),
      message: $('enquiryMessage')?.value?.trim() || ''
    };

    if (enquiry.submit) {
      enquiry.submit.disabled = true;
      enquiry.submit.textContent = 'Submitting...';
    }

    const res = await postJSON(API.enquiry, payload);

    if (enquiry.submit) {
      enquiry.submit.textContent = 'Submit Enquiry';
    }

    if (!res.ok) {
      if (enquiry.submit) enquiry.submit.disabled = false;
      setEnquiryStatus(apiMessage(res, 'Could not submit the enquiry. Please try again.'), 'err');
      return;
    }

    alert('Thank you for reaching out to Qubrix Associates. Your enquiry has been successfully submitted.');
    enquiry.form.reset();
    resetEnquiryOtp();
  });
}

/* ==========================================================================
   Page Lifecycle Initialization
   ========================================================================== */
window.addEventListener('DOMContentLoaded', () => {
  updateCalculators();
  setupLazyCalculator();
  resetEnquiryOtp();
});

window.addEventListener('pageshow', () => {
  resetEnquiryOtp();
});
