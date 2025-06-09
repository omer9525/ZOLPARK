import { auth, db } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";

const greeting = document.getElementById("greeting");
const nameSpan = document.getElementById("owner-name");
const emailSpan = document.getElementById("owner-email");
const phoneSpan = document.getElementById("owner-phone");
const detailsContent = document.getElementById("details-content");
const toggleDetailsBtn = document.getElementById("toggle-details");
const lotsBody = document.getElementById("lots-body");
const lotFormContainer = document.getElementById("lot-form-container");
const toggleLotFormBtn = document.getElementById("toggle-lot-form");
const lotForm = document.getElementById("lot-form");
const lotStatus = document.getElementById("lot-status");
const signoutBtn = document.getElementById("signout-btn");
const alwaysOpenCheckbox = document.getElementById("always-open");
const parkingBubbles = {};
let activeBubble = null;
let currentMarkers = [];
let parkingSpots = [];
let map;


// save operating days in db in English
const dayMap = {
  "ראשון": "sunday",
  "שני": "monday",
  "שלישי": "tuesday",
  "רביעי": "wednesday",
  "חמישי": "thursday",
  "שישי": "friday",
  "שבת": "saturday"
};

function populateHourSelect(select) {
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "בחר שעה";
  defaultOption.disabled = true;
  defaultOption.selected = true;
  select.appendChild(defaultOption);

  for (let hour = 0; hour < 24; hour++) {
    const value = hour.toString().padStart(2, "0") + ":00";
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  }
}

function buildSimplifiedOpeningHoursUI() {
  const container = document.getElementById("opening-hours-section");
  container.innerHTML = "";

  const html = `
    <div id="def-popup" class="hidden popup">*נקה בחירת שעות מטה כדי לבחור מכאן</div>
    <div style="margin-bottom: 10px;">
      <label><strong>א'-ה':</strong></label>
      <label>מ: <select id="weekday-from" class="disable-control def-section"></select></label>
      <label>עד: <select id="weekday-to" class="disable-control def-section"></select></label>
      <input type="button" id="weekday-reset" class="reset-choice" value="נקה"/>
    </div>
    <div class="hours-row">
      <div class="select-options">
        <label><strong>שישי:</strong></label>
        <label>מ: <select id="hlfday-from" class="disable-control def-section"></select></label>
        <label>עד: <select id="hlfday-to" class="disable-control def-section"></select></label>
        <input type="button" id="hlfday-reset" class="reset-choice" value="נקה"/>
      </div>
      <div class="checkboxes">
        <input type="checkbox" id="hlfday-closed" class="disable-control def-section-closed">
        <label for="hlfday-closed">סגור</label>
      </div>
    </div>    
    <div class="hours-row">
      <div class="select-options">      
        <label><strong>שבתות וחגים:</strong></label>
        <label>מ: <select id="offday-from" class="disable-control def-section"></select></label>
        <label>עד: <select id="offday-to" class="disable-control def-section"></select></label>
        <input type="button" id="offday-reset" class="reset-choice" value="נקה"/>
      </div>
      <div class="checkboxes">
        <input type="checkbox" id="offday-closed" class="disable-control def-section-closed">
        <label for="offday-closed">סגור</label>
      </div>
    </div>
    <button type="button" id="toggle-full-hours" class="light-button">הלו"ז שלכם שונה?</button>
    <div id="full-hours-section" class="hidden" style="margin-top: 15px;"></div>
  `;

  container.insertAdjacentHTML("beforeend", html);

  document.getElementById("toggle-full-hours").addEventListener("click", () => {
    const section = document.getElementById("full-hours-section");
    if (section.classList.contains("hidden")) {
      buildFullBreakdownUI(section);
      section.classList.remove("hidden");
      alwaysOpenValidation();
      attachResetListeners();
    } else {
      section.classList.add("hidden");
      section.innerHTML = "";
    }
  });

  populateHourSelect(document.getElementById("weekday-from"));
  populateHourSelect(document.getElementById("weekday-to"));
  populateHourSelect(document.getElementById("hlfday-from"));
  populateHourSelect(document.getElementById("hlfday-to"));  
  populateHourSelect(document.getElementById("offday-from"));
  populateHourSelect(document.getElementById("offday-to"));

  document.getElementById("offday-closed").addEventListener("change", function () {
    document.getElementById("offday-from").disabled = this.checked;
    document.getElementById("offday-to").disabled = this.checked;
    disableSection(); // disable custom section if this is checked
  });

  document.getElementById("hlfday-closed").addEventListener("change", function () {
    document.getElementById("hlfday-from").disabled = this.checked;
    document.getElementById("hlfday-to").disabled = this.checked;
    disableSection(); // disable custom section if this is checked
  });

}

