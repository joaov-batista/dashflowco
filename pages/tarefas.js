import { db } from '../firebase-config.js';
import { initializeBoard, cleanupBoard } from '../board-logic.js';
import { writeBatch, doc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let unsubscribeLists = null;
let unsubscribeCards = null;

async function createDefaultPersonalLists(uid) {
    const batch = writeBatch(db);
    const listsRef = collection(db, 'personal_lists');
    const list1Ref = doc(listsRef);
    batch.set(list1Ref, { name: "Meta do Dia", order: 0, uid, createdAt: serverTimestamp() });
    const list2Ref = doc(listsRef);
    batch.set(list2Ref, { name: "Agenda do Dia", order: 1, uid, createdAt: serverTimestamp() });
    const cardsRef = collection(db, 'personal_cards');
    const firstCard = {
        text: "Bem-vindo! Clique em mim para ver os detalhes da tarefa.",
        listId: list1Ref.id, uid: uid, status: 'pendente',
        order: Date.now(), createdAt: serverTimestamp()
    };
    batch.set(doc(cardsRef), firstCard);
    await batch.commit();
}

export function init() {
    const boardSubscriptions = initializeBoard({
        listsCollection: 'personal_lists',
        cardsCollection: 'personal_cards',
        isPersonal: true,
        createDefaultLists: createDefaultPersonalLists
    });
    unsubscribeLists = boardSubscriptions.unsubscribeLists;
    unsubscribeCards = boardSubscriptions.unsubscribeCards;
}

export function cleanup() {
    if (unsubscribeLists) unsubscribeLists();
    if (unsubscribeCards) unsubscribeCards();
    cleanupBoard();
}