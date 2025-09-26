import { db } from './firebase-config.js';
import { initializeApp, AppState, setupObservations, showNotification, showConfirmation } from './main.js';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const createEventModal = document.getElementById('create-event-modal');
const viewEventModal = document.getElementById('view-event-modal');
const addEventBtn = document.getElementById('add-event-btn');
const createEventModalCloseBtn = document.getElementById('create-event-modal-close-btn');
const createEventForm = document.getElementById('create-event-form');
const viewEventModalCloseBtn = document.getElementById('view-event-modal-close-btn');
const eventDisplayView = document.getElementById('event-display-view');
const eventEditView = document.getElementById('event-edit-view');
const viewEventActions = document.getElementById('view-event-actions');
const deleteEventBtn = document.getElementById('delete-event-btn');
const editEventBtn = document.getElementById('edit-event-btn');
const saveEventChangesBtn = document.getElementById('save-event-changes-btn');
const calendarContainer = document.getElementById('calendar-container');
const gotoDateForm = document.getElementById('goto-date-form');
const agendaViewControls = document.getElementById('agenda-view-controls');
const createEventModalTitle = document.getElementById('create-event-modal-title');

let calendar;
let selectedEvent = null;
let currentAgendaView = 'team';
let unsubscribeAgenda;

initializeApp().then(() => {
    if (AppState.authReady) {
        setupObservations();
        initializeCalendar();
        setupEventListeners();
        setupAgendaListener();
    }
});

function initializeCalendar() {
    calendar = new FullCalendar.Calendar(calendarContainer, {
        initialView: 'dayGridMonth',
        locale: 'pt-br',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,listWeek'
        },
        buttonText: {
            today: 'Hoje',
            month: 'Mês',
            week: 'Semana',
            list: 'Lista'
        },
        editable: false,
        dateClick: function(info) {
            const userRole = AppState.currentUser.role;
            if (currentAgendaView === 'personal' || userRole === 'admin' || userRole === 'gerente') {
                createEventForm.reset();
                document.getElementById('create-event-start-date').value = info.dateStr;
                const modalTitle = currentAgendaView === 'team' ? "Novo Evento da Equipe" : "Novo Evento Pessoal";
                createEventModalTitle.textContent = modalTitle;
                createEventModal.classList.remove('hidden');
            }
        },
        eventClick: function(info) {
            selectedEvent = {
                id: info.event.id,
                ...info.event.extendedProps,
                title: info.event.title,
                start: info.event.start,
                end: info.event.end,
            };
            openViewModal(selectedEvent);
        }
    });
    calendar.render();
}