function buildFullBreakdownUI(container) {
  container.insertAdjacentHTML("beforeend", '<div id="custom-popup" class="hidden popup">*נקה בחירת שעות מעלה כדי לבחור מכאן</div>');
  Object.entries(dayMap).forEach(([heb, eng]) => {
    const fromId = `${eng}-from`;
    const toId = `${eng}-to`;
    const closedId = `${eng}-closed`;

    container.insertAdjacentHTML("beforeend", `
      <label><strong>${heb}</strong></label>
      <div class="hours-row">
        <div class="select-options">
          <label>מ: <select id="${fromId}" class="disable-control custom-section"></select></label>
          <label>עד: <select id="${toId}" class="disable-control custom-section"></select></label>
          <input type="button" id="${eng}-reset" class="reset-choice" value="נקה"/>
        </div>
        <div class="checkboxes">
          <input type="checkbox" id="${closedId}" class="disable-control custom-section-closed">
          <label for="${closedId}">סגור</label>
        </div>
      </div>
    `);

    const fromSelect = document.getElementById(fromId);
    const toSelect = document.getElementById(toId);
    const closedCheck = document.getElementById(closedId);
    populateHourSelect(fromSelect);
    populateHourSelect(toSelect);

    fromSelect.addEventListener("change", disableSection);
    toSelect.addEventListener("change", disableSection);

    closedCheck.addEventListener("change", function () {
      fromSelect.disabled = this.checked;
      toSelect.disabled = this.checked;
      disableSection(); // disable default section if any checkbox is checked
    });
  });
}

// apply the event listener on click for all the reset buttons in the form
function attachResetListeners() {
  document.querySelectorAll('input[type="button"][class="reset-choice"]').forEach(btn => {
    btn.addEventListener("click", () => {
      btn.parentElement.querySelectorAll("select").forEach(select => {
        select.selectedIndex = 0;
      });   
      disableSection();   
    });
  });
}

buildSimplifiedOpeningHoursUI(); // build the entire operating days and hours UI
attachResetListeners(); // add reset hours funtionality

alwaysOpenCheckbox.addEventListener("change", alwaysOpenValidation); // disable other operating hours if 24/7 is checked

//return all selects from default section after DOM loads
function getDefaultSection() {
  return document.querySelectorAll('.def-section');
}
//return all selects from custom section after DOM loads
function getCustomSection() {
  return document.querySelectorAll('.custom-section');
}
//return all "closed" checkboxes from default section after DOM loads
function getClosedDefault() {
  return document.querySelectorAll('.def-section-closed');
}
//return all "closed" checkboxes from custom section after DOM loads
function getClosedCustom() {
  return document.querySelectorAll('.custom-section-closed');
}
//if you select a time from one section - disable the other section 
// (preventing contradicting values in db)

function disableSection() {
  const defaultSection = getDefaultSection();
  const customSection = getCustomSection();
  const closedDefault = getClosedDefault();
  const closedCustom = getClosedCustom();
  let defaultPopup = document.getElementById("def-popup"); // warning message in def section
  let customPopup = document.getElementById("custom-popup"); // warning message in custom section

  if (!defaultPopup || !customPopup) return; // make sure both pop-ups exist in DOM

  if (!isSectionEmpty(defaultSection, closedDefault)) {
    customSection.forEach(el => el.disabled = true);
    enableOnlyOpenDays(defaultSection);
    closedCustom.forEach(el => el.disabled = true);
    closedDefault.forEach(el => el.disabled = false);
    customPopup.classList.remove("hidden");
    defaultPopup.classList.add("hidden");
  }
  else if(!isSectionEmpty(customSection, closedCustom)) {
    defaultSection.forEach(el => el.disabled = true);
    enableOnlyOpenDays(customSection);
    closedCustom.forEach(el => el.disabled = false);
    closedDefault.forEach(el => el.disabled = true);
    customPopup.classList.add("hidden");
    defaultPopup.classList.remove("hidden");    
  }
  else {
    defaultSection.forEach(el => el.disabled = false);
    customSection.forEach(el => el.disabled = false);
    closedCustom.forEach(el => el.disabled = false);
    closedDefault.forEach(el => el.disabled = false);
    customPopup.classList.add("hidden");
    defaultPopup.classList.add("hidden");
  }
}

// helper function which validates that nothing is selected or checked in a section (def/custom)
function isSectionEmpty(selects, checkboxes) {
  const selectsEmpty = Array.from(selects).every(select => !select.value);
  const checkboxesEmpty = Array.from(checkboxes).every(checkbox => !checkbox.checked);
  return selectsEmpty && checkboxesEmpty;
}

// helper function that safely re-enables def/custom section without enabling selection on closed days
function enableOnlyOpenDays(section) {
  section.forEach(select => {
    const closedCheckboxId = select.id.replace('-from', '-closed').replace('-to', '-closed');
    const closedCheckbox = document.getElementById(closedCheckboxId);

    if (!closedCheckbox || !closedCheckbox.checked) {
      select.disabled = false;
    }
  });
}

// Attach the change event listener to all selects in both sections
getDefaultSection().forEach(select => {
  select.addEventListener('change', disableSection)
});

