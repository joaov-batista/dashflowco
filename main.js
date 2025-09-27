import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, writeBatch, getDocs, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { setupRouter } from './router.js';

export const AppState = {
    currentUser: null,
    teamInfo: null,
    authReady: false
};

const notificationModal = document.getElementById('notification-modal');
const notificationTitle = document.getElementById('notification-title');
const notificationMessage = document.getElementById('notification-message');
const notificationCloseBtn = document.getElementById('notification-close-btn');
const confirmationModal = document.getElementById('confirmation-modal');
const confirmationTitle = document.getElementById('confirmation-title');
const confirmationMessage = document.getElementById('confirmation-message');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const promptModal = document.getElementById('prompt-modal');
const promptTitle = document.getElementById('prompt-title');
const promptMessage = document.getElementById('prompt-message');
const promptInput = document.getElementById('prompt-input');
const promptOkBtn = document.getElementById('prompt-ok-btn');
const promptCancelBtn = document.getElementById('prompt-cancel-btn');

export function showNotification(title, message) {
    if (notificationModal && notificationTitle && notificationMessage) {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notificationModal.classList.remove('hidden');
    } else {
        alert(message);
    }
}
if (notificationCloseBtn) {
    notificationCloseBtn.addEventListener('click', () => {
        notificationModal.classList.add('hidden');
    });
}

export function showConfirmation(title, message) {
    return new Promise((resolve) => {
        if (confirmationModal && confirmationTitle && confirmationMessage) {
            confirmationTitle.textContent = title;
            confirmationMessage.textContent = message;
            confirmationModal.classList.remove('hidden');
            const handleYes = () => { cleanup(); resolve(true); };
            const handleNo = () => { cleanup(); resolve(false); };
            const cleanup = () => {
                confirmationModal.classList.add('hidden');
                confirmYesBtn.removeEventListener('click', handleYes);
                confirmCancelBtn.removeEventListener('click', handleNo);
            };
            confirmYesBtn.addEventListener('click', handleYes, { once: true });
            confirmCancelBtn.addEventListener('click', handleNo, { once: true });
        } else {
            resolve(confirm(message));
        }
    });
}

export function showPrompt(title, message, placeholder = '') {
    return new Promise((resolve) => {
        if (promptModal) {
            promptTitle.textContent = title;
            promptMessage.textContent = message;
            promptInput.value = '';
            promptInput.placeholder = placeholder;
            promptModal.classList.remove('hidden');
            promptInput.focus();
            const handleOk = () => { cleanup(); resolve(promptInput.value); };
            const handleCancel = () => { cleanup(); resolve(null); };
            const handleEnter = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleOk(); } };
            const cleanup = () => {
                promptModal.classList.add('hidden');
                promptOkBtn.removeEventListener('click', handleOk);
                promptCancelBtn.removeEventListener('click', handleCancel);
                promptInput.removeEventListener('keydown', handleEnter);
            };
            promptOkBtn.addEventListener('click', handleOk, { once: true });
            promptCancelBtn.addEventListener('click', handleCancel, { once: true });
            promptInput.addEventListener('keydown', handleEnter);
        } else {
            resolve(prompt(message));
        }
    });
}

export const initializeApp = () => {
    applyTheme();
    onAuthStateChanged(auth, async (user) => {
        const onAppPage = window.location.pathname.endsWith('app.html');
        const onAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';

        if (user) {
            if (onAuthPage) {
                window.location.href = '/app.html#/quadro';
                return;
            }

            const userDocRef = doc(db, 'users', user.uid);
            onSnapshot(userDocRef, async (userDocSnap) => {
                if (userDocSnap.exists()) {
                    AppState.currentUser = { uid: user.uid, ...userDocSnap.data() };
                    if (!AppState.teamInfo || AppState.teamInfo.id !== AppState.currentUser.teamId) {
                        const teamDocRef = doc(db, 'teams', AppState.currentUser.teamId);
                        const teamDocSnap = await getDoc(teamDocRef);
                        if (teamDocSnap.exists()) {
                            AppState.teamInfo = { id: teamDocSnap.id, ...teamDocSnap.data() };
                        }
                    }

                    if (!AppState.authReady) {
                        AppState.authReady = true;
                        setupGlobalUI();
                        setupThemeControls();
                        setupStatusControls();
                        setupSidebarToggle();
                        setupObservations();
                        setupRouter();
                        setupActivityTracker();
                    } else {
                        updateGlobalUI();
                    }
                } else {
                    handleSignOut();
                }
            });
        } else {
            if (onAppPage) {
                 window.location.href = '/index.html';
            }
        }
    });
};

