import { db,auth } from './firebase-config.js';
import { collection, getDocs, doc, addDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

let map;
let userLocation = null;
const telAvivCenter = { lat: 32.0728, lng: 34.7799 };
let currentMarkers = [];
let selectedDestination = null;
let activeParkingSpotName= null;
let activeSession = null;
const parkingBubbles = {}; 
let parkingSpots = {};
const gateConnectRequest = "https://ab0e-62-90-193-247.ngrok-free.app";

function resizeMap() {
  const map = document.getElementById('map');
  if (map) {
    const topOffset = map.getBoundingClientRect().top;
    const viewportHeight = window.innerHeight;
    const availableHeight = viewportHeight - topOffset;
    map.style.height = `${availableHeight}px`;
  }
}

async function getParkingSpotsFromFirestore() {
  const ownersRef = collection(db, 'owners');
  const ownersSnapshot = await getDocs(ownersRef);
  const spots = [];

  for (const ownerDoc of ownersSnapshot.docs) {
    const ownerId = ownerDoc.id;
    const lotsRef = collection(db, `owners/${ownerId}/parkingLots`);
    const lotsSnapshot = await getDocs(lotsRef);

    lotsSnapshot.forEach((lotDoc) => {
      const data = lotDoc.data();
      const lotId = lotDoc.id;
      spots.push({
        name: data.name || '',
        lat: data.lat,
        lng: data.lng,
        address: data.address || '',
        price: {
          firstHour: Number(data.prices?.perHour) || 0,
          perQuarter: Number(data.prices?.perExtra15Min) || 0
        },
        hours: data.openingHours || {},
        ownerId: ownerId,
        lotId: lotId
      });
    });
  }
  return spots;
}

function getTodayHours(hours) {
  const daysMap = [
    'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'
  ];
  const today = new Date().getDay();
  const todayKey = daysMap[today];
  const dayHours = hours[todayKey];
  const open = dayHours.open;
  const close = dayHours.close;


  if (!dayHours || dayHours.closed === "true" || dayHours.closed === true) {
    return "סגור";
  }

  if ((open === "00:00" ) && (close === "23:59" )) {
    return "כל היום";
  }

  return `${open} - ${close}`;
}

const gateAnimation = lottie.loadAnimation({
  container: document.getElementById('gate-animation-container'),
  renderer: 'svg',
  loop: true,
  autoplay: false,
  path: 'media/loading.json'
});

const loginButton = document.getElementById("lot-owner-login");

function calculateTotalPrice(hour,quarter, totalMinutes) {
  if (totalMinutes <= 60) {
    return hour;
  }
  const extraMinutes = totalMinutes - 60;
  const quarters = Math.ceil(extraMinutes / 15);
  return hour + (quarters * quarter);
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(2);
}

const creditCards = [
  { label: "ויזה •••• 1234", value: "visa1234" },
  { label: "מאסטרקארד •••• 5678", value: "master5678" }
];

function renderCreditCardOptions() {
  const container = document.querySelector(".card-options");
  const formContainer = document.querySelector("#new-card-form");
  formContainer.innerHTML = "";

  let isFormVisible = false;

  container.innerHTML = creditCards.map((card, index) => `
    <label class="card-option">
      <input type="radio" name="creditCard" value="${card.value}" ${index === 0 ? "checked" : ""} />
      <div class="card-info">
        <div class="card-icon">💳</div>
        <span>${card.label}</span>
      </div>
    </label>`).join("") + 
    `<button class="add-card-btn">➕ הוסף כרטיס חדש</button>`;

    const addBtn = document.querySelector(".add-card-btn");

    addBtn.onclick = () => {
    isFormVisible = !isFormVisible;

    if (isFormVisible) {
      addBtn.innerHTML = "➖ הסתר טופס";
      formContainer.innerHTML = `
      <input type="text" id="card-number" placeholder="מספר כרטיס" maxlength="19" dir="ltr" />
      <div id="error-card-number" class="error-msg"></div>
    
      <div class="expiry-cvv-row">
        <input type="text" id="expiry" placeholder="MM/YY" maxlength="5" dir="ltr" />
        <input type="text" id="cvv" placeholder="CVV" maxlength="3" dir="ltr" />
      </div>
      <div id="error-expiry" class="error-msg"></div>
      <div id="error-cvv" class="error-msg"></div>
    
      <input type="text" id="cardholder-name" placeholder="שם בעל הכרטיס" />
      <div id="error-name" class="error-msg"></div>
    
      <button id="save-card-btn">שמור כרטיס</button>
    `;
    
  
    formContainer.classList.remove("hidden");

      document.querySelector("#save-card-btn").onclick = () => {
        const number = document.querySelector("#card-number");
        const expiry = document.querySelector("#expiry");
        const cvv = document.querySelector("#cvv");
        const name = document.querySelector("#cardholder-name");

        const errCard = document.getElementById("error-card-number");
        const errExpiry = document.getElementById("error-expiry");
        const errCvv = document.getElementById("error-cvv");
        const errName = document.getElementById("error-name");

        

        let hasError = false;

        [number, expiry, cvv, name].forEach(el => el.classList.remove("input-error"));
        [errCard, errExpiry, errCvv, errName].forEach(e => e.style.display = "none");
        
        if (!/^\d{13,19}$/.test(number.value.trim())) {
          errCard.innerText = "מספר כרטיס לא תקין (13–19 ספרות)";
          errCard.style.display = "block";
          number.classList.add("input-error");
          hasError = true;
        }
        
        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry.value.trim())) {
          errExpiry.innerText = "תוקף לא תקין. השתמש בפורמט MM/YY";
          errExpiry.style.display = "block";
          expiry.classList.add("input-error");
          hasError = true;
        }
        
        if (!/^\d{3}$/.test(cvv.value.trim())) {
          errCvv.innerText = "CVV חייב להיות בן 3 ספרות";
          errCvv.style.display = "block";
          cvv.classList.add("input-error");
          hasError = true;
        }
        
        if (name.value.trim().length < 2) {
          errName.innerText = "שם בעל הכרטיס קצר מדי";
          errName.style.display = "block";
          name.classList.add("input-error");
          hasError = true;
        }
        
        if (hasError) return;

        const last4 = number.value.trim().slice(-4);
        creditCards.push({
          label: `${name.value.trim()} •••• ${last4}`,
          value: `new${Date.now()}`
        });

      };
    } 
    else {
      formContainer.innerHTML = "";
      addBtn.innerHTML = "➕ הוסף כרטיס חדש";
      
      formContainer.classList.add("fade-out");
    }
  };
}

