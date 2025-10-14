
let dataList=[], selectedIndex=null;
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

window.onload = async function(){
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
    alert("❌ Impossible de sauvegarder les données !");
  }
}

// --- Calcul ---
function calc(show=false){
    const f = document.formulaire;
    const pcb = parseFloat(f.pcb.value);
    const cbm = parseFloat(f.cbm.value);
    const fob = parseFloat(f.fob.value);
    const maritime = parseFloat(f.maritime.value);
    const douane = parseFloat(f.douane.value)/100;
    const tracking = parseFloat(f.tracking.value);
    if([pcb,cbm,fob,maritime,douane,tracking].some(isNaN)){alert("Champs invalides");return false;}
    let pr=((56/cbm)*pcb*fob)+maritime;
    pr=pr*(1+douane)+tracking;
    pr/=((56/cbm)*pcb);
    const mcmp=pr/0.88, log=pr*0.15, pv=log+mcmp, rfa=pv*0.06, pvrfa=pv+rfa;
    const pnew = (pvrfa/1).toFixed(2);
    const pvp = Math.ceil((pvrfa*2)*2)/2-0.01;
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
    if(show){}
        document.getElementById("result").innerHTML = `
            <hr><strong>💶 Prix 2025 : ${pnew} €</strong><br>
            ${pr.toFixed(3)} : P.Brute | ${mcmp.toFixed(3)} : CMP | ${log.toFixed(3)} : Log +15%<br>
            ${rfa.toFixed(3)} : RFA | ${pv.toFixed(3)} : P.sans RFA<br>
            <strong>🏷️ Prix vente (x2) : ${pvp.toFixed(2)} €</strong><hr>`;
    return {pr,mcmp,log,pv,rfa,pvrfa,pnew,pvp};
}

function toggleInfoBox(show = true){ 
    const box=document.getElementById("infoBox");
    box.style.display=(show)?"block":"none";
}
////////
    // --- Met à jour la miniature ---
function updatePhotoThumbnail(base64) {
    let thumb = document.getElementById("photoThumbnail");
    const photoInput = document.getElementById("photoInput");

    if (!base64) {
        // Supprime la miniature si pas de photo
        if (thumb) thumb.remove();
        return;
    }

    if (!thumb) {
        // Crée la miniature si elle n'existe pas
        thumb = document.createElement('img');
        thumb.id = "photoThumbnail";
        thumb.style.width = "60px";
        thumb.style.height = "60px";
        thumb.style.objectFit = "cover";
        thumb.style.border = "1px solid #ccc";
        thumb.style.borderRadius = "4px";
        thumb.style.marginLeft = "10px";
        thumb.style.verticalAlign = "middle";
        photoInput.parentNode.appendChild(thumb);
    }

    thumb.src = base64;
}

// --- Photo upload ---
function handlePhotoUpload(event){
   const file = event.target.files[0];
    if (!file) {
        updatePhotoThumbnail(null); // supprime miniature si input vidé
        delete event.target.dataset.base64;
        delete event.target.dataset.url;
        return;
    }

    resizeImage(file, 700, 700, function(resizedDataUrl) {
        // Stocke la version redimensionnée
        event.target.dataset.base64 = resizedDataUrl;

        // Crée un URL temporaire pour l'affichage dans le tableau (Safari friendly)
        const blob = dataURItoBlob(resizedDataUrl);
        const url = URL.createObjectURL(blob);
        event.target.dataset.url = url;

        // Met à jour la miniature
        updatePhotoThumbnail(resizedDataUrl);

        // Rafraîchir le tableau si tu veux afficher l'image immédiatement
        renderTable();
    });
}

    /////
