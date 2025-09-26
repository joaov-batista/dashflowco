import { db } from './firebase-config.js';
import { initializeApp, AppState, setupObservations, showNotification, showConfirmation } from './main.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const boardContainer = document.getElementById('boardContainer');
const STATUSES = { pendente: 'Pendente', 'em-andamento': 'Em Andamento', concluida: 'Concluída', urgente: 'Urgente' };
let cachedLists = [], cachedCards = [], currentEditingCard = null, draggedItem = null;

initializeApp().then(() => {
    if (AppState.authReady) {
        setupObservations();
        setupRealtimeListeners();
    }
});

function setupRealtimeListeners() {
    const teamId = AppState.currentUser.teamId;
    const listsQuery = query(collection(db, 'lists'), where("teamId", "==", teamId), orderBy('order'));
    onSnapshot(listsQuery, async (snapshot) => {
        if (snapshot.empty) {
            await createDefaultTeamLists(teamId);
        } else {
            cachedLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBoard();
        }
    });

    const cardsQuery = query(collection(db, 'cards'), where("teamId", "==", teamId));
    onSnapshot(cardsQuery, snapshot => {
        cachedCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBoard();
    });
}

async function createDefaultTeamLists(teamId) {
    const creator = {
        uid: AppState.currentUser.uid,
        displayName: AppState.currentUser.displayName
    };
    const batch = writeBatch(db);
    const listsRef = collection(db, 'lists');
    
    const list1 = { name: "Metas da Equipe", order: 0, teamId, createdAt: serverTimestamp(), createdBy: creator };
    const list2 = { name: "A Fazer", order: 1, teamId, createdAt: serverTimestamp(), createdBy: creator };
    const list3 = { name: "Concluído", order: 2, teamId, createdAt: serverTimestamp(), createdBy: creator };

    batch.set(doc(listsRef), list1);
    batch.set(doc(listsRef), list2);
    batch.set(doc(listsRef), list3);
    
    await batch.commit();
}

function renderBoard() {
    boardContainer.innerHTML = '';
    cachedLists.forEach(list => boardContainer.appendChild(createListElement(list)));
    boardContainer.appendChild(createAddListElement());
}

function createListElement(list) {
    const listEl = document.createElement('div');
    listEl.className = 'list';
    listEl.dataset.listId = list.id;
    
    const creatorName = list.createdBy ? list.createdBy.displayName.split(' ')[0] : 'Sistema';
    listEl.innerHTML = `
        <div class="list-header" draggable="true">
            <div class="list-header-title">
                <h3 contenteditable="true">${list.name}</h3>
                <span class="list-creator">por ${creatorName}</span>
            </div>
            <button class="delete-list-btn" title="Excluir lista">&times;</button>
        </div>
        <div class="cards-container"></div>
        <form class="add-card-form"><input type="text" placeholder="+ Adicionar cartão" required /></form>`;

    const cardsContainer = listEl.querySelector('.cards-container');
    cachedCards.filter(c => c.listId === list.id).sort((a,b) => a.order - b.order).forEach(card => {
        cardsContainer.appendChild(createCardElement(card));
    });

    const header = listEl.querySelector('.list-header');
    header.addEventListener('dragstart', e => {
        e.stopPropagation();
        draggedItem = { type: 'list', id: list.id };
        listEl.classList.add('dragging-list');
    });
    header.addEventListener('dragend', () => listEl.classList.remove('dragging-list'));

    listEl.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over-list'); });
    listEl.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over-list'));
    listEl.addEventListener('drop', handleDrop);

    listEl.querySelector('h3').addEventListener('blur', e => {
        const newName = e.target.textContent.trim();
        if (newName) {
            updateDoc(doc(db, 'lists', list.id), { name: newName });
        } else {
            e.target.textContent = list.name;
        }
    });
    
    listEl.querySelector('.delete-list-btn').addEventListener('click', () => deleteList(list.id, list.name));
    
    listEl.querySelector('.add-card-form').addEventListener('submit', async e => {
        e.preventDefault();
        const input = e.target.querySelector('input');
        if(input.value.trim()) {
            await addDoc(collection(db, 'cards'), { 
                text: input.value.trim(), 
                listId: list.id, 
                teamId: AppState.currentUser.teamId, 
                status: 'pendente', 
                order: Date.now(),
                createdAt: serverTimestamp(),
                createdBy: {
                    uid: AppState.currentUser.uid,
                    displayName: AppState.currentUser.displayName
                }
            });
            input.value = '';
        }
    });
    return listEl;
}

async function deleteList(listId, listName) {
    const confirmed = await showConfirmation("Excluir Lista", `Tem certeza que quer excluir a lista "${listName}"? Todos os cartões dentro dela serão perdidos.`);
    if (!confirmed) return;

    const batch = writeBatch(db);
    batch.delete(doc(db, 'lists', listId));
    const cardsToDelete = cachedCards.filter(card => card.listId === listId);
    cardsToDelete.forEach(card => {
        batch.delete(doc(db, 'cards', card.id));
    });
    await batch.commit();
    showNotification("Sucesso", `A lista "${listName}" foi excluída.`);
}