function setupGlobalUI() {
    updateGlobalUI();
    const logoutButton = document.getElementById('logout-button');
    if (logoutButton) logoutButton.addEventListener('click', handleSignOut);
}

function updateGlobalUI() {
    const userNameDisplay = document.getElementById('user-display-name');
    const userFunctionDisplay = document.getElementById('user-function');

    if (AppState.currentUser) {
        if (userNameDisplay) {
            userNameDisplay.textContent = AppState.currentUser.displayName;
        }
        if (userFunctionDisplay) {
            const func = AppState.currentUser.function || '';
            userFunctionDisplay.textContent = func.charAt(0).toUpperCase() + func.slice(1);
        }
    }
}

function setupStatusControls() {
    const statusControls = document.getElementById('status-controls');
    if (!statusControls || !AppState.currentUser) return;
    const userDocRef = doc(db, 'users', AppState.currentUser.uid);
    onSnapshot(userDocRef, (docSnap) => {
        if(docSnap.exists()){
            const currentStatus = docSnap.data().status || 'Offline';
            if(AppState.currentUser) AppState.currentUser.status = currentStatus;
            statusControls.querySelectorAll('.status-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.status === currentStatus);
            });
            localStorage.setItem('userStatus', currentStatus);
        }
    });
    statusControls.addEventListener('click', (e) => {
        if (e.target.classList.contains('status-btn')) {
            const newStatus = e.target.dataset.status;
            updateUserStatus(newStatus);
        }
    });
}

async function updateUserStatus(status) {
    if (AppState.currentUser && AppState.currentUser.status !== status) {
        const previousStatus = AppState.currentUser.status;
        AppState.currentUser.status = status;
        localStorage.setItem('userStatus', status);
        const userDocRef = doc(db, 'users', AppState.currentUser.uid);
        
        await updateDoc(userDocRef, { status: status });

        const logRef = collection(db, 'users', AppState.currentUser.uid, 'logs');
        await addDoc(logRef, {
            timestamp: serverTimestamp(),
            status: status,
            previousStatus: previousStatus || 'N/A'
        });
    }
}

async function handleSignOut() {
    if (AppState.currentUser) {
        await updateUserStatus('Offline');
    }
    await signOut(auth);
}

function setupActivityTracker() {
    window.addEventListener('beforeunload', () => {
        if (AppState.currentUser && AppState.currentUser.status !== 'Offline') {
            updateUserStatus('Offline');
        }
    });
}


function setupSidebarToggle() {
    const toggleBtnDesktop = document.getElementById('toggle-sidebar-btn');
    const toggleBtnMobile = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.sidebar');
    const appWrapper = document.getElementById('app-wrapper');
    if (toggleBtnDesktop && appWrapper) {
        toggleBtnDesktop.addEventListener('click', () => {
            appWrapper.classList.toggle('sidebar-collapsed');
            const isCollapsed = appWrapper.classList.contains('sidebar-collapsed');
            toggleBtnDesktop.textContent = isCollapsed ? '»' : '«';
        });
    }
    if (toggleBtnMobile && sidebar) {
        toggleBtnMobile.addEventListener('click', (e) => {
            e.stopPropagation();
            sidebar.classList.toggle('is-open');
        });
    }
    document.body.addEventListener('click', (e) => {
        if (sidebar && sidebar.classList.contains('is-open') && !sidebar.contains(e.target) && !e.target.closest('#mobile-menu-btn')) {
            sidebar.classList.remove('is-open');
        }
    });
}

function applyTheme() {
    const savedTheme = localStorage.getItem('theme') || 'theme-default';
    const isAnimationPaused = localStorage.getItem('animationPaused') === 'true';
    document.body.className = '';
    document.body.classList.add(savedTheme);
    if (!isAnimationPaused) {
        document.body.classList.add('background-animation');
    }
}

