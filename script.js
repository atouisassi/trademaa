let dataList = [], selectedIndex = null;

// Configuration d'optimisation des images
const IMAGE_OPTIONS = {
    preview: { maxWidth: 400, maxHeight: 400, quality: 0.8 },
    thumbnail: { maxWidth: 60, maxHeight: 60, quality: 0.7 },
    export: { maxWidth: 300, maxHeight: 300, targetSizeKB: 30, minQuality: 0.4 },
    csv: { maxWidth: 150, maxHeight: 150, quality: 0.3 }
};

// --- Gestion IndexedDB ---
const DB_NAME = "TradeMaaDB";
const DB_VERSION = 1;
const STORE_NAME = "simulations";

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
            }
        };
        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
    });
}

async function saveAllToDB(dataArray) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        dataArray.forEach(item => store.add(item));
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

async function loadAllFromDB() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- Initialisation ---
window.onload = async function() {
    try {
        dataList = await loadAllFromDB();
        console.log("📂 Données chargées depuis IndexedDB :", dataList.length);
    } catch (err) {
        console.warn("⚠️ Échec IndexedDB, fallback localStorage :", err);
        const saved = localStorage.getItem("tradeMaaData");
        if (saved) dataList = JSON.parse(saved);
    }
    renderTable();
};

async function saveData() {
    try {
        await saveAllToDB(dataList);
        console.log("✅ Données sauvegardées dans IndexedDB");
    } catch (err) {
        console.error("Erreur de sauvegarde IndexedDB :", err);
        // Fallback vers localStorage
        localStorage.setItem("tradeMaaData", JSON.stringify(dataList));
    }
}

// --- Calcul des prix ---
function calc(show = false) {
    const f = document.formulaire;
    const pcb = parseFloat(f.pcb.value);
    const cbm = parseFloat(f.cbm.value);
    const fob = parseFloat(f.fob.value);
    const maritime = parseFloat(f.maritime.value);
    const douane = parseFloat(f.douane.value) / 100;
    const tracking = parseFloat(f.tracking.value);
    
    if ([pcb, cbm, fob, maritime, douane, tracking].some(isNaN)) {
        alert("❌ Veuillez remplir tous les champs correctement");
        return false;
    }

    let pr = ((56 / cbm) * pcb * fob) + maritime;
    pr = pr * (1 + douane) + tracking;
    pr /= ((56 / cbm) * pcb);
    
    const mcmp = pr / 0.88;
    const log = pr * 0.15;
    const pv = log + mcmp;
    const rfa = pv * 0.06;
    const pvrfa = pv + rfa;
    const pnew = (pvrfa / 1).toFixed(2);
    const pvp = Math.ceil((pvrfa * 2) * 2) / 2 - 0.01;

    const result = {
        pr: +pr.toFixed(2),
        mcmp: +mcmp.toFixed(2),
        log: +log.toFixed(2),
        pv: +pv.toFixed(2),
        rfa: +rfa.toFixed(2),
        pvrfa: +pvrfa.toFixed(2),
        pnew: +parseFloat(pnew),
        pvp: +pvp.toFixed(2)
    };

    if (show) {
        document.getElementById("result").innerHTML = `
            <div style="text-align: center;">
                <strong style="color: #28a745; font-size: 1.2em;">💶 Prix 2025 : ${pnew} €</strong><br>
                <small style="color: #666;">
                    ${pr.toFixed(3)} : P.Brute | ${mcmp.toFixed(3)} : CMP | ${log.toFixed(3)} : Log +15%<br>
                    ${rfa.toFixed(3)} : RFA | ${pv.toFixed(3)} : P.sans RFA
                </small><br>
                <strong style="color: #dc3545; font-size: 1.1em;">🏷️ Prix vente (x2) : ${pvp.toFixed(2)} €</strong>
            </div>`;
    }
    return result;
}

