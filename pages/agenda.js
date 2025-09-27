import { db } from '../firebase-config.js';
import { AppState, showNotification, showConfirmation } from '../main.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

let calendar;
let selectedEvent = null;
let currentAgendaView = 'team';
let unsubscribeAgenda;
const dom = {};
const handlers = {};

function setupAgendaListener() {
    if (unsubscribeAgenda) unsubscribeAgenda();
    const { teamId, uid, role } = AppState.currentUser;
    let scheduleQuery;

    const addEventBtn = document.getElementById('add-event-btn');
    if (currentAgendaView === 'team') {
        scheduleQuery = query(collection(db, 'schedules'), where("teamId", "==", teamId), where("scope", "==", "team"));
        if (addEventBtn) addEventBtn.style.display = (role === 'admin' || role === 'gerente') ? 'block' : 'none';
    } else {
        scheduleQuery = query(collection(db, 'schedules'), where("createdBy.uid", "==", uid), where("scope", "==", "personal"));
        if (addEventBtn) addEventBtn.style.display = 'block';
    }

    unsubscribeAgenda = onSnapshot(scheduleQuery, (snapshot) => {
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                title: data.title,
                start: data.startDate.toDate(),
                end: data.endDate ? data.endDate.toDate() : null,
                allDay: true,
                backgroundColor: currentAgendaView === 'team' ? 'var(--accent-color)' : '#37a06e',
                borderColor: currentAgendaView === 'team' ? 'var(--accent-color)' : '#37a06e',
                extendedProps: {
                    description: data.description,
                    createdBy: data.createdBy
                }
            };
        });
        if (calendar) {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    });
}

function openViewModal(info) {
    selectedEvent = {
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        ...info.event.extendedProps
    };

    dom.eventDisplayView.classList.remove('hidden');
    dom.eventEditView.classList.add('hidden');
    dom.editEventBtn.classList.remove('hidden');
    dom.deleteEventBtn.classList.remove('hidden');
    dom.saveEventChangesBtn.classList.add('hidden');

    const formatDate = (date) => date ? date.toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Nenhuma';
    dom.viewEventTitle.textContent = selectedEvent.title;
    dom.viewEventStartDate.textContent = formatDate(selectedEvent.start);
    dom.viewEventEndDate.textContent = formatDate(selectedEvent.end);
    dom.viewEventDescription.textContent = selectedEvent.description || 'Nenhuma';
    dom.viewEventCreatedBy.textContent = selectedEvent.createdBy.displayName;
    
    const { role, uid } = AppState.currentUser;
    const isCreator = uid === selectedEvent.createdBy.uid;
    dom.viewEventActions.classList.toggle('hidden', !(role === 'admin' || role === 'gerente' || isCreator));
    dom.viewEventModal.classList.remove('hidden');
}

