import { AppState } from "./main.js";

const routes = {
    '/quadro': { view: '/views/quadro.html', script: '/pages/quadro.js', title: 'Quadro da Equipe' },
    '/tarefas': { view: '/views/tarefas.html', script: '/pages/tarefas.js', title: 'Quadro Pessoal' },
    '/agenda': { view: '/views/agenda.html', script: '/pages/agenda.js', title: 'Agenda' },
    '/equipe': { view: '/views/equipe.html', script: '/pages/equipe.js', title: 'Equipe' },
    '/chat': { view: '/views/chat.html', script: '/pages/chat.js', title: 'Chat da Equipe' }
};

let currentModuleCleanup = null;

async function loadScript(url) {
    if (document.querySelector(`script[src="${url}"]`)) return;
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

async function handleRouteChange() {
    if (currentModuleCleanup) {
        currentModuleCleanup();
        currentModuleCleanup = null;
    }

    const path = window.location.hash.substring(1) || '/quadro';
    const route = routes[path] || routes['/quadro'];
    
    document.getElementById('agenda-header-controls').classList.toggle('hidden', path !== '/agenda');

    const appContent = document.getElementById('app-content');
    appContent.innerHTML = '<p class="chat-loading">Carregando...</p>';

    try {
        const response = await fetch(route.view);
        appContent.innerHTML = await response.text();

        if (path === '/agenda') {
            await loadScript('https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js');
        }

        const module = await import(route.script);
        if (typeof module.init === 'function') {
            module.init();
        }
        if (typeof module.cleanup === 'function') {
            currentModuleCleanup = module.cleanup;
        }

        updateUI(path, route.title);

    } catch (error) {
        console.error("Erro ao carregar a página:", error);
        appContent.innerHTML = '<p class="chat-loading">Erro ao carregar a página.</p>';
    }
}

function updateUI(path, title) {
    const pageTitle = document.getElementById('page-title');
    const teamName = AppState.teamInfo ? `<span class="team-name">${AppState.teamInfo.teamName}</span>` : '';
    pageTitle.innerHTML = `${title} ${teamName}`;
    document.title = `DashFlowCo - ${title}`;

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.path === path);
    });
}

export function setupRouter() {
    // Adiciona os listeners dos botões do cabeçalho uma única vez
    document.getElementById('add-event-btn')?.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('show-create-event-modal'));
    });
    document.getElementById('agenda-view-controls')?.addEventListener('click', (e) => {
        if(e.target.classList.contains('filter-btn')){
            window.dispatchEvent(new CustomEvent('change-agenda-view', { detail: { view: e.target.dataset.view }}));
        }
    });
    document.getElementById('goto-date-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = e.target.querySelector('input').value;
        if(date) window.dispatchEvent(new CustomEvent('goto-agenda-date', { detail: { date }}));
    });

    // Lida com a navegação
    window.addEventListener('hashchange', handleRouteChange);
    if (!window.location.hash) {
        window.location.hash = '#/quadro';
    } else {
        handleRouteChange();
    }
}