const RESEND_DELAY = 30;

const $ = (id) => document.getElementById(id);

const API = {
  send: '/api/generateCode/Sendcode/',
  resend: '/api/generateCode/resendCode/',
  verify: '/api/valdiateOtp/check_otp/',
  enquiry: '/api/valdiateOtp/submitenquiry/'
};

const getCookie = (name) => {
  const match = document.cookie.split('; ').find((row) => row.startsWith(name + '='));
  return match ? decodeURIComponent(match.split('=')[1]) : '';
};

async function postJSON(url, payload) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') || document.querySelector('[name=csrfmiddlewaretoken]')?.value || '' },
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
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

function apiMessage(res, fallback) {
  if (res.status === 0) return 'Cannot reach the server. Check that Django is running.';
  if (res.status === 429) return 'Too many requests. Please wait and try again.';
  const d = res.data;
  if (d && typeof d === 'object') {
    if (typeof d.message === 'string') return d.message;
    if (typeof d.detail === 'string') return d.detail;
  }
  return fallback;
}

const getCaptchaToken = (containerId) =>
  $(containerId)?.querySelector('[name="cf-turnstile-response"]')?.value || '';

const resetCaptcha = (containerId) => window.turnstile?.reset('#' + containerId);

const formatINR = (val) => '₹' + Math.round(val).toLocaleString('en-IN');

const makeCooldown = (onTick, onDone) => {
  let timer = null;
  const stop = () => {
    clearInterval(timer);
    timer = null;
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

let currentSlide = 0;
const maxSlides = 2;
const slideWidth = 310;

$('carouselPrev').addEventListener('click', () => slideCarousel(-1));
$('carouselNext').addEventListener('click', () => slideCarousel(1));

function slideCarousel(direction) {
  currentSlide = Math.min(maxSlides, Math.max(0, currentSlide + direction));
  $('carouselTrack').style.transform = `translateX(-${currentSlide * slideWidth}px)`;
}

let calcMode = 'SIP';
let chartInstance = null;

$('calcTabSip').addEventListener('click', () => setCalcMode('SIP'));
$('calcTabLump').addEventListener('click', () => setCalcMode('LUMPSUM'));
['sliderAmount', 'sliderRate', 'sliderTenure'].forEach((id) => $(id).addEventListener('input', updateCalculators));

function setCalcMode(mode) {
  calcMode = mode;
  const slider = $('sliderAmount');
  const isSip = mode === 'SIP';

  $('calcTabSip').classList.toggle('active', isSip);
  $('calcTabLump').classList.toggle('active', !isSip);
  $('labelInvestment').textContent = isSip ? 'Monthly Investment Amount' : 'One-Time Lump Sum Amount';
  $('amountMaxLabel').textContent = isSip ? '₹2,00,000' : '₹25,00,000';

  slider.max = isSip ? 200000 : 2500000;
  slider.step = isSip ? 500 : 5000;
  slider.value = isSip ? 10000 : 100000;

  updateCalculators();
}

function updateCalculators() {
  const amount = parseFloat($('sliderAmount').value);
  const rate = parseFloat($('sliderRate').value);
  const tenure = parseFloat($('sliderTenure').value);

  $('dispInvestAmount').textContent = formatINR(amount);
  $('dispReturnRate').textContent = rate.toFixed(1) + '%';
  $('dispTenure').textContent = tenure + (tenure === 1 ? ' Year' : ' Years');

  let invested;
  let total;

  if (calcMode === 'SIP') {
    const monthlyRate = rate / 100 / 12;
    const months = tenure * 12;
    invested = amount * months;
    total = amount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate);
  } else {
    invested = amount;
    total = amount * Math.pow(1 + rate / 100, tenure);
  }

  const gains = Math.max(0, total - invested);

  $('resInvested').textContent = formatINR(invested);
  $('resGains').textContent = formatINR(gains);
  $('resTotal').textContent = formatINR(total);

  if (chartInstance) {
    chartInstance.data.datasets[0].data = [invested, gains];
    chartInstance.update();
  }
}

function initCalculatorChart() {
  chartInstance = new Chart($('calculatorChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Invested Capital', 'Est. Returns'],
      datasets: [{
        data: [1200000, 1323391],
        backgroundColor: ['#cbd5e1', '#10b981'],
        borderWidth: 0,
        hoverOffset: 3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.label + ': ' + formatINR(ctx.raw) } }
      }
    }
  });
}

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
    enquiry.resendBtn.disabled = true;
    enquiry.resendBtn.textContent = `Resend OTP (${left}s)`;
  },
  () => {
    enquiry.resendBtn.textContent = 'Resend OTP';
    enquiry.resendBtn.disabled = enquiry.verified;
  }
);

function setEnquiryStatus(text, type = '') {
  enquiry.status.textContent = text;
  enquiry.status.className = 'enquiry-otp-status' + (type ? ' ' + type : '');
}

