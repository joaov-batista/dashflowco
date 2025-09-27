import { db } from './firebase-config.js';
import { AppState, showNotification, showConfirmation } from './main.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let state = {
    cachedLists: [],
    cachedCards: [],
    currentEditingCard: null,
    draggedItem: null,
    collections: { lists: '', cards: '' },
    isPersonal: false,
};

let dom = {};
const handlers = {};

export function initializeBoard(config) {
    state.collections.lists = config.listsCollection;
    state.collections.cards = config.cardsCollection;
    state.isPersonal = config.isPersonal || false;

    dom.boardContainer = document.getElementById('boardContainer');
    dom.modal = document.getElementById('card-modal');
    dom.modalCloseBtn = document.getElementById('modal-close-btn');
    dom.saveModalBtn = document.getElementById('save-modal-btn');
    dom.deleteCardBtn = document.getElementById('delete-card-btn');
    dom.modalCardTitleEdit = document.getElementById('modal-card-title-edit');
    dom.modalCardDescriptionEdit = document.getElementById('modal-card-description-edit');
    dom.modalStatusOptions = document.getElementById('modal-status-options');
    
    // Pega o formulário que já existe no HTML da view
    dom.addListFormContainer = document.getElementById('add-list-form-container');
    if(dom.addListFormContainer) {
        dom.addListInput = dom.addListFormContainer.querySelector('input');
    }

    setupModalEventListeners();
    setupAddListListener();
    
    const unsubscribeLists = setupListsListener(config.createDefaultLists);
    const unsubscribeCards = setupCardsListener();

    return { unsubscribeLists, unsubscribeCards };
}

function setupListsListener(createDefaultLists) {
    const idKey = state.isPersonal ? "uid" : "teamId";
    const idValue = state.isPersonal ? AppState.currentUser.uid : AppState.currentUser.teamId;
    const listsQuery = query(collection(db, state.collections.lists), where(idKey, "==", idValue), orderBy('order'));
    
    return onSnapshot(listsQuery, async (snapshot) => {
        if (snapshot.empty && createDefaultLists) {
            await createDefaultLists(idValue);
        } else {
            state.cachedLists = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            renderBoard();
        }
    });
}

function setupCardsListener() {
    const idKey = state.isPersonal ? "uid" : "teamId";
    const idValue = state.isPersonal ? AppState.currentUser.uid : AppState.currentUser.teamId;
    const cardsQuery = query(collection(db, state.collections.cards), where(idKey, "==", idValue));

    return onSnapshot(cardsQuery, snapshot => {
        state.cachedCards = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderBoard();
    });
}

function renderBoard() {
    if (!dom.boardContainer) return;
    
    const cardsByList = new Map();
    state.cachedCards.forEach(card => {
        if (!cardsByList.has(card.listId)) cardsByList.set(card.listId, []);
        cardsByList.get(card.listId).push(card);
    });
    cardsByList.forEach(cards => cards.sort((a, b) => a.order - b.order));
    
    dom.boardContainer.innerHTML = ''; 
    
    state.cachedLists.forEach(list => {
        const listCards = cardsByList.get(list.id) || [];
        dom.boardContainer.appendChild(createListElement(list, listCards));
    });

    if (dom.addListFormContainer) {
        dom.addListFormContainer.style.display = 'block';
        dom.boardContainer.appendChild(dom.addListFormContainer);
    }
}

function createListElement(list, cards) {
    const listEl = document.createElement('div');
    listEl.className = 'list';
    listEl.dataset.listId = list.id;
    
    const creatorName = !state.isPersonal && list.createdBy ? list.createdBy.displayName.split(' ')[0] : null;
    const creatorHTML = creatorName ? `<span class="list-creator">por ${creatorName}</span>` : '';

    listEl.innerHTML = `
        <div class="list-header" draggable="true">
            <div class="list-header-title">
                <h3 contenteditable="true"></h3>
                ${creatorHTML}
            </div>
            <button class="delete-list-btn" title="Excluir lista">&times;</button>
        </div>
        <div class="cards-container"></div>
        <form class="add-card-form"><input type="text" placeholder="+ Adicionar ${state.isPersonal ? 'tarefa' : 'cartão'}" required autocomplete="off" /></form>`;
    
    listEl.querySelector('h3').textContent = list.name;

    const cardsContainer = listEl.querySelector('.cards-container');
    cards.forEach(card => cardsContainer.appendChild(createCardElement(card)));

    listEl.querySelector('.list-header').addEventListener('dragstart', e => handleDragStart(e, { type: 'list', id: list.id }, listEl));
    listEl.addEventListener('dragend', () => listEl.classList.remove('dragging-list'));
    listEl.addEventListener('dragover', e => { e.preventDefault(); e.currentTarget.classList.add('drag-over-list'); });
    listEl.addEventListener('dragleave', e => e.currentTarget.classList.remove('drag-over-list'));
    listEl.addEventListener('drop', handleDrop);
    listEl.querySelector('h3').addEventListener('blur', e => handleListNameUpdate(e, list));
    listEl.querySelector('.delete-list-btn').addEventListener('click', () => deleteList(list.id, list.name));
    listEl.querySelector('.add-card-form').addEventListener('submit', e => handleAddCard(e, list.id));
    
    return listEl;
}

