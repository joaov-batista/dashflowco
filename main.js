import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, writeBatch, getDocs, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

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
    if(notificationModal && notificationTitle && notificationMessage) {
        notificationTitle.textContent = title;
        notificationMessage.textContent = message;
        notificationModal.classList.remove('hidden');
    } else {
        alert(message);
    }
}
if(notificationCloseBtn) {
    notificationCloseBtn.addEventListener('click', () => {
        notificationModal.classList.add('hidden');
    });
}

export function showConfirmation(title, message) {
    return new Promise((resolve) => {
        if(confirmationModal && confirmationTitle && confirmationMessage) {
            confirmationTitle.textContent = title;
            confirmationMessage.textContent = message;
            confirmationModal.classList.remove('hidden');

            const handleYes = () => {
                confirmationModal.classList.add('hidden');
                cleanup();
                resolve(true);
            };
            const handleNo = () => {
                confirmationModal.classList.add('hidden');
                cleanup();
                resolve(false);
            };
            const cleanup = () => {
                confirmYesBtn.removeEventListener('click', handleYes);
                confirmCancelBtn.removeEventListener('click', handleNo);
            };
            
            confirmYesBtn.addEventListener('click', handleYes);
            confirmCancelBtn.addEventListener('click', handleNo);
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

            const handleOk = () => {
                promptModal.classList.add('hidden');
                cleanup();
                resolve(promptInput.value);
            };
            const handleCancel = () => {
                promptModal.classList.add('hidden');
                cleanup();
                resolve(null);
            };
            const handleEnter = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleOk();
                }
            };
            const cleanup = () => {
                promptOkBtn.removeEventListener('click', handleOk);
                promptCancelBtn.removeEventListener('click', handleCancel);
                promptInput.removeEventListener('keydown', handleEnter);
            };
            
            promptOkBtn.addEventListener('click', handleOk);
            promptCancelBtn.addEventListener('click', handleCancel);
            promptInput.addEventListener('keydown', handleEnter);

        } else {
            resolve(prompt(message));
        }
    });
}

export const initializeApp = () => new Promise((resolve) => {
    applyTheme();
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDocRef = doc(db, 'users', user.uid);
            onSnapshot(userDocRef, async (userDocSnap) => {
                if (userDocSnap.exists()) {
                    AppState.currentUser = userDocSnap.data();
                    sessionStorage.setItem('currentUser', JSON.stringify(AppState.currentUser));

                    if (!AppState.teamInfo || AppState.teamInfo.id !== AppState.currentUser.teamId) {
                        const teamDocRef = doc(db, 'teams', AppState.currentUser.teamId);
                        const teamDocSnap = await getDoc(teamDocRef);
                        if (teamDocSnap.exists()) {
                            AppState.teamInfo = { id: teamDocSnap.id, ...teamDocSnap.data() };
                            sessionStorage.setItem('teamInfo', JSON.stringify(AppState.teamInfo));
                        }
                    }
                    
                    setupGlobalUI();
                    
                    if (!AppState.authReady) {
                        setupThemeControls();
                        setupStatusControls();
                        setupSidebarToggle();
                        AppState.authReady = true;
                        resolve();
                    }
                } else {
                    handleSignOut();
                }
            });
        } else {
            window.location.href = 'index.html';
        }
    });
});

function setupGlobalUI() {
    const teamNameDisplay = document.getElementById('team-name-display');
    const userNameDisplay = document.getElementById('user-display-name');
    const logoutButton = document.getElementById('logout-button');

    if (userNameDisplay && AppState.currentUser) userNameDisplay.textContent = AppState.currentUser.displayName;
    if (teamNameDisplay && AppState.teamInfo) teamNameDisplay.textContent = AppState.teamInfo.teamName;
    if (logoutButton) logoutButton.addEventListener('click', handleSignOut);
}