function setupEventListeners() {
    addEventBtn.addEventListener('click', () => {
        createEventForm.reset();
        const modalTitle = currentAgendaView === 'team' ? "Novo Evento da Equipe" : "Novo Evento Pessoal";
        createEventModalTitle.textContent = modalTitle;
        createEventModal.classList.remove('hidden');
    });

    createEventModalCloseBtn.addEventListener('click', () => createEventModal.classList.add('hidden'));
    viewEventModalCloseBtn.addEventListener('click', () => viewEventModal.classList.add('hidden'));

    agendaViewControls.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            currentAgendaView = e.target.dataset.view;
            document.querySelector('#agenda-view-controls .active').classList.remove('active');
            e.target.classList.add('active');
            setupAgendaListener();
        }
    });

    createEventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const title = createEventForm['create-event-title'].value;
            const description = createEventForm['create-event-description'].value;
            const startDateStr = createEventForm['create-event-start-date'].value;
            const endDateStr = createEventForm['create-event-end-date'].value;

            if (!title || !startDateStr) {
                showNotification("Erro", "Título e Data de Início são obrigatórios.");
                return;
            }

            await addDoc(collection(db, 'schedules'), {
                teamId: AppState.currentUser.teamId,
                createdBy: { uid: AppState.currentUser.uid, displayName: AppState.currentUser.displayName },
                scope: currentAgendaView,
                title, 
                description,
                startDate: Timestamp.fromDate(new Date(startDateStr + 'T00:00:00')),
                endDate: endDateStr ? Timestamp.fromDate(new Date(endDateStr + 'T00:00:00')) : null,
                createdAt: serverTimestamp()
            });

            createEventForm.reset();
            createEventModal.classList.add('hidden');
        } catch (error) {
            console.error("Erro ao adicionar evento:", error);
            showNotification("Erro", "Não foi possível adicionar o evento. Tente novamente.");
        }
    });

    editEventBtn.addEventListener('click', () => {
        eventDisplayView.classList.add('hidden');
        eventEditView.classList.remove('hidden');
        editEventBtn.classList.add('hidden');
        deleteEventBtn.classList.add('hidden');
        saveEventChangesBtn.classList.remove('hidden');
        
        document.getElementById('edit-event-title').value = selectedEvent.title;
        document.getElementById('edit-event-description').value = selectedEvent.description || '';
        document.getElementById('edit-event-start-date').value = dateToInputValue(selectedEvent.start);
        document.getElementById('edit-event-end-date').value = dateToInputValue(selectedEvent.end);
    });

    saveEventChangesBtn.addEventListener('click', async () => {
        if (!selectedEvent) return;
        try {
            const eventRef = doc(db, 'schedules', selectedEvent.id);
            const title = document.getElementById('edit-event-title').value;
            const description = document.getElementById('edit-event-description').value;
            const startDateStr = document.getElementById('edit-event-start-date').value;
            const endDateStr = document.getElementById('edit-event-end-date').value;

            await updateDoc(eventRef, {
                title, description,
                startDate: Timestamp.fromDate(new Date(startDateStr + 'T00:00:00')),
                endDate: endDateStr ? Timestamp.fromDate(new Date(endDateStr + 'T00:00:00')) : null,
            });

            showNotification("Sucesso", "Evento atualizado com sucesso!");
            viewEventModal.classList.add('hidden');
        } catch (error) {
            console.error("Erro ao atualizar evento:", error);
            showNotification("Erro", "Não foi possível atualizar o evento. Tente novamente.");
        }
    });

    deleteEventBtn.addEventListener('click', async () => {
        if (!selectedEvent) return;
        const confirmed = await showConfirmation("Excluir Evento", `Tem certeza que deseja excluir o evento "${selectedEvent.title}"?`);
        if (confirmed) {
            try {
                await deleteDoc(doc(db, 'schedules', selectedEvent.id));
                showNotification("Sucesso", "Evento excluído.");
                viewEventModal.classList.add('hidden');
            } catch (error) {
                console.error("Erro ao excluir evento:", error);
                showNotification("Erro", "Não foi possível excluir o evento. Tente novamente.");
            }
        }
    });

    gotoDateForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const dateInput = document.getElementById('goto-date-input');
        if (dateInput.value) {
            calendar.gotoDate(dateInput.value);
        }
    });
}

function setupAgendaListener() {
    if (unsubscribeAgenda) unsubscribeAgenda();

    let scheduleQuery;
    const userRole = AppState.currentUser.role;
    
    if (currentAgendaView === 'team') {
        scheduleQuery = query(collection(db, 'schedules'), where("teamId", "==", AppState.currentUser.teamId), where("scope", "==", "team"));
        addEventBtn.style.display = (userRole === 'admin' || userRole === 'gerente') ? 'block' : 'none';
    } else {
        scheduleQuery = query(collection(db, 'schedules'), where("createdBy.uid", "==", AppState.currentUser.uid), where("scope", "==", "personal"));
        addEventBtn.style.display = 'block';
    }

    unsubscribeAgenda = onSnapshot(scheduleQuery, (snapshot) => {
        const events = snapshot.docs.map(doc => {
            const data = doc.data();
            const eventColor = currentAgendaView === 'team' ? 'var(--accent-color)' : '#37a06e';
            return {
                id: doc.id,
                title: data.title,
                start: data.startDate.toDate(),
                end: data.endDate ? data.endDate.toDate() : null,
                description: data.description,
                createdBy: data.createdBy,
                allDay: true,
                backgroundColor: eventColor,
                borderColor: eventColor
            };
        });
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    });
}

const formatDate = (date) => {
    if (!date) return 'N/D';
    return new Date(date.getTime() + (date.getTimezoneOffset() * 60000)).toLocaleDateString('pt-BR');
};

const dateToInputValue = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
};

function openViewModal(eventData) {
    eventDisplayView.classList.remove('hidden');
    eventEditView.classList.add('hidden');
    editEventBtn.classList.remove('hidden');
    deleteEventBtn.classList.remove('hidden');
    saveEventChangesBtn.classList.add('hidden');

    document.getElementById('view-event-title').textContent = eventData.title;
    document.getElementById('view-event-start-date').textContent = formatDate(eventData.start);
    document.getElementById('view-event-end-date').textContent = formatDate(eventData.end);
    document.getElementById('view-event-description').textContent = eventData.description || 'Nenhuma';
    document.getElementById('view-event-created-by').textContent = eventData.createdBy.displayName;

    const userRole = AppState.currentUser.role;
    const isCreator = AppState.currentUser.uid === eventData.createdBy.uid;
    
    if (userRole === 'admin' || userRole === 'gerente' || isCreator) {
        viewEventActions.classList.remove('hidden');
    } else {
        viewEventActions.classList.add('hidden');
    }
    
    viewEventModal.classList.remove('hidden');
}