function resetEnquiryOtp() {
  enquiryCooldown.stop();
  enquiry.verified = false;
  enquiry.block.classList.remove('show');
  enquiry.code.value = '';
  enquiry.code.disabled = true;
  enquiry.code.readOnly = false;
  enquiry.phone.readOnly = false;
  enquiry.verifyBtn.hidden = true;
  enquiry.verifyBtn.disabled = false;
  enquiry.resendBtn.disabled = true;
  enquiry.resendBtn.textContent = 'Resend OTP';
  enquiry.sendBtn.disabled = false;
  enquiry.submit.disabled = true;
  enquiry.submit.textContent = 'Submit Enquiry';
  setEnquiryStatus('');
}

async function requestEnquiryOtp(url, isResend) {
  const phone = enquiry.phone.value.trim();

  if (!/^\d{10}$/.test(phone)) {
    enquiry.block.classList.add('show');
    setEnquiryStatus('Enter a valid 10-digit phone number first.', 'err');
    return;
  }

  const token = getCaptchaToken('enquiryCaptcha');
  if (!token) {
    enquiry.block.classList.add('show');
    setEnquiryStatus('Complete the CAPTCHA first.', 'err');
    return;
  }

  enquiry.sendBtn.disabled = true;
  enquiry.resendBtn.disabled = true;
  const res = await postJSON(url, { phone, captcha_token: token });
  resetCaptcha('enquiryCaptcha');

  if (!res.ok) {
    enquiry.sendBtn.disabled = isResend;
    enquiry.resendBtn.disabled = !isResend;
    enquiry.block.classList.add('show');
    setEnquiryStatus(apiMessage(res, 'Could not send OTP. Try again.'), 'err');
    return;
  }

  enquiry.code.value = '';
  enquiry.code.disabled = false;
  enquiry.verifyBtn.hidden = true;
  enquiry.block.classList.add('show');
  enquiry.code.focus();
  setEnquiryStatus(isResend ? 'OTP resent.' : 'OTP sent to your phone.', 'ok');
  enquiryCooldown.start();
}

async function verifyEnquiryOtp() {
  const otp = enquiry.code.value.trim();
  if (!otp) return;

  enquiry.verifyBtn.disabled = true;
  const res = await postJSON(API.verify, { phone: enquiry.phone.value.trim(), otp });

  if (!res.ok) {
    enquiry.verifyBtn.disabled = false;
    setEnquiryStatus(apiMessage(res, 'Incorrect OTP. Please try again.'), 'err');
    return;
  }

  enquiry.verified = true;
  enquiryCooldown.stop();
  enquiry.resendBtn.textContent = 'Resend OTP';
  enquiry.resendBtn.disabled = true;
  enquiry.code.readOnly = true;
  enquiry.phone.readOnly = true;
  enquiry.verifyBtn.hidden = true;
  enquiry.verifyBtn.disabled = false;
  enquiry.submit.disabled = false;
  setEnquiryStatus('Phone number verified.', 'ok');
}

enquiry.sendBtn.addEventListener('click', () => requestEnquiryOtp(API.send, false));
enquiry.resendBtn.addEventListener('click', () => {
  if (!enquiryCooldown.running() && !enquiry.verified) requestEnquiryOtp(API.resend, true);
});
enquiry.verifyBtn.addEventListener('click', verifyEnquiryOtp);
enquiry.code.addEventListener('input', () => {
  enquiry.code.value = enquiry.code.value.replace(/\D/g, '');
  enquiry.verifyBtn.hidden = enquiry.verified || enquiry.code.value.length === 0;
});
enquiry.phone.addEventListener('input', () => {
  enquiry.phone.value = enquiry.phone.value.replace(/\D/g, '');
  if (enquiry.block.classList.contains('show')) resetEnquiryOtp();
});
enquiry.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!enquiry.verified) return;

  const payload = {
    name: $('enquiryName').value.trim(),
    phone: enquiry.phone.value.trim(),
    email: $('enquiryEmail').value.trim(),
    otp: enquiry.code.value.trim(),
    message: $('enquiryMessage').value.trim()
  };

  enquiry.submit.disabled = true;
  enquiry.submit.textContent = 'Submitting...';
  const res = await postJSON(API.enquiry, payload);
  enquiry.submit.textContent = 'Submit Enquiry';

  if (!res.ok) {
    enquiry.submit.disabled = false;
    setEnquiryStatus(apiMessage(res, 'Could not submit the enquiry. Try again.'), 'err');
    return;
  }

  alert('Thank you for reaching out to Qubrix Associates. Your enquiry has been submitted.');
  enquiry.form.reset();
  resetEnquiryOtp();
});

const modal = {
  overlay: $('phoneVerifyModal'),
  sendBtn: $('btnSendOtp'),
  resendBtn: $('btnResendOtp'),
  otpField: $('inputOtp'),
  statusMsg: $('otpStatusMsg'),
  submitStatus: $('otpSubmitStatus'),
  busy: false
};