async function initMap() {
    resizeMap();
      parkingSpots = await getParkingSpotsFromFirestore();

  const cleanMapStyle = [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "road", stylers: [{ saturation: -100 }, { lightness: 30 }] },
    { featureType: "administrative", stylers: [{ visibility: "off" }] },
    { featureType: "water", stylers: [{ color: "#d4e4f4" }] },
    { featureType: "landscape", stylers: [{ color: "#f4f4f4" }] }
  ];

  map = new google.maps.Map(document.getElementById("map"), {
    disableDefaultUI: true,
    styles: cleanMapStyle,
    gestureHandling: "greedy"
    });
  let lastAutocompleteText = "";
  
  const destinationInput = document.getElementById("destination-input");
  const searchButton = document.getElementById("destination-btn");
  const autocomplete = new google.maps.places.Autocomplete(destinationInput, {
    componentRestrictions: { country: "il" }
  });
  
  autocomplete.addListener("place_changed", () => {
    const place = autocomplete.getPlace();
    if (place.geometry) {
      selectedDestination = place.geometry.location;
      lastAutocompleteText = destinationInput.value.trim();
      searchButton.disabled = false;
    } else {
      selectedDestination = null;
      lastAutocompleteText = "";
      searchButton.disabled = true;
    }
  });
  
  const filterButton = document.createElement("button");
  filterButton.id = "filter-toggle";
  filterButton.className = "filter-toggle";
  filterButton.innerText = "⚙️ סנן";
  filterButton.onclick = () => {
    const panel = document.getElementById("filter-panel");
    if (panel) {
      panel.classList.toggle("hidden");
    } else {
      console.warn("⚠️ לא נמצא filter-panel ב־DOM.");
    }
  };
  document.querySelector(".map-container").appendChild(filterButton);
  function handleDestinationSearch() {
  const currentText = destinationInput.value.trim();
  const isValid = selectedDestination && currentText === lastAutocompleteText;

  if (isValid) {
    map.panTo(selectedDestination);
    smoothZoom(map, 16);

    if (window.searchMarker) {
      window.searchMarker.setMap(null);
    }

    window.searchMarker = new google.maps.Marker({
      position: selectedDestination,
      map: map,
      title: lastAutocompleteText,
      animation: google.maps.Animation.DROP,
      zIndex: 9999
    });

    setTimeout(() => {
      window.searchMarker.setAnimation(google.maps.Animation.BOUNCE);
      drawClosestLinesToDestination();
    }, 1300);

    setTimeout(() => {
      window.searchMarker.setAnimation(null);
    }, 4000);

    parkingSpots.forEach(spot => {
      spot.calculatedDistance = parseFloat(
        calculateDistance(
          selectedDestination.lat(),
          selectedDestination.lng(),
          spot.lat,
          spot.lng
        )
      );
    });
   
  }
  else {
      alert("⚠️ אנא בחר כתובת מתוך ההצעות של גוגל לפני הלחיצה על חיפוש.");
    }
  }

  searchButton.onclick = handleDestinationSearch;
  
  destinationInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleDestinationSearch();
    }
  });
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        const carElement = document.createElement('div');
        carElement.className = 'falling-car';
        
        carElement.innerHTML = `
        <div class="car-pulse pulse1"></div>
        <div class="car-pulse pulse2"></div>
        <div class="car-pulse pulse3"></div>
        <div class="car-icon" style="background-image: url('media/car.png');"></div>
      `;
    
        class FallingCarOverlay extends google.maps.OverlayView {
          constructor() {
            super();
            this.hasAnimated = false;
          }
        
          onAdd() {
            const panes = this.getPanes();
            panes.overlayMouseTarget.appendChild(carElement);
          }
        
          draw() {
            const projection = this.getProjection();
            const pos = projection.fromLatLngToDivPixel(new google.maps.LatLng(userLocation.lat, userLocation.lng));
            if (pos) {
              carElement.style.left = `${pos.x}px`;
              carElement.style.position = 'absolute';
        
              if (!this.hasAnimated) {
                carElement.style.transition = 'transform 1.5s ease-in-out';
                carElement.style.transform = `translate(-50%, -200%)`;
        
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    carElement.style.transform = `translate(-50%, -50%)`;
                    this.hasAnimated = true;                   
                  });
                });
                setTimeout(() => {

                  new google.maps.Marker({
                    position: userLocation,
                    map: map,
                    icon: {
                      url: 'media/car.png',
                      scaledSize: new google.maps.Size(50, 50),
                      anchor: new google.maps.Point(25, 25)
                    },
                    title: "המיקום שלך"
                  });
                
                  fallingCar.setMap(null);
                }, 2300);
                
              }
            }
          }
        
          onRemove() {
            if (carElement && carElement.parentNode) {
              carElement.parentNode.removeChild(carElement);
            }
          }
          
        }
        
        const fallingCar = new FallingCarOverlay();
        fallingCar.setMap(map);

        let currentZoom = 11;
        const zoomInterval = setInterval(() => {
          if (currentZoom < 16) {
            currentZoom+=0.5;
            map.setZoom(currentZoom);
          } else {
            clearInterval(zoomInterval);
          }
        }, 150);

        setTimeout(() => {
          map.setZoom(12);
          setTimeout(() => {
            map.panTo(telAvivCenter);
            let zoomLevel = map.getZoom();
            const targetZoom = 14;
            const zoomInterval = setInterval(() => {
              if (zoomLevel < targetZoom) {
                zoomLevel += 0.2;
                map.setZoom(zoomLevel);
              } else {
                clearInterval(zoomInterval);
                map.setZoom(targetZoom);
              }
            }, 50);
          }, 620);
        }, 2300);
        map.panTo(userLocation);
      },
      (error) => {
        alert("⚠️ לא ניתן לגשת למיקום. אנא אשר הרשאות.");
      }
    );
  }
  
  class InfoBubbleOverlay extends google.maps.OverlayView {
    constructor(position, data, map) {
      super();
      this.startTime = null;
      this.position = position;
      this.data = data;
      this.map = map;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      if (this.div) {
        if (activeParkingSpotName === this.data.name) {
          const alldiv = this.div.querySelector(".bubble-box");
          alldiv.classList.remove("hidden");
          this.div.style.display = "block";
          return;
        }
      }
      
      this.isActiveSession = false;

      this.div = document.createElement("div");
      this.div.className = "info-bubble";
    
      let distance = "לא זמין";

      if (selectedDestination) {
        const d = calculateDistance(
          selectedDestination.lat(),
          selectedDestination.lng(),
          this.position.lat(),
          this.position.lng()
        );
        this.data.calculatedDistance = d;
        distance = `${d} ק״מ מהיעד`;
      } else if (userLocation) {
        const d = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          this.position.lat(),
          this.position.lng()
        );
        this.data.calculatedDistance = d;
        distance = `${d} ק״מ ממיקומך`;
      }   
      this.div.innerHTML = `
        <div class="bubble-box">
        <button class="close-bubble">✖</button>
        <strong>${this.data.name}</strong>
        <div><span style="font-weight: 600; color: #5271ff;">📍 כתובת:</span> ${this.data.address}</div>
        <div><span style="font-weight: 600; color: #5271ff;">⏰ שעות פעילות להיום:</span> ${getTodayHours(this.data.hours)}</div>
    
        <div><span style="font-weight: 600; color: #5271ff;">💰 מחירון:</span></div>
        <table style="width: 100%; margin-top: 0.5rem; margin-bottom: 0.5rem; border: 1px solid #5271ff; border-collapse: collapse; font-size: 0.95rem; text-align: center;">
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
    
        <div id="location"><span style="font-weight: 600; color: #5271ff;">📏 מרחק:</span> ${distance}</div>
    
        <div class="bubble-buttons">
          <button class="navigate-btn open-map-btn">📍 קח אותי לחניון</button>
          <button class="navigate-btn open-gate-btn">🔓 פתח שער</button>
          <div class="active-session">
            <div class="session-summary">
              <div class="session-time hidden">⏱ זמן שחלף: 00:00:00</div>
              <div class="session-price hidden">💳 לתשלום: 0 ₪</div>
            </div>
            <button class="finish-session-btn hidden">סיימתי, פתח את השער!</button>
          </div>
        </div>
       </div>
      `;

      this.div.querySelector(".close-bubble").addEventListener("click", () => {
        
        this.setMap(null);
        if (map) {
          map.setZoom(15);
        }
      });

      this.div.querySelector(".open-map-btn").addEventListener("click", async () => {
        const lat = this.position.lat();
        const lng = this.position.lng();
        const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        const newTab = window.open('', '_blank');

        if (newTab) {
          newTab.document.write(`
            <html>
              <head><title>מוביל אותך לחניון...</title></head>
              <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
                <h2>🔄 טוען את החניון במפות...</h2>
              </body>
            </html>
          `);
        } else {
          alert("🚫 Safari חסם את פתיחת הלשונית החדשה");
          return;
        }
        const user = auth.currentUser;
        const ownerId = this.data.ownerId;
        const lotId = this.data.lotId;

        if (user && ownerId && lotId) {
          try {
            await addDoc(collection(db, "owners", ownerId, "parkingLots", lotId, "leads"), {
              customerName: user.displayName || "ללא שם",
              timestamp: new Date(),
            });
            console.log("ליד נשמר");
          } catch (error) {
            console.error("שגיאה בשמירת ליד:", error);
          }
        }

        newTab.location.href = mapsUrl;
      });


      this.div.querySelector(".open-gate-btn").addEventListener("click", () => {
        const modal = document.querySelector(".credit-card-modal");
        modal.classList.remove("hidden");
        renderCreditCardOptions();
      
        document.querySelector(".cancel-btn").onclick = () => {
          modal.classList.add("hidden");
        };
      
        document.querySelector(".confirm-payment-btn").onclick = () => {
          const selectedCard = document.querySelector('input[name="creditCard"]:checked');
          if (!selectedCard) {
            alert("בחר כרטיס קודם");
            return;
          }
      
          modal.classList.add("hidden");
      
          const popup = document.getElementById("confirm-popup");
          popup.classList.remove("hidden");
      
          document.getElementById("confirm-yes").onclick = async () => {
            activeParkingSpotName = this.data.name;
            applyFilters();

            popup.classList.add("hidden");
            const gate = document.getElementById("gate-popup-overlay");
            gate.classList.remove("hidden");
            gateAnimation.stop();
            gateAnimation.play();

            setTimeout(() => {
              gate.classList.add("hidden");
              this.proceedToTimer();
            }, 1800);

            try {
              const response = await fetch(gateConnectRequest + "/open-gate",{
                method: "GET",
                      headers: {
                        "ngrok-skip-browser-warning": "true"
                      }
                    });

                    if (!response.ok) {
                      throw new Error("השער לא נפתח. נסה שוב.");
                    }

                    const message = await response.text();
                    console.log(message);
            } catch (error) {
              console.log("לא נמצא שרת זמין לתקשר עמו: " + error.message);
            }            
          };
          
          document.getElementById("confirm-no").onclick = () => {
            popup.classList.add("hidden");
          };
        };
      });
    
      const panes = this.getPanes();
      panes.floatPane.appendChild(this.div);
      
    }  
    proceedToTimer() {
      const buttonsContainer = this.div.querySelector(".bubble-buttons");
      this.isActiveSession = true
      const element = document.getElementById("location");
      if (element) element.remove();
      const openGateButton = this.div.querySelector(".open-gate-btn");
      const navigateButton = this.div.querySelector(".open-map-btn");
      
      openGateButton.classList.add("hidden");
      navigateButton.classList.add("hidden");

      const timeDisplay = this.div.querySelector(".session-time");
      const priceDisplay = this.div.querySelector(".session-price");
      const finishButton = this.div.querySelector(".finish-session-btn");

      timeDisplay.classList.remove("hidden");
      priceDisplay.classList.remove("hidden");
      finishButton.classList.remove("hidden");
    
      const hourPrise = this.data.price.firstHour;
      const QuarterPrise = this.data.price.perQuarter;
      if (!this.startTime) {
        this.startTime = Date.now();
      }
      
      let price = 0;
    
      const updateTimeAndPrice = () => {
        const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
        const hours = Math.floor(elapsed / 3600);
        const minutes = Math.floor((elapsed % 3600) / 60);
        const seconds = elapsed % 60;
    
        const formattedTime =
          String(hours).padStart(2, "0") + ":" +
          String(minutes).padStart(2, "0") + ":" +
          String(seconds).padStart(2, "0");
    
        if (elapsed >= 300) {
          price = calculateTotalPrice(hourPrise, QuarterPrise, elapsed / 60);
        }
    
        timeDisplay.textContent = `⏱ זמן שחלף: ${formattedTime}`;
        priceDisplay.textContent = `💳 לתשלום: ${price} ₪`;
      };
      finishButton.addEventListener("click", async () => {
        activeParkingSpotName=null;
        this.isActiveSession = false;
        try {
              const response = await fetch(gateConnectRequest + "/close-gate",{
                method: "GET",
                      headers: {
                        "ngrok-skip-browser-warning": "true"
                      }
                    });

                    if (!response.ok) {
                      throw new Error("השער לא נפתח. נסה שוב.");
                    }

                    const message = await response.text();
                    console.log(message);
            } catch (error) {
              console.log("לא נמצא שרת זמין לתקשר עמו: " + error.message);
            }

        const user = auth.currentUser;
        const ownerId = this.data.ownerId;
        const lotId = this.data.lotId; 
        console.log("this.data:", this.data);
        if (user && this.startTime) {
          const endTime = new Date();
          const durationMinutes = Math.floor((endTime - this.startTime) / 60000);
          const dateString = endTime.toLocaleDateString('he-IL');
             await addDoc(collection(db, "drivers", user.uid, "parkingHistory"), {
            parkingLotName: this.data.name,
            date: dateString,                    
            durationMinutes,         
            totalPrice: Number(price.toFixed(2))
          });

            try {
              await addDoc(collection(db, "owners", ownerId, "parkingLots", lotId, "transactions"), {
                date: dateString,
                customerName: auth.currentUser.displayName || "ללא שם",
                durationMinutes,
                totalPrice: Number(price.toFixed(2))
              });
              console.log("קבלה נשמרה אצל בעל החניון");
            } catch (error) {
              console.error("שגיאה בשמירת הקבלה אצל בעל החניון:", error);
            }
        }

        const popup = document.createElement("div");
        popup.className = "payment-popup fade-in";
        popup.innerHTML = `
          <div class="popup-box fade-in">
            <p>💸 הסכום שחויב: <strong>${price} ₪</strong></p>
            <p>🚗 השער נפתח. צאתך לשלום!</p>
            <button class="close-popup-btn">חזור למפה</button>
          </div>
        `;
        document.body.appendChild(popup);
    
        document.querySelector(".close-popup-btn").onclick = () => {
          popup.remove();
          this.setMap(null);
          delete parkingBubbles[this.data.name];
          map.panTo(telAvivCenter);
          map.setZoom(14);
        };
        applyFilters();

      });
    
      updateTimeAndPrice();
      setInterval(updateTimeAndPrice, 1000);
    }
  
    draw() {
      if (!this.div || this.div.classList.contains("hidden")) return;

      const projection = this.getProjection();
      const pos = projection.fromLatLngToDivPixel(this.position);
      if (this.div && pos) {
        this.div.style.position = "absolute";
        this.div.style.left = `${pos.x}px`;
        this.div.style.top = `${pos.y - 200}px`;
        this.div.style.transform = "translate(-50%)";
      }
    }

    onRemove() {
      if (this.div) {
        if (this.isActiveSession) {
          this.div.classList.add('hidden');
        } else {
          delete parkingBubbles[this.data.name];
          this.div.remove();
          this.div = null;
        }
      }
    }
  }

  class ParkingMarker extends google.maps.OverlayView {
    constructor(position, spotData, map) {
      super();
      this.position = position;
      this.spotData = spotData;
      this.map = map;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      this.div = document.createElement("div");
      const panes = this.getPanes();
      if (panes?.overlayMouseTarget) {
        panes.overlayMouseTarget.appendChild(this.div);
      }

      this.div.className = "price-marker";
     

      if (activeParkingSpotName === this.spotData.name) {
          this.div.classList.add("active");
      }

      this.div.innerHTML = `
        <div class="marker-content">
          <div class="marker-icon">🅿️</div>
          <div class="marker-text">
            <div class="price"> ${this.spotData.price.firstHour}₪</div>
            <div class="per-hour">לשעה</div>
          </div>
        </div>
      `;

      this.div.addEventListener("click", () => {
      if (window.activeBubble) window.activeBubble.setMap(null);
      map.panTo(this.position);
      map.setZoom(16);

      if (parkingBubbles[this.spotData.name]) {
        const existingBubble = parkingBubbles[this.spotData.name];
        existingBubble.div.classList.remove("hidden");
        existingBubble.setMap(map);
        window.activeBubble = existingBubble;
      } 
      else
      {
        const bubble = new InfoBubbleOverlay(this.position, this.spotData, this.map);
        parkingBubbles[this.spotData.name] = bubble;
        window.activeBubble = bubble;
      }
      });
   }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      const pos = projection.fromLatLngToDivPixel(this.position);
      if (pos) {
        this.div.style.left = pos.x + "px";
        this.div.style.top = pos.y + "px";
        this.div.style.position = "absolute";
        this.div.style.transform = "translate(-50%, -50%)";
      }
    }

    onRemove() {
      this.div?.parentNode?.removeChild(this.div);
      this.div = null;
    }
  }

  applyFilters();
  document.getElementById("filter-toggle").onclick = () => {
  document.getElementById("filter-panel").classList.toggle("hidden");
  };

  document.getElementById("clear-filters").onclick = () => {
  document.getElementById("price-filter").value = "";
  document.getElementById("distance-filter").value = "";
  document.getElementById("open-now").checked = false;
  document.getElementById("open-saturday").checked = false;
  applyFilters();
  };

  const applyBtn = document.getElementById("apply-filters");