function toggleInfoBox(show = true) {
    const box = document.getElementById("infoBox");
    box.style.display = show ? "block" : "none";
}

// --- Gestion des images ---
function updatePhotoThumbnail(base64) {
    let thumb = document.getElementById("photoThumbnail");
    const photoInput = document.getElementById("photoInput");

    if (!base64) {
        if (thumb) thumb.remove();
        return;
    }

    if (!thumb) {
        thumb = document.createElement('img');
        thumb.id = "photoThumbnail";
        thumb.style.width = "60px";
        thumb.style.height = "60px";
        thumb.style.objectFit = "cover";
        thumb.style.border = "2px solid #ddd";
        thumb.style.borderRadius = "8px";
        thumb.style.marginTop = "10px";
        thumb.style.boxShadow = "0 2px 5px rgba(0,0,0,0.1)";
        photoInput.parentNode.appendChild(thumb);
    }

    thumb.src = base64;
}

function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        updatePhotoThumbnail(null);
        delete event.target.dataset.base64;
        delete event.target.dataset.url;
        return;
    }

    // Vérifier la taille originale
    const originalSizeKB = file.size / 1024;
    console.log(`📷 Image originale: ${originalSizeKB.toFixed(2)} KB`);

    // Compression adaptative
    let targetSizeKB = 30;
    if (originalSizeKB > 500) targetSizeKB = 50;
    if (originalSizeKB > 1000) targetSizeKB = 70;

    optimizeImage(file, targetSizeKB, IMAGE_OPTIONS.preview.maxWidth, IMAGE_OPTIONS.preview.maxHeight)
        .then(optimizedDataUrl => {
            event.target.dataset.base64 = optimizedDataUrl;
            const blob = dataURItoBlob(optimizedDataUrl);
            const url = URL.createObjectURL(blob);
            event.target.dataset.url = url;

            const optimizedSizeKB = (optimizedDataUrl.length * 0.75) / 1024;
            const compressionRatio = ((1 - optimizedSizeKB / originalSizeKB) * 100).toFixed(1);
            console.log(`✅ Image optimisée: ${optimizedSizeKB.toFixed(2)} KB (${compressionRatio}% réduit)`);

            updatePhotoThumbnail(optimizedDataUrl);
        })
        .catch(error => {
            console.error("Erreur d'optimisation:", error);
            // Fallback
            resizeImage(file, 300, 300, function(resizedDataUrl) {
                event.target.dataset.base64 = resizedDataUrl;
                const blob = dataURItoBlob(resizedDataUrl);
                const url = URL.createObjectURL(blob);
                event.target.dataset.url = url;
                updatePhotoThumbnail(resizedDataUrl);
            });
        });
}

function optimizeImage(file, targetSizeKB = 30, maxWidth = 400, maxHeight = 400) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                let width = img.width;
                let height = img.height;

                const scale = Math.min(maxWidth / width, maxHeight / height, 1);
                width = Math.floor(width * scale);
                height = Math.floor(height * scale);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'medium';
                ctx.drawImage(img, 0, 0, width, height);

                compressToTargetSize(canvas, targetSizeKB, resolve);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function compressToTargetSize(canvas, targetSizeKB, callback, quality = 0.7) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const sizeKB = (dataUrl.length * 0.75) / 1024;

    if (sizeKB <= targetSizeKB || quality <= 0.3) {
        callback(dataUrl);
    } else {
        const newQuality = Math.max(0.3, quality - 0.1);
        setTimeout(() => compressToTargetSize(canvas, targetSizeKB, callback, newQuality), 0);
    }
}

function resizeImage(file, maxWidth, maxHeight, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;

            const scale = Math.min(maxWidth / width, maxHeight / height, 1);
            width = width * scale;
            height = height * scale;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            callback(resizedDataUrl);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
}