// disable relevant elements if 24/7 is checked
function alwaysOpenValidation() {
  let controlState = false;
  let popup247 = document.getElementById("popup247"); // warning message when toggling 24/7
  let defaultPopup = document.getElementById("def-popup"); // warning message in def section
  let customPopup = document.getElementById("custom-popup"); // warning message in custom section
  if(alwaysOpenCheckbox.checked) {
   controlState = true;
   popup247.classList.remove("hidden");
   if(customPopup) customPopup.classList.add("hidden");
   defaultPopup.classList.add("hidden");
   document.querySelectorAll('select.disable-control').forEach(select => {
    select.selectedIndex = 0;
    document.querySelectorAll('input[type="checkbox"].disable-control').forEach(checkbox => {
      checkbox.checked = false;
    });
  });
  }
  else {
    popup247.classList.add("hidden");
  }
  document.querySelectorAll('.disable-control').forEach(el => {
    el.disabled = controlState;
  });
} 

// wait for the map before adding stuff to it
function waitForGoogleMaps() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google && window.google.maps) {
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

// show only today's operating hours in the bubble
function getTodayHours(hours) {
  const daysMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date().getDay();
  const dayKey = daysMap[today];
  const todayHours = hours[dayKey];
  if (!todayHours || todayHours.closed) return "סגור";
  if ((todayHours.open === "00:00" || todayHours.open === "0:00") && (todayHours.close === "23:59" || todayHours.close === "24:00")) {
    return "כל היום";
  }
  return `${todayHours.open} - ${todayHours.close}`;
}

// create the google map and populate it
async function initMapForOwner(userId) {
  await waitForGoogleMaps(); // makes sure `google` is defined before anything

  class InfoBubbleOverlay extends google.maps.OverlayView {
    constructor(position, data, map) {
      super();
      this.position = position;
      this.data = data;
      this.map = map;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = "info-bubble";

      this.div.innerHTML = `
        <div class="bubble-box">
        <button class="close-bubble">✖</button>
        <strong>${this.data.name}</strong>
        <div><span style="font-weight: 600; color: #5271ff;">📍 כתובת:</span> ${this.data.address}</div>
        <div><span style="font-weight: 600; color: #5271ff;">⏰ שעות פעילות להיום:</span> ${getTodayHours(this.data.hours)}</div>
    
        <div><span style="font-weight: 600; color: #5271ff;">💰 מחירון:</span></div>
        <table style="width: 100%; margin-top: 0.2rem; margin-bottom: 0.2rem; border: 1px solid #5271ff; border-collapse: collapse; font-size: 0.8rem; text-align: center;">
          <thead>
            <tr style="background-color: #5271ff; color: white;">
              <th>זמן</th>
              <th>מחיר</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>חמש דקות ראשונות</td>
              <td>חינם*</td>
            </tr>
            <tr>
              <td>שעה הראשונה</td>
              <td>${this.data.price.firstHour} ₪</td>
            </tr>
            <tr>
              <td>לכל רבע שעה נוספת</td>
              <td>${this.data.price.perQuarter} ₪</td>
            </tr>
          </tbody>
        </table>
      `;
       this.div.querySelector(".close-bubble").addEventListener("click", () => {
        
        this.setMap(null);
        if (map) {
          map.setZoom(15); // אפשר גם 13 אם אתה רוצה חזרה רחבה יותר
        }
      });

      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(this.div);
    }

    draw() {
      if (!this.div || this.div.classList.contains("hidden")) return;

      const projection = this.getProjection();
      const pos = projection.fromLatLngToDivPixel(this.position);
      if (this.div && pos) {
        this.div.style.position = "absolute";
        this.div.style.left = `${pos.x}px`;
        this.div.style.top = `${pos.y - 100}px`;
        this.div.style.transform = "translate(-50%)";
      }
    }


    onRemove() {
      if (this.div) {
        this.div.remove();
        this.div = null;
      }
    }
  } 

  class ParkingMarker extends google.maps.OverlayView {
    constructor(position, spotData, map, isOwnerLot) {
      super();
      this.position = position;
      this.spotData = spotData;
      this.map = map;
      this.isOwnerLot = isOwnerLot;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      this.div = document.createElement("div");
      this.div.className = "price-marker";
      if (this.isOwnerLot) this.div.classList.add("owner-lot");

      this.div.innerHTML = `
        <div class="marker-content">
          <div class="marker-icon">🅿️</div>
          <div class="marker-text">
            <div class="price">${this.spotData.price.firstHour}₪</div>
            <div class="per-hour">לשעה</div>
          </div>
        </div>
      `;      
      
      this.div.addEventListener("click", () => {
      if (window.activeBubble) window.activeBubble.setMap(null);
      map.panTo(this.position);
      map.setZoom(16);

      if (parkingBubbles[this.spotData.name] && parkingBubbles[this.spotData.name].div !== null) {
        const existingBubble = parkingBubbles[this.spotData.name];
        existingBubble.div.classList.remove("hidden");
        existingBubble.setMap(map);
        window.activeBubble = existingBubble
      } 
      else {
        const bubble = new InfoBubbleOverlay(this.position, this.spotData, this.map);
        parkingBubbles[this.spotData.name] = bubble;
        window.activeBubble = bubble;
      }

      });



      const panes = this.getPanes();
      if (panes?.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(this.div);
      }
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      const pos = projection.fromLatLngToDivPixel(this.position);
      if (pos) {
        this.div.style.left = `${pos.x}px`;
        this.div.style.top = `${pos.y}px`;
        this.div.style.position = "absolute";
        this.div.style.transform = "translate(-50%, -50%)";
        this.div.style.zIndex = this.isOwnerLot ? "9999" : "1000";
      }
    }

    onRemove() {
      if (this.div?.parentNode) this.div.parentNode.removeChild(this.div);
      this.div = null;
    }
  }

  const container = document.getElementById("owner-map-canvas");

  const cleanMapStyle = [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", stylers: [{ saturation: -100 }, { lightness: 30 }] },
    { featureType: "administrative", stylers: [{ visibility: "off" }] },
    { featureType: "water", stylers: [{ color: "#d4e4f4" }] },
    { featureType: "landscape", stylers: [{ color: "#f4f4f4" }] }
  ];

  const map = new google.maps.Map(container, {
    center: { lat: 32.0728, lng: 34.7799 },
    zoom: 13,
    disableDefaultUI: true,
    styles: cleanMapStyle,
    gestureHandling: "greedy"
  });


  const allSpots = [];
  const ownersSnapshot = await getDocs(collection(db, "owners"));
  for (const ownerDoc of ownersSnapshot.docs) {
    const lotsSnapshot = await getDocs(collection(db, `owners/${ownerDoc.id}/parkingLots`));
    lotsSnapshot.forEach(doc => {
      const data = doc.data();
      allSpots.push({
        id: doc.id, // <== חובה
        ownerId: ownerDoc.id,
        name: data.name || '',
        lat: data.lat,
        lng: data.lng,
        address: data.address || '',
        price: {
          firstHour: Number(data.prices?.perHour) || 0,
          perQuarter: Number(data.prices?.perExtra15Min) || 0
        },
        hours: data.openingHours || {}
      });
    });
  }

  allSpots.forEach(spot => {
    const pos = new google.maps.LatLng(spot.lat, spot.lng);
    new ParkingMarker(pos, spot, map, spot.ownerId === userId);
  });
}


let autocompleteService;
let addressInput = document.getElementById('lot-address');
let suggestionsContainer = document.getElementById('suggestions-container');
let placeId = null;
let address = null;
let lat = null;
let lng = null;
let placesService;

// Initialize AutocompleteService function
function initApp() {
      if (!addressInput) {
        console.error("Address input 'lot-address' not found. Check your HTML ID or script defer status.");
        return;
    }
    if (!suggestionsContainer) {
        console.error("Suggestions container 'suggestions-container' not found.");
    }
    // Initialize the AutocompleteService and Places Service
    autocompleteService = new google.maps.places.AutocompleteService();
    placesService = new google.maps.places.PlacesService(document.createElement('div'));

    // Add event listener to the input field
    addressInput.addEventListener('input', handleInput);

    // Close suggestions when clicking outside the input or suggestions
    document.addEventListener('click', function(event) {
        const isClickInsideInput = addressInput.contains(event.target);
        const isClickInsideSuggestions = suggestionsContainer.contains(event.target);
        if (!isClickInsideInput && !isClickInsideSuggestions) {
            clearSuggestions();
        }
    });
    auth.onAuthStateChanged(async (user) => { // if owner is authinticated - show him his lots
      if (user) {
        await initMapForOwner(user.uid);
        }
    });
    
 

}

function handleInput(event) {
    const query = event.target.value;

    if (query.length < 2) { // Don't search for queries shorter than 2 characters
        clearSuggestions();
        return;
    }

    const request = {
        input: query,
        componentRestrictions: { country: 'il' }, // Restrict to Israel
    };

    autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            displaySuggestions(predictions);
        } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
            displayNoSuggestionsMessage();
        } else {
            console.warn('AutocompleteService error or no predictions:', status);
            clearSuggestions(); // Clear in case of other errors too
        }
    });
}

