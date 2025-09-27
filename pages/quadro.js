import { db } from '../firebase-config.js';
import { initializeBoard, cleanupBoard } from '../board-logic.js';
import { writeBatch, doc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { AppState } from "../main.js";

let unsubscribeLists = null;
let unsubscribeCards = null;

async function createDefaultTeamLists(teamId) {
    const creator = {
        uid: AppState.currentUser.uid,
        displayName: AppState.currentUser.displayName
    };
    const batch = writeBatch(db);
    const listsRef = collection(db, 'lists');
    
    const defaultLists = [ { name: "Metas da Equipe", order: 0 }, { name: "A Fazer", order: 1 }, { name: "Concluído", order: 2 }];
    defaultLists.forEach(listData => {
        const listDoc = doc(listsRef);
        batch.set(listDoc, { ...listData, teamId, createdAt: serverTimestamp(), createdBy: creator });
    });
    
    await batch.commit();
}

export function init() {
    const boardSubscriptions = initializeBoard({
        listsCollection: 'lists',
        cardsCollection: 'cards',
        isPersonal: false,
        createDefaultLists: createDefaultTeamLists
    });
    unsubscribeLists = boardSubscriptions.unsubscribeLists;
    unsubscribeCards = boardSubscriptions.unsubscribeCards;
}

export function cleanup() {
    if (unsubscribeLists) unsubscribeLists();
    if (unsubscribeCards) unsubscribeCards();
    cleanupBoard();
}