// --- Gestion des données ---
function ajouter() {
    const result = calc();
    if (!result) return;
    
    const ref = (document.getElementById("refInput").value || "SANS REFERENCE").toUpperCase();
    const desc = document.getElementById("descInput").value || "Sans description";
    let photo = document.getElementById("photoInput").dataset.base64;

    // Garder l'ancienne photo si modification sans nouvelle photo
    if (!photo && selectedIndex !== null && dataList[selectedIndex].photo) {
        photo = dataList[selectedIndex].photo;
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString() + " " + now.toLocaleTimeString();
    const f = document.formulaire;
    
    const entry = {
        ref,
        description: desc,
        date: dateStr,
        photo,
        fob: f.fob.value,
        pcb: f.pcb.value,
        cbm: f.cbm.value,
        maritime: f.maritime.value,
        tracking: f.tracking.value,
        douane: f.douane.value,
        ...result
    };

    if (selectedIndex !== null) {
        dataList[selectedIndex] = entry;
        selectedIndex = null;
        document.getElementById("addBtn").value = "➕ Ajouter";
    } else {
        dataList.push(entry);
    }
    
    saveData();
    renderTable();
    resetForm();
}

// --- Affichage du tableau ---
function renderTable() {
    const tbody = document.getElementById("table-body");
    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 20px; color: #666;">Aucune simulation sauvegardée</td></tr>';
        return;
    }
    
    tbody.innerHTML = dataList.map((it, i) => {
        const photoSrc = it.photo || '';
        return `
            <tr class="${selectedIndex === i ? 'selected' : ''}">
                <td>${i + 1}</td>
                <td class="editable" contenteditable onblur="updateRef(${i}, this.innerText)">${it.ref}</td>
                <td class="editable" contenteditable onblur="updateDescription(${i}, this.innerText)">${it.description}</td>
                <td>${it.fob}</td>
                <td>${it.pcb}</td>
                <td>${it.cbm}</td>
                <td><strong>${it.pnew} €</strong></td>
                <td><strong style="color: #dc3545;">${it.pvp.toFixed(2)} €</strong></td>
                <td>${photoSrc ? `<img src="${it.photo}" alt="Photo" style="cursor: zoom-in;" onclick="openPhoto('${it.photo}')">` : '—'}</td>
                <td>
                    <button class="action-btn" onclick="editRow(event, ${i})" title="Modifier">✏️</button>
                    <button class="action-btn" onclick="deleteRow(event, ${i})" title="Supprimer">🗑️</button>
                </td>
            </tr>`;
    }).join("");
}

function updateDescription(i, text) {
    dataList[i].description = text.trim() || "Sans description";
    saveData();
}

function updateRef(i, text) {
    dataList[i].ref = text.trim().toUpperCase() || "SANS REFERENCE";
    saveData();
}

function editRow(e, i) {
    e.stopPropagation();
    const it = dataList[i];
    const f = document.formulaire;
    
    f.fob.value = it.fob;
    f.pcb.value = it.pcb;
    f.cbm.value = it.cbm;
    f.maritime.value = it.maritime;
    f.tracking.value = it.tracking;
    f.douane.value = it.douane;
    
    document.getElementById("refInput").value = it.ref;
    document.getElementById("descInput").value = it.description;
    selectedIndex = i;
    document.getElementById("addBtn").value = "💾 Mettre à jour";
    
    if (it.photo) {
        document.getElementById("photoInput").dataset.base64 = it.photo;
        updatePhotoThumbnail(it.photo);
    } else {
        updatePhotoThumbnail(null);
    }
    
    renderTable();
    document.getElementById("infoBox").style.display = "block";
}

function deleteRow(e, i) {
    e.stopPropagation();
    if (confirm("Êtes-vous sûr de vouloir supprimer cette simulation ?")) {
        dataList.splice(i, 1);
        selectedIndex = null;
        document.getElementById("addBtn").value = "➕ Ajouter";
        saveData();
        renderTable();
    }
}