if (applyBtn) {
  applyBtn.onclick = () => {
    applyFilters();
    document.getElementById("filter-panel").classList.add("hidden");
  };
}

  function applyFilters() {
    const priceVal = document.getElementById("price-filter").value;
    const distVal = document.getElementById("distance-filter").value;
    const openNow = document.getElementById("open-now").checked;
    const openSaturday = document.getElementById("open-saturday").checked;
  
    currentMarkers.forEach(marker => marker.setMap(null));
    currentMarkers = [];
    let distance;
    
    const referenceLocation = selectedDestination || userLocation;
    
    const filtered = parkingSpots.filter(spot => {
      const numericPrice = spot.price.firstHour; 
      if (priceVal === "low" && numericPrice > 10) return false;
      if (priceVal === "medium" && (numericPrice < 11 || numericPrice > 20)) return false;
      if (priceVal === "high" && numericPrice < 21) return false;

      if (distVal && referenceLocation) {
        if(selectedDestination ){
         distance = parseFloat(
          calculateDistance(referenceLocation.lat(), referenceLocation.lng(), spot.lat, spot.lng)
        );}
        else{
         distance = parseFloat(
            calculateDistance(referenceLocation.lat, referenceLocation.lng, spot.lat, spot.lng)
          );

        }
  
  
        if (distVal === "near" && distance > 1) return false;
        if (distVal === "medium" && (distance <= 1 || distance > 3)) return false;
        if (distVal === "far" && distance <= 3) return false;
      }
  
      if (openNow) {
      const now = new Date();
      const currentDay = now.toLocaleDateString("en-US", { weekday: 'long' }).toLowerCase();
      const currentTime = now.toTimeString().slice(0, 5);

      const hours = spot.hours[currentDay];
      if (!hours || hours.closed) return false;

      if (hours.open === "00:00" && hours.close === "23:59") 
      {
      } 
      else {
        if (currentTime < hours.open || currentTime > hours.close) return false;
      }
    }
  
      if (openSaturday && !spot.hours.saturday) return false;
      if (openSaturday && spot.hours.saturday.closed) return false;  
      return true;
    });
  
    filtered.forEach(spot => {
      const pos = new google.maps.LatLng(spot.lat, spot.lng);
      const marker = new ParkingMarker(pos, spot, map);
      currentMarkers.push(marker);
    });
  }

  function drawClosestLinesToDestination() {
  if (!selectedDestination) return;

  window.closestLines = window.closestLines || [];
  window.closestLines.forEach(line => line.setMap(null));
  window.closestLines = [];

  const closestSpots = parkingSpots
    .filter(spot => spot.calculatedDistance !== undefined && spot.calculatedDistance !== null)
    .sort((a, b) => a.calculatedDistance - b.calculatedDistance)
    .slice(0, 3);

  const directionsService = new google.maps.DirectionsService();

  closestSpots.forEach((spot) => {
    const request = {
      origin: { lat: spot.lat, lng: spot.lng },
      destination: selectedDestination,
      travelMode: google.maps.TravelMode.WALKING
    };

    directionsService.route(request, function (result, status) {
      if (status === "OK") {
        const fullPath = result.routes[0].overview_path;
        const totalPoints = fullPath.length;
        const animatedLine = new google.maps.Polyline({
          path: [],
          strokeColor: "#5271ff",
          strokeOpacity: 1,
          strokeWeight: 4,
          geodesic: true,
          map: map
        });

        window.closestLines.push(animatedLine);

        let progress = 0;
        const steps = 100;
        const interval = setInterval(() => {
          progress++;
          const endIndex = Math.floor((progress / steps) * totalPoints);
          const partialPath = fullPath.slice(0, endIndex + 1);

          animatedLine.setPath(partialPath);

          if (progress >= steps) {
            clearInterval(interval);
          }
        }, 7.5);
        setTimeout(() => {
          animatedLine.setMap(null);
        }, 3000);
      } 
      else {
        console.warn(`⛔ Directions failed for "${spot.name}" →`, status);
      }
    });
  });
}

}

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

waitForGoogleMaps().then(() => {
  initMap();
});

window.initMap = initMap;

function smoothZoom(map, targetZoom) {
  map.setZoom(11);
  let currentZoom = map.getZoom();
  const zoomInterval = setInterval(() => {
    if (currentZoom < targetZoom) {
      currentZoom += 0.5;
      map.setZoom(currentZoom);
    } else {
      clearInterval(zoomInterval);
      map.setZoom(targetZoom);
    }
  }, 100);
}