function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;
    cardEl.draggable = true;
    const status = card.status || 'pendente';
    const statusColors = { pendente: 'var(--status-pendente)', 'em-andamento': 'var(--status-em-andamento)', concluida: 'var(--status-concluida)', urgente: 'var(--status-urgente)' };
    cardEl.style.borderLeftColor = statusColors[status];
    const creatorName = !state.isPersonal && card.createdBy ? card.createdBy.displayName.split(' ')[0] : null;
    const footerHTML = creatorName ? `<div class="card-footer"><span>Criado por: ${creatorName}</span></div>` : '';
    cardEl.innerHTML = `<div class="card-content"></div> ${footerHTML}`;
    cardEl.querySelector('.card-content').textContent = card.text;
    cardEl.addEventListener('dragstart', e => handleDragStart(e, { type: 'card', id: card.id }, cardEl));
    cardEl.addEventListener('dragend', () => cardEl.classList.remove('dragging'));
    cardEl.addEventListener('click', () => openCardModal(card));
    return cardEl;
}

function setupAddListListener() {
    if (!dom.addListInput) return;
    handlers.addList = (e) => {
        if (e.key === 'Enter' && dom.addListInput.value.trim()) {
            e.preventDefault();
            handleAddList(dom.addListInput.value.trim());
            dom.addListInput.value = '';
        }
    };
    dom.addListInput.addEventListener('keydown', handlers.addList);
}

function openCardModal(card) {
    state.currentEditingCard = card;
    dom.modalCardTitleEdit.value = card.text;
    dom.modalCardDescriptionEdit.value = card.description || '';
    dom.modalStatusOptions.innerHTML = '';
    const STATUSES = { pendente: 'Pendente', 'em-andamento': 'Em Andamento', concluida: 'Concluída', urgente: 'Urgente' };
    Object.keys(STATUSES).forEach(key => {
        const opt = document.createElement('button');
        opt.className = 'status-option';
        opt.dataset.status = key;
        opt.textContent = STATUSES[key];
        if (key === card.status) opt.classList.add('selected');
        opt.onclick = () => { dom.modalStatusOptions.querySelector('.selected')?.classList.remove('selected'); opt.classList.add('selected'); };
        dom.modalStatusOptions.appendChild(opt);
    });
    dom.modal.classList.remove('hidden');
}

function setupModalEventListeners() {
    handlers.closeCardModal = () => { if(dom.modal) dom.modal.classList.add('hidden'); state.currentEditingCard = null; };
    handlers.saveCardChanges = async () => {
        if (!state.currentEditingCard) return;
        const newText = dom.modalCardTitleEdit.value.trim();
        const newDescription = dom.modalCardDescriptionEdit.value.trim();
        const newStatus = dom.modalStatusOptions.querySelector('.selected')?.dataset.status || 'pendente';
        const updates = { text: newText, description: newDescription, status: newStatus, lastModifiedAt: serverTimestamp() };
        if (!state.isPersonal) { updates.lastModifiedBy = { uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName }; }
        await updateDoc(doc(db, state.collections.cards, state.currentEditingCard.id), updates);
        handlers.closeCardModal();
    };
    handlers.deleteCard = async () => {
        if (!state.currentEditingCard) return;
        const confirmed = await showConfirmation(`Excluir Tarefa`, `Tem certeza?`);
        if (confirmed) {
            await deleteDoc(doc(db, state.collections.cards, state.currentEditingCard.id));
            showNotification("Sucesso", "Excluído.");
            handlers.closeCardModal();
        }
    };
    dom.saveModalBtn?.addEventListener('click', handlers.saveCardChanges);
    dom.deleteCardBtn?.addEventListener('click', handlers.deleteCard);
    dom.modalCloseBtn?.addEventListener('click', handlers.closeCardModal);
}

