import { db } from './firebase-config.js';
import { initializeApp, AppState, setupObservations, showNotification, showConfirmation, showPrompt } from './main.js';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const teamContainer = document.getElementById('team-container');
const memberModal = document.getElementById('member-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
let selectedMember = null;

initializeApp().then(() => {
    if (AppState.authReady) {
        setupObservations();
        setupTeamListener();
    }
});

function setupTeamListener() {
    const teamId = AppState.currentUser.teamId;
    const usersQuery = query(collection(db, 'users'), where("teamId", "==", teamId));

    onSnapshot(usersQuery, (snapshot) => {
        teamContainer.innerHTML = '';
        snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName))
            .forEach(member => {
                teamContainer.appendChild(createMemberCard(member));
            });
    });
}

function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    
    const statusIndicator = document.createElement('div');
    const statusClass = (member.status || 'offline').toLowerCase().replace(' ', '-');
    statusIndicator.className = `status-indicator ${statusClass}`;
    statusIndicator.title = member.status;

    const memberName = document.createElement('h3');
    memberName.textContent = member.displayName;

    const memberEmail = document.createElement('p');
    memberEmail.textContent = member.email;
    
    card.append(statusIndicator, memberName, memberEmail);
    card.addEventListener('click', () => openMemberModal(member));
    return card;
}

function openMemberModal(member) {
    selectedMember = member;
    memberModal.classList.remove('hidden');

    document.getElementById('modal-member-name').textContent = member.displayName;
    document.getElementById('modal-member-email').textContent = member.email;
    document.getElementById('modal-member-role').textContent = member.role;
    document.getElementById('modal-member-function').textContent = member.function;
    document.getElementById('modal-member-age').textContent = member.age;
    document.getElementById('modal-member-phone').textContent = member.phone;
    document.getElementById('modal-member-address').textContent = member.address;
    
    const adminSection = document.getElementById('admin-section');
    const currentUserRole = AppState.currentUser.role;
    const roleSelect = document.getElementById('role-select');

    if (AppState.currentUser.uid === member.uid) {
        adminSection.classList.add('hidden');
        return;
    }

    if (member.role === 'admin' && currentUserRole !== 'admin') {
        adminSection.classList.add('hidden');
        return;
    }
    
    if (currentUserRole === 'gerente' && (member.role === 'admin' || member.role === 'gerente')) {
        adminSection.classList.add('hidden');
        return;
    }

    if (currentUserRole === 'admin' || currentUserRole === 'gerente') {
        adminSection.classList.remove('hidden');
        roleSelect.value = member.role;
        roleSelect.querySelector('option[value="admin"]').disabled = (currentUserRole !== 'admin');
    } else {
        adminSection.classList.add('hidden');
    }
}

modalCloseBtn.addEventListener('click', () => memberModal.classList.add('hidden'));

document.getElementById('save-role-btn').addEventListener('click', async () => {
    if (!selectedMember) return;
    const newRole = document.getElementById('role-select').value;
    const memberRef = doc(db, 'users', selectedMember.uid);
    await updateDoc(memberRef, { role: newRole });
    showNotification("Sucesso", "Cargo atualizado com sucesso!");
    memberModal.classList.add('hidden');
});

document.getElementById('ban-member-btn').addEventListener('click', async () => {
    if (!selectedMember) return;
    
    const confirmed = await showConfirmation("Banir Funcionário", `Tem certeza que deseja banir ${selectedMember.displayName}? Esta ação é irreversível.`);
    
    if (confirmed) {
        const passwordConfirmation = await showPrompt("Confirmação de Segurança", "Para confirmar esta ação, digite a senha de segurança:", "DELETEOK");
        
        if (passwordConfirmation === "DELETEOK") {
            try {
                const memberRef = doc(db, 'users', selectedMember.uid);
                await deleteDoc(memberRef);
                showNotification("Sucesso", `${selectedMember.displayName} foi banido da equipe.`);
                memberModal.classList.add('hidden');
            } catch (error) {
                showNotification("Erro", "Ocorreu um erro ao banir o funcionário.");
                console.error("Erro ao banir:", error);
            }
        } else if (passwordConfirmation !== null) {
            showNotification("Falha", "Senha de confirmação incorreta.");
        }
    }
});