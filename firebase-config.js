import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";


const firebaseConfig = {
    apiKey: "AIzaSyAuoMGIZ8LHb3S12uNeQcwoiHy7PWfvYQ0",
    authDomain: "zolpark-29396.firebaseapp.com",
    projectId: "zolpark-29396",
    storageBucket: "zolpark-29396.appspot.com",
    messagingSenderId: "6956597921",
    appId: "1:6956597921:web:7e9fb47ef2d7b9abe466e0"
  };
  

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const storage = getStorage(app);

  export { auth, db, storage };