function displaySuggestions(predictions) {
    clearSuggestions(); // Clear previous suggestions

    predictions.forEach(prediction => {
        const suggestionItem = document.createElement('div');
        suggestionItem.classList.add('suggestion-item');
        suggestionItem.textContent = prediction.description; // `description` is the human-readable name

        suggestionItem.addEventListener('click', () => {
            placeId = prediction.place_id;
            address = prediction.description;
            addressInput.value = address; // Populate input with selected suggestion
            clearSuggestions();
            addressInput.focus();
            const request = {
                placeId: placeId,
                fields: ['geometry.location']
            };

            placesService.getDetails(request, (place, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry && place.geometry.location) {
                  // Successfully retrieved details
                  lat = place.geometry.location.lat();
                  lng = place.geometry.location.lng();

                  console.log('Fetched Latitude:', lat);
                  console.log('Fetched Longitude:', lng);

                } else {
                  console.error('PlacesService.getDetails failed:', status);
                  lat = null; // Ensure they remain null
                  lng = null;
                  }
                });            
        });

        suggestionsContainer.appendChild(suggestionItem);
    });
    suggestionsContainer.style.display = 'block'; // Make suggestions visible
}

function displayNoSuggestionsMessage() {
    clearSuggestions();
    const noResultsMessage = document.createElement('div');
    noResultsMessage.classList.add('suggestion-item', 'no-suggestion');
    noResultsMessage.textContent = 'לא נמצאו תוצאות.';
    suggestionsContainer.appendChild(noResultsMessage);
    suggestionsContainer.style.display = 'block';
}