export function cleanupBoard() {
    dom.saveModalBtn?.removeEventListener('click', handlers.saveCardChanges);
    dom.deleteCardBtn?.removeEventListener('click', handlers.deleteCard);
    dom.modalCloseBtn?.removeEventListener('click', handlers.closeCardModal);
    if (dom.addListInput) { dom.addListInput.removeEventListener('keydown', handlers.addList); }
}

function handleDragStart(e, item, element) { e.stopPropagation(); state.draggedItem = item; element.classList.add(item.type === 'list' ? 'dragging-list' : 'dragging'); }
async function handleDrop(e) { e.preventDefault(); if (!state.draggedItem) return; const targetListEl = e.currentTarget.closest('.list'); if (!targetListEl) return; targetListEl.classList.remove('drag-over-list'); const targetListId = targetListEl.dataset.listId; if (state.draggedItem.type === 'card') { const afterElement = getDragAfterElement(targetListEl.querySelector('.cards-container'), e.clientY); const newOrder = calculateNewOrder(targetListId, afterElement); await updateDoc(doc(db, state.collections.cards, state.draggedItem.id), { listId: targetListId, order: newOrder }); } else if (state.draggedItem.type === 'list' && state.draggedItem.id !== targetListId) { await reorderLists(state.draggedItem.id, targetListId); } state.draggedItem = null; }
async function handleListNameUpdate(event, list) { const newName = event.target.textContent.trim(); if (newName && newName !== list.name) { await updateDoc(doc(db, state.collections.lists, list.id), { name: newName }); } else { event.target.textContent = list.name; } }
async function handleAddCard(event, listId) { event.preventDefault(); const input = event.target.querySelector('input'); const text = input.value.trim(); if (!text) return; const newCard = { text, listId, status: 'pendente', order: Date.now(), createdAt: serverTimestamp() }; if (state.isPersonal) { newCard.uid = AppState.currentUser.uid; } else { newCard.teamId = AppState.currentUser.teamId; newCard.createdBy = { uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName }; } await addDoc(collection(db, state.collections.cards), newCard); input.value = ''; }
async function handleAddList(name) { const newList = { name, order: state.cachedLists.length, createdAt: serverTimestamp() }; if (state.isPersonal) { newList.uid = AppState.currentUser.uid; } else { newList.teamId = AppState.currentUser.teamId; newList.createdBy = { uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName }; } await addDoc(collection(db, state.collections.lists), newList); }
async function deleteList(listId, listName) { const confirmed = await showConfirmation("Excluir Lista", `Tem certeza que quer excluir a lista "${listName}"?`); if (!confirmed) return; const batch = writeBatch(db); batch.delete(doc(db, state.collections.lists, listId)); state.cachedCards.filter(card => card.listId === listId).forEach(card => batch.delete(doc(db, state.collections.cards, card.id))); await batch.commit(); showNotification("Sucesso", `A lista "${listName}" foi excluída.`); }
async function reorderLists(draggedListId, targetListId) { const newLists = [...state.cachedLists]; const draggedIndex = newLists.findIndex(l => l.id === draggedListId); const targetIndex = newLists.findIndex(l => l.id === targetListId); const [draggedList] = newLists.splice(draggedIndex, 1); newLists.splice(targetIndex, 0, draggedList); const batch = writeBatch(db); newLists.forEach((list, index) => batch.update(doc(db, 'lists', list.id), { order: index })); await batch.commit(); }
function calculateNewOrder(targetListId, afterElement) { const cardsInList = state.cachedCards.filter(c => c.listId === targetListId).sort((a,b) => a.order - b.order); if (afterElement == null) { const lastCard = cardsInList[cardsInList.length - 1]; return (lastCard ? lastCard.order : Date.now()) + 1000; } else { const beforeElementIndex = cardsInList.findIndex(c => c.id === afterElement.dataset.cardId); const beforeElement = cardsInList[beforeElementIndex]; const prevElement = cardsInList[beforeElementIndex - 1]; const prevOrder = prevElement ? prevElement.order : 0; return (prevOrder + beforeElement.order) / 2; } }
function getDragAfterElement(container, y) { const draggableElements = [...container.querySelectorAll('.card:not(.dragging)')]; return draggableElements.reduce((closest, child) => { const box = child.getBoundingClientRect(); const offset = y - box.top - box.height / 2; if (offset < 0 && offset > closest.offset) { return { offset: offset, element: child }; } else { return closest; } }, { offset: Number.NEGATIVE_INFINITY }).element; }