function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;
    
    const status = card.status || 'pendente';
    cardEl.dataset.status = status;
    
    const statusColors = {
        pendente: 'var(--status-pendente)',
        'em-andamento': 'var(--status-em-andamento)',
        concluida: 'var(--status-concluida)',
        urgente: 'var(--status-urgente)',
    };
    cardEl.style.borderLeftColor = statusColors[status];

    cardEl.innerHTML = `
        <div class="card-content">${card.text}</div>
        <div class="card-footer">
            <span>Criado por: ${card.createdBy ? card.createdBy.displayName.split(' ')[0] : 'Desconhecido'}</span>
        </div>
    `;

    cardEl.draggable = true;

    cardEl.addEventListener('dragstart', e => { e.stopPropagation(); draggedItem = { type: 'card', id: card.id, originalListId: card.listId }; cardEl.classList.add('dragging'); });
    cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
    cardEl.addEventListener('click', () => openCardModal(card));
    return cardEl;
}

async function handleDrop(e) {
    e.preventDefault();
    if (!draggedItem) return;

    const targetListEl = e.currentTarget.closest('.list');
    targetListEl.classList.remove('drag-over-list');
    const targetListId = targetListEl.dataset.listId;

    if (draggedItem.type === 'card') {
        const afterElement = getDragAfterElement(targetListEl.querySelector('.cards-container'), e.clientY);
        const newOrder = calculateNewOrder(targetListId, afterElement);
        await updateDoc(doc(db, 'cards', draggedItem.id), { listId: targetListId, order: newOrder });

    } else if (draggedItem.type === 'list' && draggedItem.id !== targetListId) {
        await reorderLists(draggedItem.id, targetListId);
    }
    draggedItem = null;
}

function calculateNewOrder(targetListId, afterElement) {
    const cardsInList = cachedCards.filter(c => c.listId === targetListId).sort((a,b) => a.order - b.order);
    
    if (afterElement == null) {
        const lastCard = cardsInList[cardsInList.length - 1];
        return (lastCard ? lastCard.order : Date.now()) + 1;
    } else {
        const beforeElementIndex = cardsInList.findIndex(c => c.id === afterElement.dataset.cardId);
        const beforeElement = cardsInList[beforeElementIndex];
        const prevElement = cardsInList[beforeElementIndex - 1];
        
        const prevOrder = prevElement ? prevElement.order : 0;
        const nextOrder = beforeElement.order;
        
        return (prevOrder + nextOrder) / 2;
    }
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

async function reorderLists(draggedListId, targetListId) {
    const draggedIndex = cachedLists.findIndex(l => l.id === draggedListId);
    const targetIndex = cachedLists.findIndex(l => l.id === targetListId);
    
    const newLists = [...cachedLists];
    const [draggedList] = newLists.splice(draggedIndex, 1);
    newLists.splice(targetIndex, 0, draggedList);

    const batch = writeBatch(db);
    newLists.forEach((list, index) => {
        batch.update(doc(db, 'lists', list.id), { order: index });
    });
    await batch.commit();
}

function createAddListElement() {
    const formContainer = document.createElement('div');
    formContainer.className = 'add-list-form-container';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '+ Adicionar outra lista';
    input.addEventListener('keydown', async e => {
        if (e.key === 'Enter' && input.value.trim()) {
            await addDoc(collection(db, 'lists'), {
                name: input.value.trim(),
                order: cachedLists.length,
                teamId: AppState.currentUser.teamId,
                createdAt: serverTimestamp(),
                createdBy: {
                    uid: AppState.currentUser.uid,
                    displayName: AppState.currentUser.displayName
                }
            });
            input.value = '';
        }
    });
    formContainer.appendChild(input);
    return formContainer;
}

const modal = document.getElementById('card-modal');
const modalCloseBtn = document.getElementById('modal-close-btn');
const saveModalBtn = document.getElementById('save-modal-btn');
const deleteCardBtn = document.getElementById('delete-card-btn');

function openCardModal(card) {
    currentEditingCard = card;
    document.getElementById('modal-card-title-edit').value = card.text;
    document.getElementById('modal-card-description-edit').value = card.description || '';
    const statusContainer = document.getElementById('modal-status-options');
    statusContainer.innerHTML = '';
    Object.keys(STATUSES).forEach(key => {
        const opt = document.createElement('button');
        opt.className = 'status-option';
        opt.dataset.status = key;
        opt.textContent = STATUSES[key];
        if (key === card.status) opt.classList.add('selected');
        opt.onclick = () => { statusContainer.querySelector('.selected')?.classList.remove('selected'); opt.classList.add('selected'); };
        statusContainer.appendChild(opt);
    });
    modal.classList.remove('hidden');
}

function closeCardModal() { modal.classList.add('hidden'); currentEditingCard = null; }

async function saveCardChanges() {
    if (!currentEditingCard) return;
    const newText = document.getElementById('modal-card-title-edit').value.trim();
    const newDescription = document.getElementById('modal-card-description-edit').value.trim();
    const newStatus = document.querySelector('#modal-status-options .selected')?.dataset.status || 'pendente';
    await updateDoc(doc(db, 'cards', currentEditingCard.id), { 
        text: newText, 
        description: newDescription, 
        status: newStatus,
        lastModifiedAt: serverTimestamp(),
        lastModifiedBy: {
            uid: AppState.currentUser.uid,
            displayName: AppState.currentUser.displayName
        }
    });
    closeCardModal();
}

async function deleteCard() {
    if (!currentEditingCard) return;
    const confirmed = await showConfirmation("Excluir Cartão", "Tem certeza que quer excluir este cartão?");
    if (confirmed) {
        await deleteDoc(doc(db, 'cards', currentEditingCard.id));
        showNotification("Sucesso", "O cartão foi excluído.");
        closeCardModal();
    }
}

saveModalBtn.addEventListener('click', saveCardChanges);
deleteCardBtn.addEventListener('click', deleteCard);
modalCloseBtn.addEventListener('click', closeCardModal);