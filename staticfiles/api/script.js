const RESEND_DELAY = 30;

const $ = (id) => document.getElementById(id);

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
  phone: $('enquiryPhone'),
  sendBtn: $('enquirySendBtn'),
  resendBtn: $('enquiryResendBtn'),
  block: $('enquiryOtpBlock'),
  code: $('enquiryCode'),
  verifyBtn: $('enquiryVerifyBtn'),
  status: $('enquiryOtpStatus'),
  submit: $('enquirySubmit'),
  otp: null,
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
  enquiry.otp = null;
  enquiry.verified = false;
  enquiry.block.classList.remove('show');
  enquiry.code.value = '';
  enquiry.code.disabled = true;
  enquiry.verifyBtn.disabled = true;
  enquiry.resendBtn.disabled = true;
  enquiry.resendBtn.textContent = 'Resend OTP';
  enquiry.sendBtn.disabled = false;
  enquiry.submit.disabled = true;
  enquiry.phone.readOnly = false;
  setEnquiryStatus('');
}

function issueEnquiryOtp() {
  enquiry.otp = Math.floor(100000 + Math.random() * 900000).toString();
  enquiry.code.value = '';
  enquiry.code.disabled = false;
  enquiry.verifyBtn.disabled = false;
  enquiry.block.classList.add('show');
  enquiry.code.focus();
  setEnquiryStatus('Demo OTP: ' + enquiry.otp, 'ok');
  enquiryCooldown.start();
}

function sendEnquiryOtp() {
  if (!/^\d{10}$/.test(enquiry.phone.value.trim())) {
    setEnquiryStatus('Enter a valid 10-digit phone number first.', 'err');
    enquiry.block.classList.add('show');
    return;
  }
  enquiry.sendBtn.disabled = true;
  issueEnquiryOtp();
}

function resendEnquiryOtp() {
  if (enquiryCooldown.running() || enquiry.verified) return;
  issueEnquiryOtp();
}

function verifyEnquiryOtp() {
  const entered = enquiry.code.value.trim();
  if (!enquiry.otp || entered !== enquiry.otp) {
    setEnquiryStatus('Incorrect OTP. Please try again.', 'err');
    return;
  }
  enquiry.verified = true;
  enquiryCooldown.stop();
  enquiry.resendBtn.disabled = true;
  enquiry.resendBtn.textContent = 'Resend OTP';
  enquiry.code.disabled = true;
  enquiry.verifyBtn.disabled = true;
  enquiry.phone.readOnly = true;
  enquiry.submit.disabled = false;
  setEnquiryStatus('Phone number verified.', 'ok');
}

function handleEnquirySubmit(event) {
  event.preventDefault();
  if (!enquiry.verified) return;
  alert('Thank you for reaching out to Qubrix Associates. Your enquiry has been submitted.');
  event.target.reset();
  resetEnquiryOtp();
}

enquiry.sendBtn.addEventListener('click', sendEnquiryOtp);
enquiry.resendBtn.addEventListener('click', resendEnquiryOtp);
enquiry.verifyBtn.addEventListener('click', verifyEnquiryOtp);
enquiry.phone.addEventListener('input', () => {
  enquiry.phone.value = enquiry.phone.value.replace(/\D/g, '');
  if (enquiry.otp !== null || enquiry.block.classList.contains('show')) resetEnquiryOtp();
});
$('enquiryForm').addEventListener('submit', handleEnquirySubmit);

const modal = {
  overlay: $('phoneVerifyModal'),
  sendBtn: $('btnSendOtp'),
  resendBtn: $('btnResendOtp'),
  otpField: $('inputOtp'),
  statusMsg: $('otpStatusMsg'),
  submitStatus: $('otpSubmitStatus'),
  otp: null
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
  el.innerHTML = html;
}

function triggerSendOtp() {
  const first = $('inputFirstName').value.trim();
  const last = $('inputLastName').value.trim();
  const phone = $('inputPhone').value.trim();

  if (!first || !last || !/^\d{10}$/.test(phone)) {
    showModalStatus(modal.statusMsg, 'error', 'Please fill first name, last name and a valid 10-digit phone first.');
    return;
  }

  modal.otp = Math.floor(1000 + Math.random() * 9000).toString();
  showModalStatus(modal.statusMsg, 'success', `OTP sent successfully! <strong>(Demo OTP: ${modal.otp})</strong>`);

  modal.otpField.value = '';
  modal.otpField.disabled = false;
  modal.otpField.focus();
  modalCooldown.start();
}

function resendOtp() {
  if (!modalCooldown.running()) triggerSendOtp();
}

function handleOtpInput() {
  const value = modal.otpField.value.trim();

  if (value.length !== 4) {
    modal.submitStatus.style.display = 'none';
    return;
  }

  showModalStatus(modal.submitStatus, 'success', 'Verifying OTP automatically...');

  setTimeout(() => {
    if (value === modal.otp) {
      modalCooldown.stop();
      $('verifyFormContainer').style.display = 'none';
      $('verifySuccessScreen').style.display = 'block';
      const fullName = $('inputFirstName').value + ' ' + $('inputLastName').value;
      $('successClientDetail').textContent =
        `Thank you, ${fullName} (${$('inputPhone').value}). Your mobile number has been authenticated with Qubrix Associates.`;
    } else {
      showModalStatus(modal.submitStatus, 'error', 'Incorrect OTP code! Please try again.');
    }
  }, 500);
}

function resetVerificationForm() {
  modalCooldown.stop();
  modal.otp = null;
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