function clearSuggestions() {
    suggestionsContainer.innerHTML = '';
    suggestionsContainer.style.display = 'none'; // Hide suggestions
}

// Make initApp globally available for the Google Maps callback
window.initApp = initApp;


// Toggle personal details section
toggleDetailsBtn.addEventListener("click", () => {
  detailsContent.classList.toggle("hidden");
});

// Toggle lot form visibility
toggleLotFormBtn.addEventListener("click", () => {
  lotFormContainer.classList.toggle("hidden");
});

// Load owner profile and parking lots when user is authenticated
auth.onAuthStateChanged(async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const uid = user.uid;
  const ownerSnap = await getDoc(doc(db, "owners", uid));

  if (ownerSnap.exists()) {
    const owner = ownerSnap.data();
    const firstName = owner.name.split(" ")[0] || owner.name;
    greeting.innerText = `שלום, ${firstName}!`;
    nameSpan.innerText = owner.name;
    emailSpan.innerText = owner.email;
    phoneSpan.innerText = owner.phone;
  }
  await loadLotButtons(uid); 

});
  const lotButtonsContainer = document.getElementById("lot-buttons-container");

  // זמינות גלובלית לפונקציות שנקראות מ־onclick
  window.enableEditMode = function (lotId, buttonElement) {
  const row = buttonElement.closest("tr");
  const cells = row.querySelectorAll("td");

  const currentHourPrice = cells[1].innerText.replace("₪", "").trim();
  const currentQuarterPrice = cells[2].innerText.replace("₪", "").trim();

  cells[1].innerHTML = `<input type="number" id="edit-hour-${lotId}" value="${currentHourPrice}" min="0" max="99" step="0.5" style="width: 60px;">`;
  cells[2].innerHTML = `<input type="number" id="edit-quarter-${lotId}" value="${currentQuarterPrice}" min="0" max="99" step="0.5" style="width: 60px;">`;
  cells[3].innerHTML = `
    <button class="edit-price-btn" onclick="savePrices('${lotId}', this)">שמור</button>
    <button class="edit-price-btn" style="background:#ccc;color:#333;" onclick="cancelEdit('${lotId}')">ביטול</button>
  `;
};

window.savePrices = async function (lotId, buttonElement) {
  const hourInput = document.getElementById(`edit-hour-${lotId}`);
  const quarterInput = document.getElementById(`edit-quarter-${lotId}`);

  const perHour = parseFloat(hourInput.value);
  const perExtra15Min = parseFloat(quarterInput.value);

  if (isNaN(perHour) || isNaN(perExtra15Min)) {
    alert("אנא הזן מחירים חוקיים");
    return;
  }

  const user = auth.currentUser;
  if (!user) return;

  const lotRef = doc(db, "owners", user.uid, "parkingLots", lotId);
  await updateDoc(lotRef, {
    "prices.perHour": perHour,
    "prices.perExtra15Min": perExtra15Min
  });

  // ✅ עדכון parkingSpots בזיכרון
  const updatedSpot = parkingSpots.find(spot => spot.id === lotId);
  if (updatedSpot) {
    updatedSpot.price.firstHour = perHour;
    updatedSpot.price.perQuarter = perExtra15Min;
  }

  // ✅ רענון מרקרים במפה
  await initMapForOwner(user.uid);
  // ✅ עדכון שורה בטבלה
  const row = buttonElement.closest("tr");
  const cells = row.querySelectorAll("td");
  cells[1].innerHTML = `${perHour} ₪`;
  cells[2].innerHTML = `${perExtra15Min} ₪`;
  cells[3].innerHTML = `<button class="edit-price-btn" onclick="enableEditMode('${lotId}', this)">ערוך</button>`;
};


window.cancelEdit = function (lotId) {
  const row = document.querySelector(`#lot-details-${lotId} .lot-info-table tbody tr`);
  const cells = row.querySelectorAll("td");

  const address = cells[0].innerText;
  const hour = document.getElementById(`edit-hour-${lotId}`)?.value || cells[1].innerText;
  const quarter = document.getElementById(`edit-quarter-${lotId}`)?.value || cells[2].innerText;

  row.innerHTML = `
    <td>${address}</td>
    <td>${hour} ₪</td>
    <td>${quarter} ₪</td>
    <td><button class="edit-price-btn" onclick="enableEditMode('${lotId}', this)">ערוך</button></td>
  `;
};

