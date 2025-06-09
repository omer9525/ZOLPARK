import { auth, db } from './firebase-config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";

document.addEventListener("DOMContentLoaded", function () {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const nameSpan = document.getElementById("driver-name");
    nameSpan.textContent = user.displayName?.split(" ")[0] || "נהג";

    const tableBody = document.querySelector("#history-body");
    const noDataMsg = document.querySelector(".no-data");

    const historyRef = collection(db, "drivers", user.uid, "parkingHistory");
    const snapshot = await getDocs(historyRef);

    if (snapshot.empty) {
      noDataMsg.style.display = "block";
      return;
    }

    const sortedDocs = snapshot.docs
      .map(doc => doc.data())
      .sort((a, b) => {
        const dateA = new Date(a.date.split('/').reverse().join('-'));
        const dateB = new Date(b.date.split('/').reverse().join('-'));
        return dateB - dateA;
      });
  
    sortedDocs.forEach(data => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${data.date}</td>
        <td>${data.parkingLotName}</td>
        <td>${formatDuration(data.durationMinutes)}</td>
        <td>${data.totalPrice} ₪</td>
      `;
      tableBody.appendChild(row);
    });
  });
});

function formatDuration(minutes) {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hrs && mins) return `${hrs} שעות ו-${mins} דקות`;
  if (hrs) return `${hrs} שעות`;
  return `${mins} דקות`;
}

// Sign out current user
document.getElementById("signout-btn").addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Error signing out:", err.message);
  }
});