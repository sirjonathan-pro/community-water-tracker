
// COMMUNITY WATER TRACKER

// 1. FIREBASE CONFIGURATION
// Replace these placeholders with your Firebase
// web app configuration from Firebase Console.

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBrPUOeQFz1BjjDg6fBvPzV2bUFr1gUsDY",
  authDomain: "community-water-tracker-cc046.firebaseapp.com",
  projectId: "community-water-tracker-cc046",
  storageBucket: "community-water-tracker-cc046.firebasestorage.app",
  messagingSenderId: "316278163883",
  appId: "1:316278163883:web:4b575fe0eb1ce417a22aee",
  measurementId: "G-NHB9LKDV4Z"
};

// 2. INITIALISE FIREBASE
let db = null;
let auth = null;

try {
    firebase.initializeApp(firebaseConfig);

    db = firebase.firestore();
    auth = firebase.auth();

} catch (error) {
    console.error("Firebase error:", error);
}

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
    }
} catch (error) {
    console.error("Firebase error:", error);
}

// 3. ANONYMOUS RESIDENT SIGN-IN

async function ensureResidentSession() {
    try {
        if (!auth.currentUser) {
            await auth.signInAnonymously();
        }

        return auth.currentUser;

    } catch (error) {
        console.error("Authentication error:", error);
        throw error;
    }
}

// 3. REPORT SUB
const reportForm = document.getElementById("reportForm");

reportForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const button = document.getElementById("submitBtn");
    const message = document.getElementById("formMessage");

    if (!db) {
        message.textContent =
            "Firebase is not connected yet. Add your configuration first.";
        return;
    }

    const report = {
        reporterName: document.getElementById("reporterName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        faultType: document.getElementById("faultType").value,
        location: document.getElementById("location").value.trim(),
        description: document.getElementById("description").value.trim(),
        status: "Pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (!report.reporterName || !report.phone ||
        !report.faultType || !report.location ||
        !report.description) {
        message.textContent = "Please complete all fields.";
        return;
    }

    button.disabled = true;
    button.textContent = "Submitting...";

    try {
    const user = await ensureResidentSession();

    report.reporterUid = user.uid;

    const result = await db
        .collection("water_fault_reports")
        .add(report);

        
message.innerHTML = `
    <div class="success-message">
        <h3>✓ Report Submitted Successfully!</h3>
        <p>Your water fault report has been received.</p>
        <p><strong>Your Report ID:</strong></p>
        <h2>${escapeHTML(result.id)}</h2>
        <p>Please keep this ID safe to track your report.</p>
    </div>
`;


        reportForm.reset();
        loadStatistics();

    } catch (error) {
        console.error(error);
        message.textContent =
            "Report could not be submitted. Check your connection and database rules.";
    }

    button.disabled = false;
    button.textContent = "Submit Report";
});

// 4. TRACK REPORT
document.getElementById("trackingForm")
.addEventListener("submit", async function(event) {

    event.preventDefault();

    const id = document.getElementById("trackingId")
        .value.trim();

    const resultBox = document.getElementById("trackingResult");

    if (!db) {
        resultBox.textContent = "Firebase is not connected yet.";
        return;
    }

    resultBox.textContent = "Searching for your report...";

    try {
        const doc = await db
            .collection("water_fault_reports")
            .doc(id)
            .get();

        if (!doc.exists) {
            resultBox.textContent =
                "Report not found. Please check your Report ID.";
            return;
        }

        const data = doc.data();

        resultBox.innerHTML = `
            <h3>Report Found</h3>
            <p><strong>Fault:</strong> ${escapeHTML(data.faultType)}</p>
            <p><strong>Location:</strong> ${escapeHTML(data.location)}</p>
            <p><strong>Status:</strong> ${escapeHTML(data.status)}</p>
        `;

    } catch (error) {
        console.error(error);
        resultBox.textContent =
            "Unable to retrieve report. Please try again.";
    }
});

// 5. SAFELY DISPLAY DATABASE TEXT
function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        }[char];
    });
}

// 6. LOAD REPORT STATISTICS
async function loadStatistics() {

    if (!db) return;

    try {
        const snapshot = await db
            .collection("water_fault_reports")
            .get();

        let total = 0;
        let pending = 0;
        let resolved = 0;

        snapshot.forEach(doc => {
            total++;

            const status = doc.data().status;

            if (status === "Pending") pending++;
            if (status === "Resolved") resolved++;
        });

        document.getElementById("totalReports")
            .textContent = total;

        document.getElementById("pendingReports")
            .textContent = pending;

        document.getElementById("resolvedReports")
            .textContent = resolved;

    } catch (error) {
        console.error("Statistics error:", error);
    }
}

// 7. START THE SYSTEM
loadStatistics();

// 8. ADMINISTRATOR LOGIN AND DASHBOARD

const adminLoginForm = document.getElementById("adminLoginForm");
const adminMessage = document.getElementById("adminMessage");
const adminDashboard = document.getElementById("adminDashboard");
const adminReports = document.getElementById("adminReports");

adminLoginForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const email = document.getElementById("adminEmail").value.trim();
    const password = document.getElementById("adminPassword").value;

    adminMessage.textContent = "Signing in...";

    try {
        const result = await auth.signInWithEmailAndPassword(email, password);

        const adminDoc = await db
            .collection("admins")
            .doc(result.user.uid)
            .get();

        if (!adminDoc.exists || adminDoc.data().role !== "admin") {
            await auth.signOut();
            adminMessage.textContent = "Access denied. Administrator account not authorised.";
            return;
        }

        adminMessage.textContent = "Administrator login successful!";
        adminDashboard.hidden = false;
        adminLoginForm.hidden = true;

        await loadAdminReports();

    } catch (error) {
        console.error("Admin login error:", error);
        adminMessage.textContent = "Login failed. Check your email and password.";
    }
});

// LOAD ALL REPORTS FOR THE ADMINISTRATOR


// STORE ALL ADMIN REPORTS
let allAdminReports = [];

// LOAD REPORTS AND STATISTICS
async function loadAdminReports() {
    adminReports.textContent = "Loading reports...";

    try {
        const snapshot = await db
            .collection("water_fault_reports")
            .get();

        allAdminReports = [];

        let total = 0;
        let pending = 0;
        let inProgress = 0;
        let resolved = 0;

        snapshot.forEach(function(doc) {
            const data = doc.data();

            allAdminReports.push({
                id: doc.id,
                ...data
            });

            total++;

            if (data.status === "Pending") pending++;
            if (data.status === "In Progress") inProgress++;
            if (data.status === "Resolved") resolved++;
        });

        document.getElementById("adminTotalReports").textContent = total;
        document.getElementById("adminPendingReports").textContent = pending;
        document.getElementById("adminProgressReports").textContent = inProgress;
        document.getElementById("adminResolvedReports").textContent = resolved;

        displayFilteredReports();

    } catch (error) {
        console.error(error);
        adminReports.textContent = "Could not load reports.";
    }
}

// SEARCH AND FILTER REPORTS
function displayFilteredReports() {
    const search = document.getElementById("reportSearch")
        .value.toLowerCase().trim();

    const filter = document.getElementById("statusFilter").value;

    const filtered = allAdminReports.filter(function(report) {
        const matchesSearch =
            String(report.location || "").toLowerCase().includes(search) ||
            String(report.faultType || "").toLowerCase().includes(search) ||
            String(report.id || "").toLowerCase().includes(search);

        const matchesStatus =
            filter === "All" || report.status === filter;

        return matchesSearch && matchesStatus;
    });

    adminReports.innerHTML = "";

    if (filtered.length === 0) {
        adminReports.textContent = "No matching reports found.";
        return;
    }

    filtered.forEach(function(report) {
        const card = document.createElement("div");
        card.style.border = "1px solid #ccc";
        card.style.padding = "15px";
        card.style.margin = "12px 0";
        card.style.borderRadius = "10px";

        const details = document.createElement("p");
      const reportedAt =
  report.createdAt && typeof report.createdAt.toDate === "function"
    ? report.createdAt.toDate().toLocaleString()
    : "Date unavailable";

        details.textContent =
  "Report ID: " + report.id +
  "\nReporter: " + (report.reporterName || "Not provided") +
  "\nPhone: " + (report.phone || "Not provided") +
  "\nFault: " + (report.faultType || "Unknown fault") +
  "\nLocation: " + (report.location || "Not provided") +
  "\nDescription: " + (report.description || "No description") +
          "\nReported on: " + reportedAt +
  "\nStatus: " + (report.status || "Unknown");

        const statusSelect = document.createElement("select");

        ["Pending", "In Progress", "Resolved"].forEach(function(status) {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            statusSelect.appendChild(option);
        });

        statusSelect.value = report.status || "Pending";

        const updateButton = document.createElement("button");
        updateButton.textContent = "Update Status";

        updateButton.addEventListener("click", async function() {
            try {
                await db.collection("water_fault_reports")
                    .doc(report.id)
                  
.update({
    status: statusSelect.value,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    statusHistory: firebase.firestore.FieldValue.arrayUnion({
        status: statusSelect.value,
        changedAt: new Date().toISOString()
    })
});
 

                alert("Report status updated successfully!");
                await loadAdminReports();

            } catch (error) {
                console.error(error);
                alert("Could not update report status.");
            }
        });

        card.appendChild(details);
        card.appendChild(statusSelect);
        card.appendChild(updateButton);

        adminReports.appendChild(card);
    });
}

// ACTIVATE SEARCH AND FILTER CONTROLS
document.getElementById("reportSearch")
    .addEventListener("input", displayFilteredReports);

document.getElementById("statusFilter")
    .addEventListener("change", displayFilteredReports);

// REGISTER SERVICE WORKER
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function() {
    navigator.serviceWorker.register("./service-worker.js")
      .then(function() {
        console.log("Application service worker registered!");
      })
      .catch(function(error) {
        console.error("Service worker registration failed:", error);
      });
  });
}

