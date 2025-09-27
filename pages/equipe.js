import { db } from '../firebase-config.js';
import { AppState, showNotification, showConfirmation, showPrompt } from '../main.js';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let unsubscribeFromTeam = null;
let unsubscribeFromLogs = null; // Novo listener para os logs
let selectedMember = null;
const dom = {};
const handlers = {};

function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    card.innerHTML = `
        <div class="status-indicator ${(member.status || 'offline').toLowerCase().replace(' ', '-')}" title="${member.status || 'Offline'}"></div>
        <h3></h3>
        <p></p>`;
    card.querySelector('h3').textContent = member.displayName;
    card.querySelector('p').textContent = member.email;
    card.addEventListener('click', () => openMemberModal(member));
    return card;
}

function openMemberModal(member) {
    selectedMember = member;
    dom.memberModal.classList.remove('hidden');

    // Preenche as informações do perfil
    dom.modalMemberName.textContent = member.displayName;
    dom.modalMemberEmail.textContent = member.email;
    dom.modalMemberRole.textContent = member.role;
    dom.modalMemberFunction.textContent = member.function;
    dom.modalMemberAge.textContent = member.age;
    dom.modalMemberPhone.textContent = member.phone;
    dom.modalMemberAddress.textContent = member.address;
    
    const currentUserRole = AppState.currentUser.role;
    const canManage = (currentUserRole === 'admin') || (currentUserRole === 'gerente');
    
    // Mostra seções de admin/gerente
    dom.adminSection.classList.toggle('hidden', !canManage || AppState.currentUser.uid === member.uid);
    dom.logsSection.classList.toggle('hidden', !canManage);

    if (canManage) {
        if(dom.adminSection && !dom.adminSection.classList.contains('hidden')) {
            dom.roleSelect.value = member.role;
            dom.roleSelect.querySelector('option[value="admin"]').disabled = (currentUserRole !== 'admin');
        }
        // Inicia o carregamento dos logs
        loadActivityLogs(member.uid);
    }
}

function loadActivityLogs(memberUid) {
    // Para de ouvir os logs do usuário anterior, se houver
    if (unsubscribeFromLogs) unsubscribeFromLogs();

    const logsContainer = document.getElementById('modal-member-logs');
    logsContainer.innerHTML = '<p>Carregando logs...</p>';

    const logsQuery = query(
        collection(db, 'users', memberUid, 'logs'), 
        orderBy('timestamp', 'desc'), 
        limit(20) // Pega os 20 logs mais recentes
    );

    unsubscribeFromLogs = onSnapshot(logsQuery, (snapshot) => {
        if (snapshot.empty) {
            logsContainer.innerHTML = '<p>Nenhum registro de atividade encontrado.</p>';
            return;
        }
        logsContainer.innerHTML = '';
        snapshot.forEach(doc => {
            const log = doc.data();
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry';
            const date = log.timestamp ? log.timestamp.toDate().toLocaleString('pt-BR') : 'Data indisponível';
            logEntry.innerHTML = `<strong>${log.status}</strong> - <span class="log-date">${date}</span>`;
            logsContainer.appendChild(logEntry);
        });
    });
}

export function init() {
    Object.assign(dom, {
        teamContainer: document.getElementById('team-container'),
        memberModal: document.getElementById('member-modal'),
        modalCloseBtn: document.getElementById('modal-close-btn'),
        saveRoleBtn: document.getElementById('save-role-btn'),
        banMemberBtn: document.getElementById('ban-member-btn'),
        modalMemberName: document.getElementById('modal-member-name'),
        modalMemberEmail: document.getElementById('modal-member-email'),
        modalMemberRole: document.getElementById('modal-member-role'),
        modalMemberFunction: document.getElementById('modal-member-function'),
        modalMemberAge: document.getElementById('modal-member-age'),
        modalMemberPhone: document.getElementById('modal-member-phone'),
        modalMemberAddress: document.getElementById('modal-member-address'),
        adminSection: document.getElementById('admin-section'),
        logsSection: document.getElementById('logs-section'),
        roleSelect: document.getElementById('role-select')
    });

    const teamId = AppState.currentUser.teamId;
    const usersQuery = query(collection(db, 'users'), where("teamId", "==", teamId));
    unsubscribeFromTeam = onSnapshot(usersQuery, (snapshot) => {
        dom.teamContainer.innerHTML = '';
        const members = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
        members.sort((a, b) => a.displayName.localeCompare(b.displayName));
        members.forEach(member => dom.teamContainer.appendChild(createMemberCard(member)));
    });

    handlers.handleModalClose = () => {
        dom.memberModal.classList.add('hidden');
        if (unsubscribeFromLogs) { // Para de ouvir os logs ao fechar o modal
            unsubscribeFromLogs();
            unsubscribeFromLogs = null;
        }
    };
    handlers.handleSaveRole = async () => { /* ... (lógica sem alterações) */ };
    handlers.handleBanMember = async () => { /* ... (lógica sem alterações) */ };

    dom.modalCloseBtn.addEventListener('click', handlers.handleModalClose);
    dom.saveRoleBtn.addEventListener('click', handlers.handleSaveRole);
    dom.banMemberBtn.addEventListener('click', handlers.handleBanMember);
}

export function cleanup() {
    if (unsubscribeFromTeam) unsubscribeFromTeam();
    if (unsubscribeFromLogs) unsubscribeFromLogs();
    
    dom.modalCloseBtn.removeEventListener('click', handlers.handleModalClose);
    dom.saveRoleBtn.removeEventListener('click', handlers.handleSaveRole);
    dom.banMemberBtn.removeEventListener('click', handlers.handleBanMember);
    selectedMember = null;
}