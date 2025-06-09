import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

const form = document.getElementById('form');
const status = document.getElementById('status');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');

// clear error when user starts typing again
function clearErrorOnInput(element) {
  element.addEventListener("input", () => {
    const inputControl = element.parentElement;
    const errorDisplay = inputControl.querySelector(".error");

    errorDisplay.innerText = "";
    inputControl.classList.remove("error");
    inputControl.classList.remove("success");
  });
}
clearErrorOnInput(emailInput);
clearErrorOnInput(passwordInput);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  
  if(!validateInputs(email, password)) {
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    status.innerText = "התחברת בהצלחה!";
    status.className = "popup-success";
    
    // Redirect to profile
    window.location.href = "/owner-profile.html";

  } catch (error) {
    console.error("Login error:", error.message);

    let friendlyMessage = "אירעה שגיאה. נסה שוב מאוחר יותר";
  
    switch (error.code) {
      case "auth/user-not-found":
        friendlyMessage = "המשתמש לא נמצא. בדוק את כתובת האימייל";
        break;
      case "auth/wrong-password":
        friendlyMessage = "סיסמה שגויה. נסה שוב";
        break;
      case "auth/invalid-email":
        friendlyMessage = "כתובת אימייל לא תקינה";
        break;
      case "auth/user-disabled":
        friendlyMessage = "החשבון הזה הושבת";
        break;
      default:
        friendlyMessage = "שגיאה לא צפויה. נסה שוב";
        break;
    }    
    status.innerText = "*התחברות נכשלה: " + friendlyMessage;
    status.className = "popup-error";
  }
});

// Validation Functions:
const validateInputs = (email, password) => {
    let isValid = true;
    if (email === '') {
      setError(emailInput, 'חובה להזין אי מייל');
      isValid = false;
    } 
    else if (!isValidEmail(email)) {
      setError(emailInput, 'יש להזין אי מייל תקין');
      isValid = false;
    }

    if (password === '') {
      setError(passwordInput, 'חובה להזין סיסמה');
      isValid = false;
    } 
    return isValid;
  };

  const setError = (element, message) => {
    const inputControl = element.parentElement;
    const errorDisplay = inputControl.querySelector('.error');
  
    errorDisplay.innerText = message;
    inputControl.classList.add('error');
    inputControl.classList.remove('success');
  
  };
  
  const isValidEmail = email => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
  };