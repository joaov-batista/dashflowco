import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4s_sjF1aMOH9ocJSSWFZSU8B3Ul7NGz0",
  authDomain: "taskontask.firebaseapp.com",
  projectId: "taskontask",
  storageBucket: "taskontask.appspot.com",
  messagingSenderId: "496889403759",
  appId: "1:496889403759:web:6550935b989672cddcf09a",
  measurementId: "G-KN8Y1ZP2J1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);