const modalCooldown = makeCooldown(
  (left) => {
    modal.sendBtn.classList.add('btn-disabled');
    modal.resendBtn.classList.add('btn-disabled');
    modal.resendBtn.textContent = `Resend OTP (${left}s)`;
  },
  () => {
    modal.resendBtn.textContent = 'Resend OTP';
    modal.resendBtn.classList.remove('btn-disabled');
  }
);

function openPhoneVerifyModal() {
  modal.overlay.style.display = 'flex';
}

function closePhoneVerifyModal() {
  modal.overlay.style.display = 'none';
  resetVerificationForm();
}

function showModalStatus(el, type, html) {
  el.className = 'status-msg status-' + type;
  el.style.display = 'block';
  el.textContent = html;
}

async function requestModalOtp(url) {
  const first = $('inputFirstName').value.trim();
  const last = $('inputLastName').value.trim();
  const phone = $('inputPhone').value.trim();

  if (!first || !last || !/^\d{10}$/.test(phone)) {
    showModalStatus(modal.statusMsg, 'error', 'Please fill first name, last name and a valid 10-digit phone first.');
    return;
  }

  const token = getCaptchaToken('modalCaptcha');
  if (!token) {
    showModalStatus(modal.statusMsg, 'error', 'Complete the CAPTCHA first.');
    return;
  }

  modal.sendBtn.classList.add('btn-disabled');
  modal.resendBtn.classList.add('btn-disabled');
  const res = await postJSON(url, { phone, captcha_token: token });
  resetCaptcha('modalCaptcha');

  if (!res.ok) {
    modal.sendBtn.classList.remove('btn-disabled');
    if (!modalCooldown.running()) modal.resendBtn.classList.toggle('btn-disabled', modal.otpField.disabled);
    showModalStatus(modal.statusMsg, 'error', apiMessage(res, 'Could not send OTP. Try again.'));
    return;
  }

  showModalStatus(modal.statusMsg, 'success', 'OTP sent to your phone.');
  modal.otpField.value = '';
  modal.otpField.disabled = false;
  modal.otpField.focus();
  modalCooldown.start();
}

function triggerSendOtp() {
  requestModalOtp(API.send);
}

function resendOtp() {
  if (!modalCooldown.running()) requestModalOtp(API.resend);
}

async function handleOtpInput() {
  const value = modal.otpField.value.replace(/\D/g, '');
  modal.otpField.value = value;

  if (value.length !== 4) {
    modal.submitStatus.style.display = 'none';
    return;
  }

  if (modal.busy) return;
  modal.busy = true;
  showModalStatus(modal.submitStatus, 'success', 'Verifying OTP automatically...');

  const res = await postJSON(API.verify, { phone: $('inputPhone').value.trim(), otp: value });
  modal.busy = false;

  if (!res.ok) {
    showModalStatus(modal.submitStatus, 'error', apiMessage(res, 'Incorrect OTP code! Please try again.'));
    return;
  }

  modalCooldown.stop();
  $('verifyFormContainer').style.display = 'none';
  $('verifySuccessScreen').style.display = 'block';
  const fullName = $('inputFirstName').value + ' ' + $('inputLastName').value;
  $('successClientDetail').textContent =
    `Thank you, ${fullName} (${$('inputPhone').value}). Your mobile number has been authenticated with Qubrix Associates.`;
}

function resetVerificationForm() {
  modalCooldown.stop();
  modal.busy = false;
  $('otpVerifyForm').reset();
  modal.otpField.disabled = true;
  modal.statusMsg.style.display = 'none';
  modal.submitStatus.style.display = 'none';
  $('verifyFormContainer').style.display = 'block';
  $('verifySuccessScreen').style.display = 'none';
  modal.resendBtn.classList.add('btn-disabled');
  modal.resendBtn.textContent = 'Resend OTP';
  modal.sendBtn.classList.remove('btn-disabled');
}

$('heroVerifyBtn').addEventListener('click', openPhoneVerifyModal);
$('ctaVerifyBtn').addEventListener('click', openPhoneVerifyModal);
$('modalCloseBtn').addEventListener('click', closePhoneVerifyModal);
$('successDoneBtn').addEventListener('click', closePhoneVerifyModal);
modal.sendBtn.addEventListener('click', triggerSendOtp);
modal.resendBtn.addEventListener('click', resendOtp);
modal.otpField.addEventListener('input', handleOtpInput);
$('inputPhone').addEventListener('input', (e) => {
  e.target.value = e.target.value.replace(/\D/g, '');
});

window.addEventListener('DOMContentLoaded', () => {
  initCalculatorChart();
  updateCalculators();
  resetEnquiryOtp();
});

window.addEventListener('pageshow', resetEnquiryOtp);