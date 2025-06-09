
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase project configuration linking this app to Firebase backend
const firebaseConfig = {
  apiKey: "AIzaSyAuoMGIZ8LHb3S12uNeQcwoiHy7PWfvYQ0",
  authDomain: "zolpark-29396.firebaseapp.com",
  projectId: "zolpark-29396",
  storageBucket: "zolpark-29396.appspot.com",
  messagingSenderId: "6956597921",
  appId: "1:6956597921:web:7e9fb47ef2d7b9abe466e0"
};

// Initialize the Firebase application instance
const app = initializeApp(firebaseConfig);
// Get the Firebase Authentication service instance for this app
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore
// Create a Google Auth provider instance for initiating Google Sign-In
const provider = new GoogleAuthProvider();

onAuthStateChanged(auth, (user) => {
  if (user) {
    // User is already signed in (session was persisted)
    console.log("index.html: User is already signed in (UID:", user.uid, "). Redirecting to map.html.");
    window.location.href = "map.html"; // Redirect them straight to the map
  } else {
    // No user is signed in.
    console.log("index.html: No user signed in. Displaying login options.");
  }
});

// Get the Google Sign-In button element
const googleSignInButton = document.getElementById("google-signin-btn");
// Add click listener to Google Sign-In button
if (googleSignInButton) {
    googleSignInButton.addEventListener("click", () => {
        // Initiate Google Sign-In using a popup window
        signInWithPopup(auth, provider)
            .then(async (result) => {
                // On successful sign-in, get user details
                const user = result.user;
                console.log("Signed in as (Driver/General User):", user.displayName, user.uid);
                // Redirect to the main page after successful login

                // --- Store/Update user data in Firestore ---
                try {
                    const userDocRef = doc(db, "drivers", user.uid); // Document reference using user's UID

                    // Data to save or update
                    const userDataToStore = {
                        uid: user.uid,
                        displayName: user.displayName || "נהג ZolPark", // Provide a fallback if name is null
                        email: user.email,
                    };

                    // Check if the user document already exists to set 'createdAt' only once
                    const docSnap = await getDoc(userDocRef);
                    if (!docSnap.exists()) {
                        userDataToStore.createdAt = serverTimestamp(); // Add createdAt timestamp for new users
                    }
                    
                    await setDoc(userDocRef, userDataToStore, { merge: true });
                    console.log("Driver data saved/updated in Firestore.");

                } catch (firestoreError) {
                    console.error("Error saving user data to Firestore:", firestoreError);

                }
                // --- End Firestore ---

                window.location.href = "map.html";
            })
            .catch((error) => {
                console.error("Error signing in with Google:", error.code, error.message);
                alert("אירעה שגיאה בהתחברות. נסה שוב.");
            });
    });
} else {
    console.warn("Element with ID 'google-signin-btn' not found; Google Sign-In may not be functional.");
}

// Get the Owner Login button element
const ownerLoginButton = document.getElementById("owner-login-btn");
// Add click listener to Owner Login button
if (ownerLoginButton) {
    ownerLoginButton.addEventListener("click", () => {
        // Redirect to the separate login page for parking lot owners
        window.location.href = "login.html";
    });
} else {
    console.warn("Element with ID 'owner-login-btn' not found; Owner login redirect may not be functional.");
}