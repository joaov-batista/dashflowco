import { db } from '../firebase-config.js';
import { AppState, showNotification } from '../main.js';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let unsubscribeChat = null;
const dom = {};
const handlers = {};

function createMessageElement(message) {
    const el = document.createElement('div');
    el.className = 'chat-message';
    const messageClass = message.senderId === AppState.currentUser.uid ? 'sent' : 'received';
    el.classList.add(messageClass);
    el.innerHTML = `<div class="message-sender"></div><div class="message-text"></div>`;
    el.querySelector('.message-sender').textContent = messageClass === 'sent' ? 'Você' : message.senderName;
    el.querySelector('.message-text').textContent = message.text;
    return el;
}

export function init() {
    dom.chatMessages = document.getElementById('chat-messages');
    dom.chatForm = document.getElementById('chat-form');
    dom.chatInput = document.getElementById('chat-input');

    const teamId = AppState.currentUser.teamId;
    const messagesQuery = query(collection(db, 'chats'), where("teamId", "==", teamId), orderBy('timestamp', 'desc'), limit(50));

    unsubscribeChat = onSnapshot(messagesQuery, (snapshot) => {
        dom.chatMessages.innerHTML = '';
        if (snapshot.empty) {
            dom.chatMessages.innerHTML = `<p class="chat-loading">Nenhuma mensagem ainda.</p>`;
        } else {
            const messages = snapshot.docs.map(doc => doc.data()).reverse();
            messages.forEach(message => dom.chatMessages.appendChild(createMessageElement(message)));
            dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
        }
    });

    handlers.handleChatSubmit = async (e) => {
        e.preventDefault();
        const messageText = dom.chatInput.value.trim();
        if (!messageText) return;
        dom.chatInput.disabled = true;
        try {
            await addDoc(collection(db, 'chats'), {
                text: messageText,
                teamId: AppState.currentUser.teamId,
                senderId: AppState.currentUser.uid,
                senderName: AppState.currentUser.displayName,
                timestamp: serverTimestamp()
            });
            dom.chatInput.value = '';
        } catch (error) {
            showNotification("Erro", "Não foi possível enviar a mensagem.");
        } finally {
            dom.chatInput.disabled = false;
            dom.chatInput.focus();
        }
    };
    
    dom.chatForm.addEventListener('submit', handlers.handleChatSubmit);
}

export function cleanup() {
    if (unsubscribeChat) unsubscribeChat();
    if (dom.chatForm) {
        dom.chatForm.removeEventListener('submit', handlers.handleChatSubmit);
    }
}