function resetForm() {
    document.formulaire.reset();
    document.getElementById("result").innerHTML = "";
    document.getElementById("refInput").value = "";
    document.getElementById("descInput").value = "";
    document.getElementById("photoInput").value = "";
    delete document.getElementById("photoInput").dataset.base64;
    delete document.getElementById("photoInput").dataset.url;
    updatePhotoThumbnail(null);
    selectedIndex = null;
    document.getElementById("addBtn").value = "➕ Ajouter";
    document.getElementById("infoBox").style.display = "none";
}

// --- Export des données ---
async function exportXLSXOrCSV() {
    if (dataList.length === 0) {
        alert("❌ Aucune donnée à exporter.");
        return;
    }

    const roundedData = dataList.map(it => ({
        ...it,
        fob: parseFloat(it.fob).toFixed(3),
        pcb: parseFloat(it.pcb).toFixed(0),
        cbm: parseFloat(it.cbm).toFixed(5),
        pr: parseFloat(it.pr).toFixed(3),
        mcmp: parseFloat(it.mcmp).toFixed(3),
        log: parseFloat(it.log).toFixed(3),
        pv: parseFloat(it.pv).toFixed(3),
        rfa: parseFloat(it.rfa).toFixed(3),
        pvrfa: parseFloat(it.pvrfa).toFixed(3),
        pnew: parseFloat(it.pnew).toFixed(2),
        pvp: parseFloat(it.pvp).toFixed(2),
        maritime: parseFloat(it.maritime).toFixed(2),
        tracking: parseFloat(it.tracking).toFixed(2),
        douane: parseFloat(it.douane).toFixed(2),
        date: it.date || ""
    }));

    try {
        // Tentative d'export XLSX
        const resp = await fetch("https://backend-k01c.onrender.com/export", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: roundedData })
        });

        if (!resp.ok) throw new Error(await resp.text());
        
        const blob = await resp.blob();
        downloadBlob(blob, "Simulations_TradeMaa.xlsx");
        
    } catch (err) {
        console.warn("⚠️ Export XLSX échoué :", err.message);
        
        // Fallback CSV
        const includeImages = confirm("Voulez-vous inclure les images dans le CSV ?\n\n" +
            "✅ Sans images: Fichier plus petit et plus rapide\n" +
            "⚠️ Avec images: Fichier volumineux mais complet");
        
        if (includeImages) {
            await generateCSVWithImages(roundedData);
        } else {
            generateCSVWithoutImages(roundedData);
        }
    }
}

function generateCSVWithoutImages(data) {
    const csvHeader = [
        "Référence", "Description", "FOB", "PCB", "CBM",
        "Prix_brute", "Marge_CMP", "Logistique_15", "Prix_sans_RFA",
        "RFA", "Prix_2025", "Prix_vente_Public",
        "Maritime", "Tracking", "Douane_%", "Date"
    ];

    const csvRows = data.map(it => [
        `"${it.ref}"`,
        `"${it.description.replace(/"/g, '""')}"`,
        Number(it.fob).toFixed(3),
        Number(it.pcb),
        Number(it.cbm).toFixed(5),
        Number(it.pr).toFixed(3),
        Number(it.mcmp).toFixed(3),
        Number(it.log).toFixed(3),
        Number(it.pv).toFixed(3),
        Number(it.rfa).toFixed(3),
        Number(it.pnew).toFixed(2),
        Number(it.pvp).toFixed(2),
        Number(it.maritime).toFixed(2),
        Number(it.tracking).toFixed(2),
        Number(it.douane).toFixed(2),
        `"${it.date || ''}"`
    ].join(","));

    const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    downloadBlob(blob, "Simulations_TradeMaa_sans_images.csv");
    
    alert("✅ CSV généré sans images");
}

async function generateCSVWithImages(data) {
    // Optimiser les images pour l'export
    const optimizedData = await Promise.all(
        data.map(async (
