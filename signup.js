import { auth, db, storage } from './firebase-config.js';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js";

const form = document.getElementById('form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const status = document.getElementById('status');

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

clearErrorOnInput(nameInput);
clearErrorOnInput(emailInput);
clearErrorOnInput(phoneInput);
clearErrorOnInput(passwordInput);

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const phone = phoneInput.value.trim();
  const password = passwordInput.value;

  if(!validateInputs(name, email, phone, password)) {
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;

    // Save data in Firestore
    await setDoc(doc(db, "owners", uid), {
      name,
      email,
      phone,
      createdAt: serverTimestamp()
    });

    form.reset();
    status.innerText = "נרשמת בהצלחה!";
    status.className = "popup-success";

  } catch (error) {
    console.error("Signup error:", error.message);

    let friendlyMessage = "אירעה שגיאה. נסה שוב מאוחר יותר";
  
    switch (error.code) {
      case "auth/email-already-in-use":
        friendlyMessage = "כתובת האימייל הזו כבר בשימוש";
        break;
      case "auth/invalid-email":
        friendlyMessage = "כתובת אימייל לא תקינה";
        break;
      case "auth/weak-password":
        friendlyMessage = "הסיסמה חלשה מדי. יש לבחור סיסמה חזקה יותר";
        break;
      case "auth/operation-not-allowed":
        friendlyMessage = "הרשמה לא זמינה כרגע";
        break;
      default:
        friendlyMessage = "שגיאה לא צפויה. נסה שוב";
        break;
    }
  
    status.innerText = "*הרשמה נכשלה: " + friendlyMessage;
    status.className = "popup-error";
  }
});



// Validation Functions:
const validateInputs = (name, email, phone, password) => {
  let isValid = true;
  if (name === '') {
    setError(nameInput, 'חובה להזין שם');
    isValid = false;  
  }
  else if (!/^[\u0590-\u05FFa-zA-Z\s]+$/.test(name)) {
    setError(nameInput, "אסור להשתמש בתווים מיוחדים או מספרים");
    isValid = false;
  }   
  else if (name.length > 20) {
    setError(nameInput, "השם לא יכול להכיל יותר מ-20 תווים");
    isValid = false;
  }

  if (email === '') {
    setError(emailInput, 'חובה להזין אי מייל');
    isValid = false;
  } else if (!isValidEmail(email)) {
    setError(emailInput, 'יש להזין אי מייל תקין');
    isValid = false;
  }
 
  if (phone === '') {
    setError(phoneInput, 'חובה להזין מספר טלפון');
    isValid = false;
  } else if (!isValidPhone(phone)) {
    setError(phoneInput, 'יש להזין מספר טלפון תקין')
    isValid = false;
  }
  
  if (password === '') {
    setError(passwordInput, 'חובה לבחור סיסמה');
    isValid = false;
  } else if (!isValidPassword(password)) {
    setError(passwordInput, 'הסיסמה צריכה להכיל לפחות 6 תווים, אות גדולה אחת ולפחות מספר אחד')
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

const isValidPassword = password => {
  const hasCapital = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  return password.length >= 6 && hasCapital && hasNumber;
};

const isValidPhone = phone => /^\d{10}$/.test(phone);