// --- Ajouter / éditer ligne ---
function ajouter(){
    const result = calc();
    if(!result) return;
    const ref = (document.getElementById("refInput").value || "SANS REFERENCE").toUpperCase();
    const desc = document.getElementById("descInput").value || "Sans description";
    let photo = document.getElementById("photoInput").dataset.base64;

    // Si aucune nouvelle photo n'est sélectionnée et qu'on modifie une ligne existante,
    // on garde l'ancienne photo
    if (!photo && selectedIndex !== null && dataList[selectedIndex].photo) {
      photo = dataList[selectedIndex].photo;
    }
    const now = new Date();
    const dateStr = now.toLocaleDateString()+" "+now.toLocaleTimeString();
    const f = document.formulaire;
    const entry = {ref, description:desc, date:dateStr, photo,
        fob:f.fob.value, pcb:f.pcb.value, cbm:f.cbm.value,
        maritime:f.maritime.value, tracking:f.tracking.value, douane:f.douane.value,
        ...result};
    if(selectedIndex !== null){
        dataList[selectedIndex] = entry;
        selectedIndex = null;
        document.getElementById("addBtn").value="➕ Ajouter";
    } else { dataList.push(entry); }
    saveData();
    renderTable();
    resetForm();
}
// resize 
    function resizeImage(file, maxWidth = 800, maxHeight = 800, callback) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            let width = img.width;
            let height = img.height;

            // Calcul du ratio pour respecter maxWidth et maxHeight
            const scale = Math.min(maxWidth / width, maxHeight / height, 1);
            width = width * scale;
            height = height * scale;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Convertit en base64 JPEG (qualité 0.8 pour réduire la taille)
            const resizedDataUrl = canvas.toDataURL('image/jpeg', 0.8);

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

// --- Tableau ---
function renderTable(){
    const tbody = document.getElementById("table-body");
    if(dataList.length===0){tbody.innerHTML='<tr><td colspan="11">Aucune simulation.</td></tr>'; return;}
    tbody.innerHTML = dataList.map((it, i) => {
    const photoSrc = it.url || it.photo || '';
    return `
            <tr class="${selectedIndex===i?'selected':''}">
                <td>${i+1}</td>
                <td class="editable" contenteditable onblur="updateRef(${i},this.innerText)">${it.ref}</td>
                <td class="editable" contenteditable onblur="updateDescription(${i},this.innerText)">${it.description}</td>
                <td>${it.fob}</td><td>${it.pcb}</td><td>${it.cbm}</td>
                <td>${it.pnew} €</td><td>${it.pvp.toFixed(2)} €</td>
                <td>${photoSrc ? `<img src="${it.photo}" style="cursor:zoom-in;" onclick="openPhoto('${it.photo}')">` : '—'}</td>
                <td>
                    <button class="action-btn" onclick="editRow(event,${i})">✏️</button>
                    <button class="action-btn" onclick="deleteRow(event,${i})">🗑️</button>
                </td>
            </tr>`;
    }).join("");
}
function updateDescription(i,text){dataList[i].description=text.trim()||"Sans description"; saveData();}
function updateRef(i,text){dataList[i].ref=text.trim().toUpperCase()||"SANS REFERENCE"; saveData();}
function editRow(e,i){
    e.stopPropagation();
    const it=dataList[i];
    const f=document.formulaire;
    f.fob.value=it.fob; f.pcb.value=it.pcb; f.cbm.value=it.cbm;
    f.maritime.value=it.maritime; f.tracking.value=it.tracking; f.douane.value=it.douane;
    document.getElementById("refInput").value=it.ref;
    document.getElementById("descInput").value=it.description;
    selectedIndex=i;
    document.getElementById("addBtn").value="💾 Mettre à jour";
    document.getElementById("infoBox").style.display="block";
    if (it.photo) {
    document.getElementById("photoInput").dataset.base64 = it.photo;
    updatePhotoThumbnail(it.photo); // affiche la miniature
    } else {
        updatePhotoThumbnail(null); // supprime miniature si pas de photo
    }
    renderTable();
}
function deleteRow(e,i){ e.stopPropagation(); if(confirm("Supprimer cette ligne ?")){ dataList.splice(i,1); selectedIndex=null; document.getElementById("addBtn").value="➕ Ajouter"; saveData(); renderTable(); } }
function resetForm(){
    const f=document.formulaire;
    f.reset();
    document.getElementById("result").innerHTML="";
    document.getElementById("refInput").value="";
    document.getElementById("descInput").value="";
    document.getElementById("photoInput").value="";
    delete document.getElementById("photoInput").dataset.base64;
    delete document.getElementById("photoInput").dataset.url;
    updatePhotoThumbnail(null); // supprime la miniature
    selectedIndex=null;
    document.getElementById("addBtn").value="➕ Ajouter";
}

