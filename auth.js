import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { collection, query, where, getDocs, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { showNotification } from './main.js'; 

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const toggleButton = document.getElementById('toggle-auth-mode');
const authTitle = document.getElementById('auth-title');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    sessionStorage.clear(); 
    const email = loginForm['login-email'].value;
    const password = loginForm['login-password'].value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        window.location.href = 'quadro.html';
    } catch (error) {
        console.error("Login error:", error);
        showNotification("Erro de Login", "Email ou senha inválidos. Por favor, tente novamente.");
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = registerForm['register-name'].value;
    const email = registerForm['register-email'].value;
    const password = registerForm['register-password'].value;
    const userFunction = registerForm['register-function'].value;
    const age = registerForm['register-age'].value;
    const phone = registerForm['register-phone'].value;
    const address = registerForm['register-address'].value;
    const inviteCode = registerForm['register-invite-code'].value.trim();

    if (!name || !email || !password || !inviteCode) {
        showNotification("Erro de Registro", "Por favor, preencha todos os campos obrigatórios.");
        return;
    }
     if (password.length < 6) {
        showNotification("Erro de Registro", "A senha precisa ter no mínimo 6 caracteres.");
        return;
    }

    try {
        const teamsRef = collection(db, 'teams');
        const q = query(teamsRef, where("inviteCode", "==", inviteCode));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showNotification("Erro de Registro", "Código de convite inválido.");
            return;
        }
        
        const teamId = querySnapshot.docs[0].id;
        
        // Lógica de "primeiro usuário vira admin" foi REMOVIDA para evitar erros de permissão.
        // O primeiro usuário deve ser promovido a admin manualmente.
        const userRole = 'funcionário';

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid, displayName: name, email: user.email, role: userRole,
            function: userFunction, age, phone, address, teamId, status: 'Offline'
        });
        
        window.location.href = 'quadro.html';

    } catch (error) {
        console.error("Register error:", error);
        if (error.code === 'auth/email-already-in-use') {
            showNotification("Erro de Registro", "Este email já está em uso.");
        } else {
            showNotification("Erro de Registro", "Não foi possível criar a conta. Verifique os dados e tente novamente.");
        }
    }
});

toggleButton.addEventListener('click', () => {
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
    const isLogin = !loginForm.classList.contains('hidden');
    authTitle.textContent = isLogin ? 'Login' : 'Registo';
    toggleButton.textContent = isLogin ? 'Não tem uma conta? Registe-se' : 'Já tem uma conta? Faça login';
});