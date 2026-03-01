var API_BASE_URL = window.API_BASE_URL || 'https://gen-z-backend.vercel.app/api';

const sendBtn = document.getElementById("sendOtpBtn");
const verifyBtn = document.getElementById("verifyBtn");
const otpSection = document.getElementById("otpSection");
const otpInputs = document.querySelectorAll(".otp-input");


const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const phoneInput = document.getElementById("phone");

/* ---------------- VALIDATION ---------------- */

function validateName(name) {
    return /^[A-Za-z ]{3,}$/.test(name);
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone) {
    return /^[6-9]\d{9}$/.test(phone);
}

/* ---------------- OTP AUTO MOVE ---------------- */

otpInputs.forEach((input, i) => {
    input.addEventListener("input", () => {
        if (input.value && i < otpInputs.length - 1)
            otpInputs[i + 1].focus();

        checkVerifyState();
    });
});

/* ---------------- INPUT VALIDATION UI ---------------- */

["name", "email", "phone"].forEach(id => {
    document.getElementById(id).addEventListener("input", checkFormState);
});

function checkFormState() {

    const email = emailInput.value.trim().toLowerCase();
    const phone = phoneInput.value.trim();

    /* ✅ Phone Restriction */
    phoneInput.value = phone.replace(/\D/g, "").slice(0, 10);

    /* ✅ Email Button Activation */
    if (validateEmail(email)) {
        sendBtn.classList.add("btn-active");
    } else {
        sendBtn.classList.remove("btn-active");
    }

    checkVerifyState();
}

/* ---------------- VERIFY BUTTON CONTROL ---------------- */

function getOTP() {
    return [...otpInputs].map(i => i.value).join("");
}

function checkVerifyState() {

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const phone = phoneInput.value.trim();
    const otp = getOTP();

    if (
        validateName(name) &&
        validateEmail(email) &&
        validatePhone(phone) &&
        otp.length === 6
    ) {

        verifyBtn.disabled = false;
        verifyBtn.classList.add("btn-active");

    } else {

        verifyBtn.disabled = true;
        verifyBtn.classList.remove("btn-active");

    }
}

/* ---------------- SEND OTP ---------------- */

sendBtn.addEventListener("click", async (e) => {

    e.preventDefault();

    const email = emailInput.value.trim().toLowerCase();

    if (!validateEmail(email))
        return showModalAlert("Enter valid email", "error");

    sendBtn.innerText = "Sending...";

    const res = await fetch(`${API_BASE_URL}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
    });

    const data = await res.json();

    sendBtn.innerText = "Send OTP";

    if (data.success) {

        otpSection.classList.remove("hidden");
        verifyBtn.classList.remove("hidden");

    } else showModalAlert("Error sending OTP", "error");
});

/* ---------------- VERIFY OTP ---------------- */

verifyBtn.addEventListener("click", async (e) => {

    e.preventDefault();

    verifyBtn.innerText = "Verifying...";

    const res = await fetch(`${API_BASE_URL}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: nameInput.value,
            email: emailInput.value,
            phone: phoneInput.value,
            otp: getOTP()
        })
    });

    const data = await res.json();

    verifyBtn.innerText = "Verify & Register";

    if (data.token) {

        localStorage.setItem("token", data.token);
        localStorage.setItem("userEmail", emailInput.value.trim().toLowerCase());

        verifyBtn.classList.add("btn-active");
        verifyBtn.disabled = false;

        setTimeout(() =>
            window.location.href = "index.html", 800);

    }
});