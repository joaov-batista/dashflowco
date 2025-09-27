import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, fetchSignInMethodsForEmail } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { showNotification } from './main.js';

// --- Elementos do DOM ---
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleButton = document.getElementById('toggle-auth-mode');
const authTitle = document.getElementById('auth-title');
const phoneInput = document.getElementById('register-phone');

// --- Máscara de Telefone ---
phoneInput.addEventListener('input', (e) => {
    let value = e.target.value.replace(/\D/g, '');
    value = value.substring(0, 11);
    if (value.length > 6) { value = value.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3'); }
    else if (value.length > 2) { value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2'); }
    else if (value.length > 0) { value = value.replace(/^(\d*)/, '($1'); }
    e.target.value = value;
});

// --- Funções de Validação e Cálculo ---
function calculateAge(dobString) {
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

async function validateRegistration(data) {
    const errors = [];
    const { name, email, password, userFunction, dob, phone, address, inviteCode } = data;

    // --- NOVA VALIDAÇÃO ---
    // Verifica se algum campo está vazio
    if (!name || !email || !password || !userFunction || !dob || !phone || !address || !inviteCode) {
        errors.push("Todos os campos são obrigatórios.");
        return errors; // Retorna imediatamente se algum campo estiver vazio
    }

    // Validações específicas
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push("Formato de e-mail inválido.");
    } else {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        if (methods.length > 0) {
            errors.push("Este e-mail já está em uso.");
        }
    }

    if (password.length > 8) {
        errors.push("A senha deve ter no máximo 8 caracteres.");
    }

    const age = calculateAge(dob);
    if (age < 5 || age > 100) {
        errors.push("Idade inválida. Deve ser entre 5 e 100 anos.");
    }

    if (name.length < 3 || !/\D/.test(name)) { errors.push("Nome inválido. Deve ter pelo menos 3 letras."); }
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) { errors.push("Número de telefone inválido."); }

    return errors;
}

// --- Event Listeners ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm['login-email'].value.trim();
    const password = loginForm['login-password'].value;
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            showNotification("Verificação Pendente", "Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada e spam.");
            await signOut(auth);
            return;
        }
        window.location.href = 'app.html';
    } catch (error) {
        showNotification("Erro de Login", "E-mail ou senha inválidos.");
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitButton = registerForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Registando...';
    
    const formData = {
        name: registerForm['register-name'].value.trim(),
        email: registerForm['register-email'].value.trim(),
        password: registerForm['register-password'].value,
        userFunction: registerForm['register-function'].value.trim(),
        dob: registerForm['register-dob'].value,
        phone: registerForm['register-phone'].value.trim(),
        address: registerForm['register-address'].value.trim(),
        inviteCode: registerForm['register-invite-code'].value.trim()
    };

    const validationErrors = await validateRegistration(formData);
    if (validationErrors.length > 0) {
        showNotification("Erro de Registro", validationErrors[0]);
        submitButton.disabled = false;
        submitButton.textContent = 'Registar na Equipe';
        return;
    }

    try {
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where("inviteCode", "==", formData.inviteCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showNotification("Erro de Registro", "Código de convite inválido.");
            throw new Error("Código inválido");
        }
        
        const teamId = querySnapshot.docs[0].id;
        
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
        const user = userCredential.user;
        
        await sendEmailVerification(user);

        const age = calculateAge(formData.dob);

        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            displayName: formData.name,
            email: user.email,
            role: 'funcionário',
            function: formData.userFunction,
            dob: formData.dob,
            age: age,
            phone: formData.phone,
            address: formData.address,
            teamId,
            status: 'Offline',
            createdAt: serverTimestamp()
        });
        
        showNotification("Registro Quase Completo!", "Enviamos um e-mail de verificação para sua conta. Por favor, verifique sua caixa de entrada e também a pasta de SPAM para ativar seu acesso.");
        
        registerForm.reset();
        toggleButton.click();
        
    } catch (error) {
        console.error("Register error:", error);
        if (!error.message.includes("Código inválido")) {
           showNotification("Erro de Registro", "Não foi possível criar a conta. Tente novamente.");
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Registar na Equipe';
    }
});

toggleButton.addEventListener('click', () => {
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
    const isLogin = !loginForm.classList.contains('hidden');
    authTitle.textContent = isLogin ? 'Login' : 'Registo';
    toggleButton.textContent = isLogin ? 'Não tem uma conta? Registe-se' : 'Já tem uma conta? Faça login';
});