// --- Export XLSX + fallback CSV ---
async function exportXLSXOrCSV() {
    if (dataList.length === 0) { 
        alert("Aucune donnée à exporter."); 
        return; 
    } 
    const roundedData = dataList.map(it => ({
        ...it,
        fob: parseFloat(it.fob).toFixed(3),
        pcb: parseFloat(it.pcb).toFixed(0),
        cbm: parseFloat(it.cbm).toFixed(5), // CBM avec 5 décimales pour précision
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
        // Tentative d'export XLSX via le backend
        const resp = await fetch("https://backend-k01c.onrender.com/export", {
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ data: roundedData }) 
        }); 
        if (!resp.ok) throw new Error(await resp.text());
        const blob = await resp.blob(); 
        const url = URL.createObjectURL(blob); 
        const a = document.createElement("a"); 
        a.href = url; 
        a.download = "Simulations_TradeMaa.xlsx"; 
        a.click(); 
        URL.revokeObjectURL(url); 
    } 
    catch (err) { 
        console.warn("⚠️ Export XLSX échoué :", err.message); 
        alert("Le serveur d’export Excel est indisponible. Génération d’un CSV local..."); 

        try { 
            // --- CSV local complet ---
            const csvHeader = [
                "Référence", "Description", "FOB", "PCB", "CBM",
                "Prix_brute", "Marger CMP", "Logistique +15%", "P.sans RFA",
                "RFA", "Prix 2025", "P.vente Public",
                "Maritime", "Tracking", "Douane", "Date", "Photo"
            ];

            const csvRows = dataList.map(it => [
                `"${it.ref}"`,
                `"${it.description.replace(/"/g, '""')}"`,
                Number(it.fob).toFixed(3),
                Number(it.pcb),                    // PCB laissé tel quel
                Number(it.cbm).toFixed(5),                    // CBM laissé tel quel
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
                `"${it.date || ''}"`,
                it.photo ? `"${it.photo}"` : ""
            ].join(","));

            const csvContent = [csvHeader.join(","), ...csvRows].join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" }); 
            const url = URL.createObjectURL(blob); 
            const a = document.createElement("a"); 
            a.href = url; 
            a.download = "Simulations_TradeMaa.csv"; 
            a.click(); 
            URL.revokeObjectURL(url); 
            //alert("✅ Fichier CSV complet généré avec succès !"); 
        } 
        catch (csvErr) { 
            console.error("Erreur lors de la génération du CSV :", csvErr); 
            alert("Erreur lors de la génération du CSV local : " + csvErr.message); 
        }
    }
}



if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("Service Worker enregistré ✅"))
    .catch(err => console.log("SW erreur :", err));
}
// --- Photo preview ---
function openPhoto(src) {
  const overlay = document.getElementById("photoPreview");
  const img = document.getElementById("previewImg");
  const closeBtn = document.getElementById("closePreview");
  const zoomHint = document.getElementById("zoomHint");

  img.src = src;
  overlay.style.display = "flex";
  let zoomed = false;

  // Fermer la fenêtre
  closeBtn.onclick = () => overlay.style.display = "none";

  // Zoom / dézoom au toucher
  img.onclick = () => {
    zoomed = !zoomed;
    img.style.transform = zoomed ? "scale(1.8)" : "scale(1)";
  };

  // Fermer si on clique à l’extérieur de l’image
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  };
}

async function clearStorage() {
  if (confirm("Effacer toutes les données sauvegardées ?")) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    dataList = [];
    renderTable();
    console.log("🧹 IndexedDB vidé !");
  }
}