export function init() {
    Object.assign(dom, {
        createEventModal: document.getElementById('create-event-modal'),
        viewEventModal: document.getElementById('view-event-modal'),
        createEventModalCloseBtn: document.getElementById('create-event-modal-close-btn'),
        createEventForm: document.getElementById('create-event-form'),
        viewEventModalCloseBtn: document.getElementById('view-event-modal-close-btn'),
        eventDisplayView: document.getElementById('event-display-view'),
        eventEditView: document.getElementById('event-edit-view'),
        viewEventActions: document.getElementById('view-event-actions'),
        deleteEventBtn: document.getElementById('delete-event-btn'),
        editEventBtn: document.getElementById('edit-event-btn'),
        saveEventChangesBtn: document.getElementById('save-event-changes-btn'),
        calendarContainer: document.getElementById('calendar-container'),
        createEventModalTitle: document.getElementById('create-event-modal-title'),
        viewEventTitle: document.getElementById('view-event-title'),
        viewEventStartDate: document.getElementById('view-event-start-date'),
        viewEventEndDate: document.getElementById('view-event-end-date'),
        viewEventDescription: document.getElementById('view-event-description'),
        viewEventCreatedBy: document.getElementById('view-event-created-by'),
    });
    
    calendar = new FullCalendar.Calendar(dom.calendarContainer, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' },
        buttonText: { today: 'Hoje', month: 'Mês', week: 'Semana', list: 'Lista' },
        dateClick: (info) => {
            const { role } = AppState.currentUser;
            if (currentAgendaView === 'personal' || role === 'admin' || role === 'gerente') {
                dom.createEventForm.reset();
                dom.createEventForm.querySelector('#create-event-start-date').value = info.dateStr;
                dom.createEventModalTitle.textContent = currentAgendaView === 'team' ? "Novo Evento da Equipe" : "Novo Evento Pessoal";
                dom.createEventModal.classList.remove('hidden');
            }
        },
        eventClick: openViewModal
    });
    calendar.render();

    setupAgendaListener();
    
    // Define os handlers para os eventos globais
    handlers.showCreateModal = () => dom.createEventModal.classList.remove('hidden');
    handlers.changeView = (e) => {
        const view = e.detail.view;
        const agendaViewControls = document.getElementById('agenda-view-controls');
        if (view && currentAgendaView !== view) {
            currentAgendaView = view;
            agendaViewControls.querySelector('.active').classList.remove('active');
            agendaViewControls.querySelector(`[data-view="${view}"]`).classList.add('active');
            setupAgendaListener();
        }
    };
    handlers.goToDate = (e) => calendar.gotoDate(e.detail.date);
    
    // Adiciona os listeners para os eventos da janela
    window.addEventListener('show-create-event-modal', handlers.showCreateModal);
    window.addEventListener('change-agenda-view', handlers.changeView);
    window.addEventListener('goto-agenda-date', handlers.goToDate);

    // Listeners locais
    handlers.hideCreateModal = () => dom.createEventModal.classList.add('hidden');
    handlers.hideViewModal = () => dom.viewEventModal.classList.add('hidden');
    handlers.createEvent = async (e) => {
        e.preventDefault();
        const title = dom.createEventForm['create-event-title'].value.trim();
        const startDateStr = dom.createEventForm['create-event-start-date'].value;
        if (!title || !startDateStr) return showNotification("Erro", "Título e Data de Início são obrigatórios.");
        const description = dom.createEventForm['create-event-description'].value.trim();
        const endDateStr = dom.createEventForm['create-event-end-date'].value;
        await addDoc(collection(db, 'schedules'), {
            teamId: AppState.currentUser.teamId,
            createdBy: { uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName },
            scope: currentAgendaView, title, description,
            startDate: Timestamp.fromDate(new Date(startDateStr + 'T00:00:00')),
            endDate: endDateStr ? Timestamp.fromDate(new Date(endDateStr + 'T00:00:00')) : null,
            createdAt: serverTimestamp()
        });
        handlers.hideCreateModal();
    };
    
    dom.createEventModalCloseBtn.addEventListener('click', handlers.hideCreateModal);
    dom.viewEventModalCloseBtn.addEventListener('click', handlers.hideViewModal);
    dom.createEventForm.addEventListener('submit', handlers.createEvent);
}

export function cleanup() {
    if (unsubscribeAgenda) unsubscribeAgenda();
    if (calendar) calendar.destroy();
    
    // Remove os listeners globais e locais
    window.removeEventListener('show-create-event-modal', handlers.showCreateModal);
    window.removeEventListener('change-agenda-view', handlers.changeView);
    window.removeEventListener('goto-agenda-date', handlers.goToDate);

    dom.createEventModalCloseBtn?.removeEventListener('click', handlers.hideCreateModal);
    dom.viewEventModalCloseBtn?.removeEventListener('click', handlers.hideViewModal);
    dom.createEventForm?.removeEventListener('submit', handlers.createEvent);
}