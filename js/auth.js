// ==========================
// AUTHENTICATION SCRIPT
// ==========================

let userEmail = "";

// ==========================
// EMAIL FORM SUBMIT
// ==========================

document.getElementById("emailForm")?.addEventListener("submit", async function (e) {

    e.preventDefault();

    const emailInput = document.getElementById("emailInput");
    userEmail = emailInput.value.trim().toLowerCase();

    if (!userEmail) {
        showError("Email required");
        return;
    }

    if (!isValidEmail(userEmail)) {
        showError("Invalid email format");
        return;
    }

    showLoading();

    try {

        const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail })
        });

        const data = await res.json();

        hideLoading();

        // ✅ USER NOT REGISTERED
        if (data.notRegistered) {
            showError("Please register first");
            return;
        }

        // ✅ OTP FAILED
        if (!data.success) {
            showError("Failed to send OTP");
            return;
        }

        // ✅ SUCCESS
        document.getElementById("emailForm").classList.add("hidden");
        document.getElementById("otpForm").classList.remove("hidden");
        document.getElementById("displayEmail").textContent = userEmail;

        showToast("OTP Sent Successfully");

        document.querySelector(".otp-input")?.focus();

    } catch (err) {
        hideLoading();
        console.log("OTP ERROR:", err);
        showError("Server error");
    }
});


// ==========================
// OTP AUTO INPUT LOGIC
// ==========================

const otpInputs = document.querySelectorAll(".otp-input");

otpInputs.forEach((input, index) => {

    input.addEventListener("input", function () {

        if (this.value.length === 1 && index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
        }
    });

    input.addEventListener("keydown", function (e) {

        if (e.key === "Backspace" && this.value === "" && index > 0) {
            otpInputs[index - 1].focus();
        }
    });

    input.addEventListener("paste", function (e) {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, otpInputs.length - index);
        const digits = pasteData.split('');

        digits.forEach((digit, i) => {
            if (otpInputs[index + i]) {
                otpInputs[index + i].value = digit;
            }
        });

        // Focus the last filled input or the next one
        const focusIndex = Math.min(index + digits.length, otpInputs.length - 1);
        otpInputs[focusIndex].focus();
    });
});


// ==========================
// VERIFY OTP
// ==========================

document.getElementById("otpForm")?.addEventListener("submit", async function (e) {

    e.preventDefault();

    const otp = Array.from(otpInputs).map(input => input.value).join("");

    if (otp.length !== 6) {
        showError("Enter valid OTP");
        return;
    }

    showLoading();

    try {

        const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: userEmail,
                otp
            })
        });

        const data = await res.json();

        hideLoading();

        if (!data.token) {
            showError("Invalid OTP");
            return;
        }

        // ✅ SAVE LOGIN SESSION
        //  localStorage.setItem("token", data.token);
        async function mergeCart(token) {
            const localCart = JSON.parse(localStorage.getItem("cart") || "[]");

            if (!localCart.length) return;

            await fetch(`${API_BASE_URL}/cart/merge`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token
                },
                body: JSON.stringify({ localCart })
            });

            localStorage.removeItem("cart");
        }

        mergeCart(data.token);
        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", userEmail);

        showToast("Login Successful");

        setTimeout(() => {
            if (data.isProfileComplete) {
                window.location.href = "index.html";
            } else {
                window.location.href = "profile.html";
            }
        }, 1000);

    } catch (err) {
        hideLoading();
        console.log("VERIFY ERROR:", err);
        showError("Server error");
    }
});


// ==========================
// RESEND OTP
// ==========================

document.getElementById("resendBtn")?.addEventListener("click", async function () {

    if (!userEmail) return;

    showLoading();

    try {

        const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userEmail })
        });

        const data = await res.json();

        hideLoading();

        if (data.success) {
            showToast("OTP Resent");
        } else {
            showError("Failed to resend OTP");
        }

    } catch (err) {
        hideLoading();
        console.log(err);
        showError("Server error");
    }
});


// ==========================
// CHANGE EMAIL
// ==========================

document.getElementById("changeEmailBtn")?.addEventListener("click", function () {

    document.getElementById("otpForm").classList.add("hidden");
    document.getElementById("emailForm").classList.remove("hidden");

    otpInputs.forEach(input => input.value = "");

    document.getElementById("emailInput").value = "";
});


// ==========================
// UTILITIES
// ==========================

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showLoading() {
    document.getElementById("loadingSpinner")?.classList.remove("hidden");
}

function hideLoading() {
    document.getElementById("loadingSpinner")?.classList.add("hidden");
}