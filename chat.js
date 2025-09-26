import { db } from './firebase-config.js';
import { initializeApp, AppState, setupObservations } from './main.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');

initializeApp().then(() => {
    if (AppState.authReady) {
        setupObservations();
        setupChatListener();
    }
});

function setupChatListener() {
    const teamId = AppState.currentUser.teamId;
    const messagesQuery = query(
        collection(db, 'chats'),
        where("teamId", "==", teamId),
        orderBy('timestamp')
    );

    onSnapshot(messagesQuery, (snapshot) => {
        chatMessages.innerHTML = '';
        if (snapshot.empty) {
            chatMessages.innerHTML = `<p class="chat-loading">Nenhuma mensagem ainda. Comece a conversa!</p>`;
        } else {
            snapshot.forEach(doc => {
                const message = doc.data();
                chatMessages.appendChild(createMessageElement(message));
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
    }, 
    (error) => {
        console.error("ERRO AO CARREGAR O CHAT:", error);
        chatMessages.innerHTML = `<p class="chat-loading">Falha ao carregar o chat. Verifique o console para um link de criação de índice do Firestore.</p>`;
    });
}

chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageText = chatInput.value.trim();
    if (messageText && AppState.currentUser) {
        await addDoc(collection(db, 'chats'), {
            text: messageText,
            teamId: AppState.currentUser.teamId,
            senderId: AppState.currentUser.uid,
            senderName: AppState.currentUser.displayName,
            timestamp: serverTimestamp()
        });
        chatInput.value = '';
    }
});

function createMessageElement(message) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    if (message.senderId === AppState.currentUser.uid) {
        el.classList.add('sent');
    } else {
        el.classList.add('received');
    }

    const sender = document.createElement('div');
    sender.className = 'message-sender';
    sender.textContent = message.senderName;
    
    const text = document.createElement('div');
    text.className = 'message-text';
    text.textContent = message.text;
    
    el.append(sender, text);
    return el;
}