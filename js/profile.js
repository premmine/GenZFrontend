document.addEventListener('DOMContentLoaded', () => {
    const profileForm = document.getElementById('profileForm');
    const profileEmail = document.getElementById('profileEmail');
    const profileName = document.getElementById('profileName');
    const profilePhone = document.getElementById('profilePhone');
    const profileWhatsapp = document.getElementById('profileWhatsapp');
    const addrLine1 = document.getElementById('addrLine1');
    const addrLine2 = document.getElementById('addrLine2');
    const addrCity = document.getElementById('addrCity');
    const addrState = document.getElementById('addrState');
    const addrTypeInput = document.getElementById('addrType');
    const sameAsPhone = document.getElementById('sameAsPhone');
    const loadingOverlay = document.getElementById('loadingOverlay');

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
                addrCity.value = addr.city || '';
                addrState.value = addr.state || '';

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
        if (sameAsPhone.checked) {
            profileWhatsapp.value = profilePhone.value;
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