function setupThemeControls() {
    const themeDefaultBtn = document.getElementById('theme-default');
    const themeLightBtn = document.getElementById('theme-light');
    const themeDarkBtn = document.getElementById('theme-dark');
    const toggleAnimationBtn = document.getElementById('toggle-animation-btn');
    themeDefaultBtn?.addEventListener('click', () => { localStorage.setItem('theme', 'theme-default'); applyTheme(); });
    themeLightBtn?.addEventListener('click', () => { localStorage.setItem('theme', 'theme-light'); applyTheme(); });
    themeDarkBtn?.addEventListener('click', () => { localStorage.setItem('theme', 'theme-dark'); applyTheme(); });
    toggleAnimationBtn?.addEventListener('click', () => {
        const isPaused = localStorage.getItem('animationPaused') === 'true';
        localStorage.setItem('animationPaused', String(!isPaused));
        applyTheme();
    });
}

export function setupObservations() {
    const obsToggleBtn = document.getElementById('obs-toggle-btn');
    if (!obsToggleBtn || !AppState.currentUser) return;
    const obsPanel = document.getElementById('observations-panel');
    const obsList = document.getElementById('obs-list');
    const obsCloseBtn = document.getElementById('obs-close-btn');
    const obsForm = document.getElementById('obs-form');
    const obsInput = document.getElementById('obs-input');
    const obsNotificationBadge = document.getElementById('obs-notification-badge');
    if (!obsPanel || !obsList || !obsCloseBtn || !obsForm || !obsInput || !obsNotificationBadge) return;
    const obsQuery = query(collection(db, 'observations'), where("teamId", "==", AppState.currentUser.teamId), orderBy('timestamp', 'desc'));
    onSnapshot(obsQuery, snapshot => {
        obsList.innerHTML = '';
        let hasUnread = false;
        snapshot.forEach(doc => {
            const obs = { id: doc.id, ...doc.data() };
            obsList.appendChild(createObsItem(obs));
            if (!obs.readBy || !obs.readBy.includes(AppState.currentUser.uid)) {
                hasUnread = true;
            }
        });
        obsNotificationBadge.classList.toggle('hidden', !hasUnread);
    });
    obsToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        obsPanel.classList.toggle('open');
        if (obsPanel.classList.contains('open')) {
            markAllObsAsRead();
        }
    });
    obsCloseBtn.addEventListener('click', () => obsPanel.classList.remove('open'));
    obsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = obsInput.value.trim();
        if (text) {
            await addDoc(collection(db, 'observations'), {
                text: text, teamId: AppState.currentUser.teamId, authorName: AppState.currentUser.displayName,
                authorId: AppState.currentUser.uid, timestamp: serverTimestamp(), readBy: [AppState.currentUser.uid]
            });
            obsInput.value = '';
        }
    });
    obsList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-notice-btn')) {
            const noticeId = e.target.dataset.id;
            const confirmed = await showConfirmation("Excluir Aviso", "Tem certeza que deseja apagar este aviso permanentemente?");
            if (confirmed) {
                await deleteDoc(doc(db, 'observations', noticeId));
                showNotification("Sucesso", "O aviso foi apagado.");
            }
        }
    });
}

function createObsItem(obs) {
    const item = document.createElement('div');
    item.className = 'obs-item';
    const date = obs.timestamp ? obs.timestamp.toDate().toLocaleString('pt-BR') : 'Enviando...';
    let deleteButtonHtml = '';
    const { role, uid } = AppState.currentUser;
    const isCreator = uid === obs.authorId;
    if (role === 'admin' || role === 'gerente' || isCreator) {
        deleteButtonHtml = `<button class="delete-notice-btn" data-id="${obs.id}" title="Apagar aviso">&times;</button>`;
    }
    item.innerHTML = `${deleteButtonHtml}<p></p><div class="obs-meta">Por: ${obs.authorName} - ${date}</div>`;
    item.querySelector('p').textContent = obs.text;
    return item;
}

async function markAllObsAsRead() {
    if (!AppState.currentUser) return;
    const obsQuery = query(collection(db, 'observations'), where("teamId", "==", AppState.currentUser.teamId));
    const snapshot = await getDocs(obsQuery);
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
        const obs = docSnap.data();
        if (!obs.readBy || !obs.readBy.includes(AppState.currentUser.uid)) {
            batch.update(docSnap.ref, { readBy: arrayUnion(AppState.currentUser.uid) });
        }
    });
    await batch.commit().catch(err => console.error("Erro ao marcar avisos como lidos:", err));
}

if (document.getElementById('app-wrapper') || window.location.pathname.endsWith('app.html')) {
    initializeApp();
}