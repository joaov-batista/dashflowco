# DashFlowCo - Gerenciador de Tarefas e Equipes

<img width="1919" height="1079" alt="Captura de tela 2025-09-28 140855" src="https://github.com/user-attachments/assets/bedb568a-4d30-4a69-b36b-88aaa9c35be2" /> **DashFlowCo** é uma aplicação web completa (SaaS) projetada para otimizar o fluxo de trabalho e a comunicação em equipes. A plataforma oferece um conjunto de ferramentas integradas para gerenciamento de tarefas, comunicação em tempo real e organização de agendas, tudo em uma interface rápida, segura e responsiva.

**Para testar entre: https://dashflowco.vercel.app/**

**Utilize o codigo de convite: BETA123**

---

## ✨ Funcionalidades Principais

* **Autenticação Segura:** Sistema de login e registro com verificação de e-mail.
* **Quadro Kanban de Equipe:** Organize tarefas da equipe em colunas (ex: "Metas", "A Fazer", "Concluído") com funcionalidade de arrastar e soltar.
* **Quadro Kanban Pessoal:** Cada usuário possui um quadro privado para gerenciar suas próprias tarefas.
* **Agenda Integrada:** Uma agenda completa onde é possível criar eventos para a equipe ou eventos pessoais.
* **Gerenciamento de Equipe:** Administradores e gerentes podem visualizar membros, alterar cargos e gerenciar usuários.
* **Relatório de Atividade (Logs):** Gerentes e administradores podem visualizar o histórico de status de cada membro (Online, Pausa, Offline).
* **Chat em Tempo Real:** Um chat integrado para a comunicação instantânea entre os membros da equipe.
* **Sistema de Status de Usuário:** Saiba quem está "Trabalhando", em "Pausa" ou "Offline". O status é atualizado automaticamente quando o usuário fecha a aplicação.
* **Painel de Avisos:** Um mural de avisos para comunicados importantes para toda a equipe.
* **Interface Responsiva e Customizável:** A aplicação funciona perfeitamente em desktops e dispositivos móveis, com temas claro, escuro e padrão.

---

## 🚀 Tecnologias Utilizadas

* **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
* **Backend & Banco de Dados:** Google Firebase (Firestore Database, Authentication)
* **Bibliotecas:** FullCalendar.js para a Agenda

---

## 🛠️ Configuração do Projeto

Para rodar este projeto localmente, siga os passos abaixo:

1.  **Clone o Repositório**
    ```bash
    git clone https://github.com/joaov-batista/dashflowco
    cd dashflowco
    ```

2.  **Configure o Firebase**
    * Crie um projeto no [Firebase](https://console.firebase.google.com/).
    * Ative os serviços de **Authentication** (com o provedor "E-mail/Senha" habilitado e a verificação de e-mail ativada) e **Firestore Database**.
    * Nas configurações do seu projeto no Firebase, crie uma "Web App" e copie as credenciais de configuração (o objeto `firebaseConfig`).

3.  **Crie o Arquivo de Credenciais**
    * Na raiz do projeto, renomeie o arquivo `env-example.js` para `env.js`.
    * Cole as suas credenciais do Firebase dentro do objeto `firebaseConfig` no arquivo `env.js`.
    * **IMPORTANTE:** O arquivo `env.js` nunca deve ser enviado para o GitHub. Ele já está incluído no `.gitignore`.

4.  **Estrutura do Banco de Dados (Firestore)**
    O sistema criará as coleções `users`, `lists`, `cards`, etc., automaticamente. No entanto, você precisa criar sua primeira equipe manualmente:
    * Vá para o Firestore Database.
    * Crie uma coleção chamada `teams`.
    * Adicione um documento com os campos:
        * `teamName` (string): O nome da sua equipe.
        * `inviteCode` (string): Um código de convite único (ex: "EQUIPE123") que os novos usuários usarão para se registrar.

5.  **Instale um Servidor Local**
    Esta é uma Single-Page Application (SPA) e precisa de um servidor que suporte o modo "history fallback". Recomendamos o `serve`.
    ```bash
    npm install -g serve
    ```

6.  **Rode a Aplicação**
    Na pasta do projeto, execute:
    ```bash
    serve -s
    ```
    A aplicação estará disponível em `http://localhost:3000` (ou a porta que o `serve` indicar).

7.  **Torne-se Admin**
    * Registre seu primeiro usuário usando o código de convite que você criou.
    * Vá ao Firestore, encontre seu usuário na coleção `users` e mude o campo `role` de "funcionário" para "admin".

---

## 👤 Autor

* **João Batista** - joaovbalcantara@gmail.com
* **GitHub:** https://github.com/joaov-batista
* **LinkedIn:** https://www.linkedin.com/in/joaov-batista