async function loadLotButtons(userId) {
  const lotsSnap = await getDocs(collection(db, "owners", userId, "parkingLots"));
  lotsSnap.forEach((doc) => {
    const lotData = doc.data();
    const lotId = doc.id;

    const button = document.createElement("button");
    button.classList.add("lot-button");
    button.innerHTML = `
      <div class="lot-button-content">
        <span class="lot-name">${lotData.name || "חניון ללא שם"}</span>
        
      </div>
      <span class="expand-icon">+</span>
    `;

    button.addEventListener("click", () => {
      const existingDetails = document.getElementById(`lot-details-${lotId}`);
      const expandIcon = button.querySelector(".expand-icon");

      if (existingDetails) {
        existingDetails.remove();
        expandIcon.textContent = "+";
        return;
      }

      document.querySelectorAll(".lot-details").forEach(el => el.remove());
      document.querySelectorAll(".expand-icon").forEach(el => el.textContent = "+");


      const detailsDiv = document.createElement("div");
      detailsDiv.classList.add("lot-details", "fade-in");
      detailsDiv.id = `lot-details-${lotId}`;

      detailsDiv.innerHTML = `
        <h4 class="table-title">🅿️ פרטי החניון</h4>
        <table class="lot-info-table">
          <thead>
            <tr>
              <th>כתובת</th>
              <th>שעה ראשונה</th>
              <th>לרבע שעה נוספת</th>
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${lotData.address}</td>
              <td>${lotData.prices?.perHour || "-"} ₪</td>
              <td>${lotData.prices?.perExtra15Min || "-"} ₪</td>
              <td><button class="edit-price-btn" onclick="enableEditMode('${lotId}', this)">ערוך</button></td>
            </tr>
          </tbody>
        </table>
        <div id="history-${lotId}" ></div>
        <div id="leads-summary-${lotId}" ></div>
        <div id="earnings-summary-${lotId}"></div>

      `;

      button.after(detailsDiv);
      expandIcon.textContent = "−";

      loadReceiptsForLot(userId, lotId, detailsDiv.querySelector(`#history-${lotId}`));
      loadLeadsForLot(userId, lotId, detailsDiv.querySelector(`#leads-summary-${lotId}`));
      loadEarningsForLot(userId, lotId, detailsDiv.querySelector(`#earnings-summary-${lotId}`));


    });
    
    lotButtonsContainer.appendChild(button);
  });
}

async function loadReceiptsForLot(ownerId, lotId, container) {
  const receiptsRef = collection(db, "owners", ownerId, "parkingLots", lotId, "transactions");

  const snapshot = await getDocs(receiptsRef);
  if (snapshot.empty) {
    container.innerHTML = `
      <h4 class="table-title">🧾 היסטוריית חניות - חודש נוכחי</h4>
      <p style="padding-right: 10px;">לא נמצאו חניות החודש.</p>`;
    return;
  }

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const rows = [];
  let total = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const dateParts = data.date?.split(".");
    if (!dateParts || dateParts.length !== 3) return;

    const [day, month, year] = dateParts.map(Number);
    if (month !== currentMonth || year !== currentYear) return;

    const name = data.customerName || "ללא שם";
    const duration = data.durationMinutes ?? "-";
    const price = parseFloat(data.totalPrice) || 0;

    total += price;

    rows.push(`
      <tr>
        <td>${name}</td>
        <td>${data.date}</td>
        <td>${duration} דק'</td>
        <td>${price.toFixed(2)} ₪</td>
      </tr>
    `);
  });

  if (rows.length === 0) {
    container.innerHTML = `
      <h4 class="table-title">🧾 היסטוריית חניות - חודש נוכחי</h4>
      <p style="padding-right: 10px;">לא נמצאו חניות החודש.</p>`;
    return;
  }

  // ✅ שורת סיכום
  rows.push(`
    <tr class="total-row">
      <td colspan="3" style="text-align:right;"><strong>סה"כ</strong></td>
      <td><strong>${total.toFixed(2)} ₪</strong></td>
    </tr>
  `);

  container.innerHTML = `
    <h4 class="table-title">🧾 היסטוריית חניות - חודש נוכחי</h4>
    <table class="lot-info-table">
      <thead>
        <tr>
          <th>שם נהג</th>
          <th>תאריך</th>
          <th>משך</th>
          <th>מחיר</th>
        </tr>
      </thead>
      <tbody>
        ${rows.join("")}
      </tbody>
    </table>
  `;
}


