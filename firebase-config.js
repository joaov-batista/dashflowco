import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Importa a configuração do arquivo "env.js" que NÃO está no controle de versão.
// Isso mantém suas chaves secretas seguras.
import { firebaseConfig } from './env.js';

// Verifica se as chaves foram carregadas. Se não, lança um erro claro.
if (!firebaseConfig || !firebaseConfig.apiKey) {
  throw new Error("Configuração do Firebase não encontrada ou incompleta. Crie o arquivo 'env.js' a partir de 'env-example.js' e adicione suas credenciais.");
}

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);