function setupStatusControls() {
    const statusControls = document.getElementById('status-controls');
    if (!statusControls || !AppState.currentUser) return;

    const lastStatus = localStorage.getItem('userStatus');
    if (lastStatus) {
        statusControls.querySelectorAll('.status-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.status === lastStatus);
        });
    }

    const userDocRef = doc(db, 'users', AppState.currentUser.uid);
    onSnapshot(userDocRef, (docSnap) => {
        const currentStatus = docSnap.data()?.status;
        if (currentStatus) {
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
    if (AppState.currentUser) {
        localStorage.setItem('userStatus', status);
        const userDocRef = doc(db, 'users', AppState.currentUser.uid);
        await updateDoc(userDocRef, { status: status });
    }
}

async function handleSignOut() {
    if (AppState.currentUser) {
        await updateUserStatus('Offline');
    }
    sessionStorage.clear();
    localStorage.removeItem('userStatus');
    await signOut(auth);
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('toggle-sidebar-btn');
    const appWrapper = document.getElementById('app-wrapper');
    if (toggleBtn && appWrapper) {
        toggleBtn.addEventListener('click', () => {
            appWrapper.classList.toggle('sidebar-collapsed');
            const isCollapsed = appWrapper.classList.contains('sidebar-collapsed');
            toggleBtn.textContent = isCollapsed ? '»' : '«';
        });
    }
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

    themeDefaultBtn.addEventListener('click', () => {
        localStorage.setItem('theme', 'theme-default');
        applyTheme();
    });
    themeLightBtn.addEventListener('click', () => {
        localStorage.setItem('theme', 'theme-light');
        applyTheme();
    });
    themeDarkBtn.addEventListener('click', () => {
        localStorage.setItem('theme', 'theme-dark');
        applyTheme();
    });
    toggleAnimationBtn.addEventListener('click', () => {
        const isPaused = localStorage.getItem('animationPaused') === 'true';
        localStorage.setItem('animationPaused', !isPaused);
        applyTheme();
    });
}

async function createDefaultNotice(teamId) {
    const noticesRef = collection(db, "observations");
    const q = query(noticesRef, where("teamId", "==", teamId));
    const existingNotices = await getDocs(q);
    if (existingNotices.empty) {
        await addDoc(noticesRef, {
            text: "Bem-vindo ao DashFlowCo! Este é o painel de avisos. Use-o para comunicar informações importantes para toda a equipe.",
            teamId: teamId,
            authorName: "Sistema",
            authorId: "system",
            timestamp: serverTimestamp(),
            readBy: []
        });
    }
}

export function setupObservations() {
    const obsToggleBtn = document.getElementById('obs-toggle-btn');
    if (!obsToggleBtn) return;

    const obsPanel = document.getElementById('observations-panel');
    const obsList = document.getElementById('obs-list');
    const obsCloseBtn = document.getElementById('obs-close-btn');
    const obsForm = document.getElementById('obs-form');
    const obsInput = document.getElementById('obs-input');
    const obsNotificationBadge = document.getElementById('obs-notification-badge');

    if (!obsPanel || !obsList || !obsCloseBtn || !obsForm || !obsInput || !obsNotificationBadge) {
        return;
    }

    const obsQuery = query(collection(db, 'observations'), where("teamId", "==", AppState.currentUser.teamId), orderBy('timestamp', 'desc'));
    onSnapshot(obsQuery, snapshot => {
        // A LINHA QUE CRIAVA O AVISO PADRÃO FOI REMOVIDA DAQUI
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
    }, error => {
        console.error("Erro no listener de avisos (verifique o índice no Firestore):", error);
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
        if (obsInput.value.trim()) {
            await addDoc(collection(db, 'observations'), {
                text: obsInput.value.trim(),
                teamId: AppState.currentUser.teamId,
                authorName: AppState.currentUser.displayName,
                authorId: AppState.currentUser.uid,
                timestamp: serverTimestamp(),
                readBy: [AppState.currentUser.uid]
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
    const userRole = AppState.currentUser.role;
    const isCreator = AppState.currentUser.uid === obs.authorId;

    if (userRole === 'admin' || userRole === 'gerente' || isCreator) {
        deleteButtonHtml = `<button class="delete-notice-btn" data-id="${obs.id}" title="Apagar aviso">&times;</button>`;
    }

    item.innerHTML = `
        ${deleteButtonHtml}
        <p>${obs.text}</p>
        <div class="obs-meta">Por: ${obs.authorName} - ${date}</div>
    `;
    return item;
}

async function markAllObsAsRead() {
    const obsQuery = query(collection(db, 'observations'), where("teamId", "==", AppState.currentUser.teamId));
    const snapshot = await getDocs(obsQuery);
    const batch = writeBatch(db);
    snapshot.forEach(docSnap => {
        const obs = docSnap.data();
        if (!obs.readBy || !obs.readBy.includes(AppState.currentUser.uid)) {
            batch.update(docSnap.ref, { readBy: arrayUnion(AppState.currentUser.uid) });
        }
    });
    await batch.commit();
}