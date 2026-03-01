var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    const profileEmail = document.getElementById('profileEmail');
    const profileName = document.getElementById('profileName');
    const profilePhone = document.getElementById('profilePhone');
    const profileWhatsapp = document.getElementById('profileWhatsapp');
    const profilePincode = document.getElementById('profilePincode');
    const pincodeStatusDot = document.getElementById('pincodeStatusDot');
    const pincodeStatusText = document.getElementById('pincodeStatusText');
    const pincodeError = document.getElementById('pincodeError');
    const addrLine1 = document.getElementById('addrLine1');
    const addrLine2 = document.getElementById('addrLine2');
    const addrCity = document.getElementById('addrCity');
    const addrState = document.getElementById('addrState');
    const addrTypeInput = document.getElementById('addrType');
    const sameAsPhone = document.getElementById('sameAsPhone');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const phoneError = document.getElementById('phoneError');
    const whatsappError = document.getElementById('whatsappError');

    // ── Pin Code helpers ──────────────────────────────────────────────
    function setPincodeStatus(state, text) {
        pincodeError.classList.add('hidden');
        pincodeStatusDot.className = 'w-2.5 h-2.5 rounded-full flex-shrink-0';
        if (state === 'idle') {
            pincodeStatusDot.classList.add('bg-gray-300');
            pincodeStatusText.textContent = text || 'Awaiting PIN';
        } else if (state === 'loading') {
            pincodeStatusDot.classList.add('bg-yellow-400', 'animate-pulse');
            pincodeStatusText.textContent = 'Fetching...';
        } else if (state === 'success') {
            pincodeStatusDot.classList.add('bg-green-500');
            pincodeStatusText.textContent = text;
        } else if (state === 'error') {
            pincodeStatusDot.classList.add('bg-red-400');
            pincodeStatusText.textContent = 'Invalid PIN';
            pincodeError.classList.remove('hidden');
        }
    }

    function setCityStateLocked(lock) {
        [addrCity, addrState].forEach(el => {
            if (lock) {
                el.readOnly = true;
                el.classList.add('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
            } else {
                el.readOnly = false;
                el.classList.remove('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
            }
        });
    }

    async function fetchPincodeData(pin) {
        setPincodeStatus('loading');
        try {
            const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
            const data = await res.json();
            if (data[0].Status === 'Success' && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const po = data[0].PostOffice[0];
                const district = po.District;
                const state = po.State;
                addrCity.value = district;
                addrState.value = state;
                setCityStateLocked(true);
                setPincodeStatus('success', `${district}`);
                // store district on the input for payload use
                profilePincode.dataset.district = district;
                profilePincode.dataset.state = state;
            } else {
                addrCity.value = '';
                addrState.value = '';
                setCityStateLocked(false);
                setPincodeStatus('error');
                profilePincode.dataset.district = '';
                profilePincode.dataset.state = '';
            }
        } catch (err) {
            setPincodeStatus('error');
        }
    }

    // Digit-only guard + auto-trigger on 6th digit
    profilePincode.addEventListener('keypress', (e) => {
        if (!/^\d$/.test(e.key)) e.preventDefault();
    });

    profilePincode.addEventListener('input', () => {
        const val = profilePincode.value.replace(/\D/g, '');
        profilePincode.value = val;
        if (val.length === 6) {
            fetchPincodeData(val);
        } else {
            setPincodeStatus('idle', val.length > 0 ? `${val.length}/6 digits` : 'Awaiting PIN');
            if (val.length < 6) {
                addrCity.value = '';
                addrState.value = '';
                setCityStateLocked(false);
                profilePincode.dataset.district = '';
                profilePincode.dataset.state = '';
            }
        }
    });
    // ─────────────────────────────────────────────────────────────────

    // Address Type Toggle
    document.querySelectorAll('.addr-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.addr-type-btn').forEach(b => {
                b.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
                b.classList.add('border-gray-200', 'text-gray-500');
            });
            btn.classList.add('border-primary', 'bg-primary/5', 'text-primary');
            btn.classList.remove('border-gray-200', 'text-gray-500');
            addrTypeInput.value = btn.dataset.value;
        });
    });

    // 1. Initial State: Populate From Server
    const userEmail = localStorage.getItem('userEmail');
    const token = localStorage.getItem('token');

    if (userEmail) {
        profileEmail.value = userEmail;
    }

    async function loadProfile() {
        if (!token) return;
        try {
            const users = await apiFetch('/users');
            const currentUser = users.find(u => u.email === userEmail);
            if (currentUser) {
                profileName.value = currentUser.name || '';
                profilePhone.value = currentUser.phone || '';
                profileWhatsapp.value = currentUser.whatsapp || '';

                // Populate structured address
                const addr = currentUser.address || {};
                addrLine1.value = addr.line1 || '';
                addrLine2.value = addr.line2 || '';
                // Restore pincode and lock city/state if present
                if (addr.pincode) {
                    profilePincode.value = addr.pincode;
                    profilePincode.dataset.district = addr.district || '';
                    profilePincode.dataset.state = addr.state || '';
                    addrCity.value = addr.city || '';
                    addrState.value = addr.state || '';
                    if (addr.district) {
                        setCityStateLocked(true);
                        setPincodeStatus('success', addr.district);
                    }
                } else {
                    addrCity.value = addr.city || '';
                    addrState.value = addr.state || '';
                }

                // Restore address type toggle
                const savedType = addr.type || 'home';
                addrTypeInput.value = savedType;
                document.querySelectorAll('.addr-type-btn').forEach(b => {
                    if (b.dataset.value === savedType) {
                        b.classList.add('border-primary', 'bg-primary/5', 'text-primary');
                        b.classList.remove('border-gray-200', 'text-gray-500');
                    } else {
                        b.classList.remove('border-primary', 'bg-primary/5', 'text-primary');
                        b.classList.add('border-gray-200', 'text-gray-500');
                    }
                });

                if (currentUser.whatsapp === currentUser.phone && currentUser.phone) {
                    sameAsPhone.checked = true;
                    profileWhatsapp.readOnly = true;
                    profileWhatsapp.classList.add('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
                }
            }
        } catch (error) {
            console.error('Load Profile Error:', error);
        }
    }

    loadProfile();

    // 2. WhatsApp "Same as Phone" Logic
    sameAsPhone.addEventListener('change', () => {
        if (sameAsPhone.checked) {
            profileWhatsapp.value = profilePhone.value;
            profileWhatsapp.readOnly = true;
            profileWhatsapp.classList.add('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
        } else {
            profileWhatsapp.readOnly = false;
            profileWhatsapp.classList.remove('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
        }
    });

    profilePhone.addEventListener('input', () => {
        // Numeric only
        profilePhone.value = profilePhone.value.replace(/\D/g, '').slice(0, 10);

        const isValid = profilePhone.value.length === 10;
        if (profilePhone.value.length > 0 && !isValid) {
            phoneError.classList.remove('hidden');
            profilePhone.classList.add('border-red-500');
        } else {
            phoneError.classList.add('hidden');
            profilePhone.classList.remove('border-red-500');
        }

        if (sameAsPhone.checked) {
            profileWhatsapp.value = profilePhone.value;
            // Also trigger whatsapp validation
            profileWhatsapp.dispatchEvent(new Event('input'));
        }
    });

    profileWhatsapp.addEventListener('input', () => {
        // Numeric only
        profileWhatsapp.value = profileWhatsapp.value.replace(/\D/g, '').slice(0, 10);

        const isValid = profileWhatsapp.value.length === 10;
        if (profileWhatsapp.value.length > 0 && !isValid) {
            whatsappError.classList.remove('hidden');
            profileWhatsapp.classList.add('border-red-500');
        } else {
            whatsappError.classList.add('hidden');
            profileWhatsapp.classList.remove('border-red-500');
        }
    });

    // 3. Email Change Modal Logic
    const emailModal = document.getElementById('emailModal');
    const emailStep1 = document.getElementById('emailStep1');
    const emailStep2 = document.getElementById('emailStep2');
    const newEmailInput = document.getElementById('newEmailInput');
    const sendEmailOtpBtn = document.getElementById('sendEmailOtpBtn');
    const verifyEmailBtn = document.getElementById('verifyEmailBtn');
    const otpErrorMsg = document.getElementById('otpErrorMsg');
    const targetNewEmail = document.getElementById('targetNewEmail');
    const emailOtpInputs = document.querySelectorAll('.email-otp-input');

    let attempts = 0;

    window.openEmailModal = () => {
        emailModal.classList.remove('hidden');
        emailStep1.classList.remove('hidden');
        emailStep2.classList.add('hidden');
        newEmailInput.value = '';
        attempts = 0;
    };

    window.closeEmailModal = () => {
        emailModal.classList.add('hidden');
    };

    window.backToStep1 = () => {
        emailStep1.classList.remove('hidden');
        emailStep2.classList.add('hidden');
        attempts = 0;
    };

    document.getElementById('changeEmailBtn').addEventListener('click', openEmailModal);

    // OTP Input Logic for Email Change
    emailOtpInputs.forEach((input, index) => {
        input.addEventListener('input', function () {
            if (this.value.length === 1 && index < emailOtpInputs.length - 1) {
                emailOtpInputs[index + 1].focus();
            }
        });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Backspace' && this.value === '' && index > 0) {
                emailOtpInputs[index - 1].focus();
            }
        });
    });

    sendEmailOtpBtn.addEventListener('click', async () => {
        const newEmail = newEmailInput.value.trim();
        if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            showModalAlert('Please enter a valid email address.', 'error');
            return;
        }

        sendEmailOtpBtn.disabled = true;
        sendEmailOtpBtn.innerText = 'Sending...';

        try {
            const res = await fetch(`${API_BASE_URL}/auth/send-email-change-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newEmail })
            });
            const data = await res.json();

            if (data.success) {
                targetNewEmail.innerText = newEmail;
                emailStep1.classList.add('hidden');
                emailStep2.classList.remove('hidden');
                emailOtpInputs[0].focus();
            } else {
                showModalAlert(data.message || 'Failed to send OTP.', 'error');
            }
        } catch (error) {
            console.error('Send OTP Error:', error);
            showModalAlert('Error connecting to server.', 'error');
        } finally {
            sendEmailOtpBtn.disabled = false;
            sendEmailOtpBtn.innerText = 'Send OTP';
        }
    });

    verifyEmailBtn.addEventListener('click', async () => {
        const otp = Array.from(emailOtpInputs).map(i => i.value).join('');
        if (otp.length !== 6) return;

        verifyEmailBtn.disabled = true;
        otpErrorMsg.classList.add('hidden');

        try {
            const res = await fetch(`${API_BASE_URL}/auth/verify-email-change-otp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ otp })
            });
            const data = await res.json();

            if (data.success) {
                showModalAlert('Email changed successfully!', 'success');
                profileEmail.value = data.newEmail;
                localStorage.setItem('userEmail', data.newEmail);
                closeEmailModal();
            } else {
                attempts++;
                if (data.locked || attempts >= 3) {
                    showModalAlert('OTP expired or too many attempts. Please request a new one.', 'error');
                    closeEmailModal();
                } else {
                    otpErrorMsg.innerText = `Incorrect OTP. ${3 - attempts} attempts left.`;
                    otpErrorMsg.classList.remove('hidden');
                    emailOtpInputs.forEach(i => i.value = '');
                    emailOtpInputs[0].focus();
                }
            }
        } catch (error) {
            console.error('Verify OTP Error:', error);
            showModalAlert('Error connecting to server.', 'error');
        } finally {
            verifyEmailBtn.disabled = false;
        }
    });

    // 4. Form Submission
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const token = localStorage.getItem('token');
        if (!token) {
            showModalAlert('Session expired. Please login again.', 'info');
            window.location.href = 'login.html';
            return;
        }

        // Show loading
        loadingOverlay.classList.remove('hidden');

        // Validation
        const phone = profilePhone.value.replace(/\D/g, '');
        const whatsapp = profileWhatsapp.value.replace(/\D/g, '');

        if (phone.length !== 10) {
            showModalAlert('Please enter a valid 10-digit phone number.', 'error');
            loadingOverlay.classList.add('hidden');
            profilePhone.focus();
            return;
        }

        if (whatsapp.length !== 10) {
            showModalAlert('Please enter a valid 10-digit WhatsApp number.', 'error');
            loadingOverlay.classList.add('hidden');
            profileWhatsapp.focus();
            return;
        }

        if (profilePincode.value.length !== 6) {
            showModalAlert('Please enter a valid 6-digit pin code.', 'error');
            loadingOverlay.classList.add('hidden');
            profilePincode.focus();
            return;
        }

        try {
            // Fetch current user properly to get ID
            const usersRes = await fetch(`${API_BASE_URL}/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!usersRes.ok) throw new Error(`Server returned ${usersRes.status}`);
            const users = await usersRes.json();
            const email = localStorage.getItem('userEmail');
            const currentUser = users.find(u => u.email === email);

            if (!currentUser) throw new Error('User not found');

            const profileData = {
                name: profileName.value.trim(),
                phone: profilePhone.value.trim(),
                whatsapp: profileWhatsapp.value.trim(),
                address: {
                    line1: addrLine1.value.trim(),
                    line2: addrLine2.value.trim(),
                    pincode: profilePincode.value.trim(),
                    district: profilePincode.dataset.district || '',
                    city: addrCity.value.trim(),
                    state: addrState.value.trim(),
                    type: addrTypeInput.value
                }
            };

            const updateRes = await fetch(`${API_BASE_URL}/users/${currentUser._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(profileData)
            });

            if (!updateRes.ok) throw new Error('Failed to update profile');

            // Success
            showModalAlert('Profile updated successfully!', 'success');
            window.location.href = 'index.html';

        } catch (error) {
            console.error('Profile Error:', error);
            showModalAlert('Error saving profile. Please try again.', 'error');
        } finally {
            loadingOverlay.classList.add('hidden');
        }
    });
});