async function loadLeadsForLot(ownerId, lotId, container) {
  const leadsRef = collection(db, "owners", ownerId, "parkingLots", lotId, "leads");
  const querySnap = await getDocs(leadsRef);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const leads = [];
  querySnap.forEach(doc => {
    const data = doc.data();
    const dateObj = data.timestamp?.toDate?.();
    if (!dateObj) return;

    if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
      leads.push({
        name: data.customerName || "לא ידוע",
        date: dateObj.toLocaleDateString("he-IL"),
        time: dateObj.toLocaleTimeString("he-IL", { hour: '2-digit', minute: '2-digit' }),
        price: 1
      });
    }
  });

  const title = document.createElement("h4");
  title.className = "table-title";
  title.textContent = "📩 היסטוריית לידים מהחודש הנוכחי";
  container.appendChild(title);

  if (leads.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "לא נמצאו לידים החודש.";
    emptyMessage.style.paddingRight = "10px";
    container.appendChild(emptyMessage);
    
    return;
  }

  let total = 0;
  const table = document.createElement("table");
  table.className = "lot-info-table";

  const rowsHtml = leads.map(lead => {
    total += lead.price;
    return `
      <tr>
        <td>${lead.date}</td>
        <td>${lead.time}</td>
        <td>${lead.name}</td>
        <td>${lead.price} ₪</td>
      </tr>
    `;
  }).join("");

  table.innerHTML = `
    <thead>
      <tr>
        <th>תאריך</th>
        <th>שעה</th>
        <th>שם</th>
        <th>מחיר</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
      <tr class="total-row">
        <td colspan="3"><strong>סה"כ</strong></td>
        <td><strong>${total} ₪</strong></td>
      </tr>
    </tbody>
  `;

  container.appendChild(table);
}

async function loadEarningsForLot(ownerId, lotId, container) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // שליפת עסקאות
  const transactionsRef = collection(db, "owners", ownerId, "parkingLots", lotId, "transactions");
  const transactionsSnap = await getDocs(transactionsRef);

  let totalParking = 0;

  transactionsSnap.forEach(doc => {
    const data = doc.data();
    const dateParts = data.date?.split(".");
    if (!dateParts || dateParts.length !== 3) return;

    const [day, month, year] = dateParts.map(Number);
    if (month !== currentMonth || year !== currentYear) return;

    totalParking += parseFloat(data.totalPrice || 0);
  });

  // שליפת לידים
  const leadsRef = collection(db, "owners", ownerId, "parkingLots", lotId, "leads");
  const leadsSnap = await getDocs(leadsRef);

  let totalLeads = 0;

  leadsSnap.forEach(doc => {
    const data = doc.data();
    const timestamp = data.timestamp?.toDate?.();
    if (!(timestamp instanceof Date)) return;

    const month = timestamp.getMonth() + 1;
    const year = timestamp.getFullYear();
    if (month === currentMonth && year === currentYear) {
      totalLeads++;
    }
  });

  const commission = totalParking * 0.05;
  const leadsCost = totalLeads * 1; // 1₪ לליד
  const netProfit = totalParking - commission - leadsCost;
  const netColor = netProfit > 0 ? "green" : "red";

  container.innerHTML = `
    <h4 class="table-title">💰 הכנסות חודש נוכחי</h4>
    <table class="lot-info-table">
      <thead>
        <tr>
          <th>ברוטו</th>
          <th>עמלה (5%)</th>
          <th>מחיר לידים</th>
          <th>רווח נטו</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${totalParking.toFixed(2)} ₪</td>
          <td>${commission.toFixed(2)} ₪</td>
          <td>${leadsCost.toFixed(2)} ₪</td>
          <td style="color:${netColor}; font-weight:bold">${netProfit.toFixed(2)} ₪</td>
        </tr>
      </tbody>
    </table>
  `;

}



// Field validation for lot form
const nameInput = document.getElementById("lot-name");
const priceInput = document.getElementById("lot-price");
const priceInput15 = document.getElementById("lot-price-15");
clearErrorOnInput(nameInput);
clearErrorOnInput(addressInput);
clearErrorOnInput(priceInput);
clearErrorOnInput(priceInput15);

const validateLotInputs = () => {
  let isValid = true;
  isValid = checkPriceField(priceInput);
  isValid = checkPriceField(priceInput15);

  if (nameInput.value.trim() === "") {
    setError(nameInput, "חובה להזין שם חניון");
    isValid = false;
  } else if (!/^[\u0590-\u05FFa-zA-Z0-9\s]+$/.test(nameInput.value.trim())) {
    setError(nameInput, "אסור להשתמש בתווים מיוחדים");
    isValid = false;
  } else if (!/^(?=.*[a-zA-Z\u0590-\u05FF])[\u0590-\u05FFa-zA-Z0-9\s]+$/.test(nameInput.value.trim())) {
    setError(nameInput, "אסור שהשם יכיל מספרים בלבד");
    isValid = false;
  } else if (nameInput.value.trim().length > 30) {
    setError(nameInput, "השם לא יכול להכיל יותר מ-30 תווים");
    isValid = false;
  } else {
    setSuccess(nameInput);
  }

  if (addressInput.value.trim() === "") {
    // Case 1: Input is empty
    setError(addressInput, "חובה להזין כתובת");
    isValid = false;
  }
  else if (placeId && addressInput.value.trim() === address) {
    // Case 2: A valid suggestion was selected from the list
    // and the input value hasn't been manually changed since selection
    setSuccess(addressInput);
  }
  else {
    // Case 3: Input has text, but it's either manually typed or was selected and then modified
    setError(addressInput, "יש לבחור כתובת מרשימת ההצעות");
    isValid = false;   
  }

  if(!validateSelects()) {
    lotStatus.className = "popup-error";
    lotStatus.innerHTML="*חובה לבחור שעות!"
    isValid = false;
  } else {
    lotStatus.className = "";
    lotStatus.innerHTML = "";
  }

  return isValid;
};

function checkPriceField(element) {
    let price = Number(element.value.trim());
    if (element.value.trim() === "") {
    setError(element, "יש להזין מחיר לשעה");
    return false;
  } else if (price <= 0) {
    setError(element, "יש להזין מספר גדול מ-0");
    return false;
  } else if (price > 99) {
    setError(element, "יש להזין מחיר הגיוני");
    return false;
  } else if (!/^\d+(\.\d+)?$/.test(element.value.trim())) {
    setError(element, "יש להזין מספר חוקי (לדוגמה: 12 או 12.5)");
    return false;
  } else {
    setSuccess(element);
    return true;
  }
}
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

const setError = (element, message) => {
  const inputControl = element.parentElement;
  const errorDisplay = inputControl.querySelector('.error');

  errorDisplay.innerText = message;
  inputControl.classList.add('error');
  inputControl.classList.remove('success');
};

const setSuccess = (element) => {
  const inputControl = element.parentElement;
  const errorDisplay = inputControl.querySelector('.error');

  errorDisplay.innerText = '';
  inputControl.classList.add('success');
  inputControl.classList.remove('error');
};

function validateSelects() {
  const allSelects = document.querySelectorAll('select');
  for (let select of allSelects) {
    if (select.disabled) continue;
    if (!select.value) {
      return false;
    }
  }
  return true;
}

// Submit new parking lot form
lotForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const user = auth.currentUser;
  if(!validateLotInputs() || !user) {
    return;
  }

  const name = document.getElementById("lot-name").value.trim();
  const prices = {
    perHour: priceInput.value.trim(),
    perExtra15Min: priceInput15.value.trim()
  };
  const uid = user.uid;
  const lotRef = collection(db, "owners", uid, "parkingLots");
  let openingSchedule = {};

  if (alwaysOpenCheckbox.checked) {
    Object.values(dayMap).forEach((engDay) => {
      openingSchedule[engDay] = {
        open: "00:00",
        close: "23:59",
        closed: false
      };
    });
  } else if (!document.getElementById("full-hours-section").classList.contains("hidden")) {
    Object.entries(dayMap).forEach(([heb, eng]) => {
      const from = document.getElementById(`${eng}-from`).value;
      const to = document.getElementById(`${eng}-to`).value;
      const closed = document.getElementById(`${eng}-closed`).checked;

      openingSchedule[eng] = closed
        ? { closed: true }
        : { open: from, close: to, closed: false };
    });
  } else {
    const weekdayFrom = document.getElementById("weekday-from").value;
    const weekdayTo = document.getElementById("weekday-to").value;
    const hlfdayFrom = document.getElementById("hlfday-from").value;
    const hlfdayTo = document.getElementById("hlfday-to").value;
    const hlfdayClosed = document.getElementById("hlfday-closed").value;
    const offdayFrom = document.getElementById("offday-from").value;
    const offdayTo = document.getElementById("offday-to").value;
    const offdayClosed = document.getElementById("offday-closed").checked;

    ["sunday", "monday", "tuesday", "wednesday", "thursday"].forEach((day) => {
      
      openingSchedule[day] = {
        open: weekdayFrom,
        close: weekdayTo,
        closed: false
      };
      
    });

    openingSchedule["friday"] = hlfdayClosed
    ? { closed: true }
    : { open: hlfdayFrom, close: hlfdayTo, closed: false };

    openingSchedule["saturday"] = offdayClosed
      ? { closed: true }
      : { open: offdayFrom, close: offdayTo, closed: false };

  }

  try {
    await addDoc(lotRef, {
      name,
      placeId,
      address,
      prices,
      lat,
      lng,
      openingHours: openingSchedule,
      createdAt: new Date()
    });

    lotStatus.innerText = "החניון נוסף בהצלחה!";
    lotStatus.className = "popup-success";
    lotForm.reset();

    const newRow = document.createElement("tr");
    newRow.innerHTML = `
      <td>${name}</td>
      <td>${address}</td>
      <td>${prices.perHour || "-"} ₪</td>
      <td>${prices.perExtra15Min || "-"} ₪</td>
    `;
    lotsBody.appendChild(newRow);
  } catch (err) {
    console.error(err.message);
    lotStatus.innerText = "Error: " + err.message;
  }
});

// Sign out current user
signoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
    window.location.href = "index.html";
  } catch (err) {
    console.error("Error signing out:", err.message);
  }
});

