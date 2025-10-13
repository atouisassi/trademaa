let editIndex = -1;
let tableData = [];

document.getElementById("form-calc").addEventListener("submit", e => {
  e.preventDefault();
  calc();
});

document.getElementById("btn-reset").onclick = () => {
  document.getElementById("form-calc").reset();
  document.getElementById("result").innerHTML = "";
};

document.getElementById("btn-add").onclick = addToTable;
document.getElementById("btn-export").onclick = exportToXlsx;

function calc() {
  const pcb = parseFloat(p("pcb"));
  const cbm = parseFloat(p("cbm"));
  const fob = parseFloat(p("fob"));
  const maritime = parseFloat(p("maritime"));
  const douane = parseFloat(p("douane")) / 100;
  const tracking = parseFloat(p("tracking"));
  if ([pcb, cbm, fob, maritime, douane, tracking].some(isNaN)) {
    alert("Veuillez remplir tous les champs !");
    return;
  }
  let pr = ((56 / cbm) * pcb * fob) + maritime;
  pr = pr * (1 + douane) + tracking;
  pr /= ((56 / cbm) * pcb);
  const mcmp = pr / 0.88;
  const log = pr * 0.15;
  const pv = log + mcmp;
  const rfa = pv * 0.06;
  const pvrfa = pv + rfa;
  const pvp = Math.ceil((pvrfa * 2) * 2) / 2 - 0.01;
  document.getElementById("result").innerHTML =
    `<hr><b>Prix 2025 : ${pvrfa.toFixed(2)} €</b><br>${pr.toFixed(3)} : P. Brute<br>${mcmp.toFixed(3)} : Marge CMP<br>${pv.toFixed(3)} : P. sans RFA<br>${pvp.toFixed(2)} € : Prix Mag Coef 2<hr>`;
  return pvrfa.toFixed(2);
}

function p(id) { return document.getElementById(id).value; }

async function addToTable() {
  const ref = document.getElementById("ref").value.trim().toUpperCase();
  const description = document.getElementById("description").value.trim();
  const photoFile = document.getElementById("photo").files[0];
  const prix = calc();
  if (!prix) return;

  let imgData = "";
  if (photoFile) {
    imgData = await toBase64(photoFile);
  }
  const date = new Date().toLocaleString();

  const row = { ref, description, date, prix, photo: imgData };
  if (editIndex >= 0) { tableData[editIndex] = row; editIndex = -1; document.getElementById("btn-add").value = "Ajouter au tableau"; }
  else { tableData.push(row); }
  renderTable();
}

function renderTable() {
  const tbody = document.querySelector("#data-table tbody");
  tbody.innerHTML = "";
  tableData.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td contenteditable onblur="updateRef(${i}, this.innerText)">${r.ref}</td>
      <td contenteditable onblur="updateDesc(${i}, this.innerText)">${r.description}</td>
      <td>${r.date}</td>
      <td>${r.prix}</td>
      <td>${r.photo ? `<img src="${r.photo}">` : ""}</td>
      <td>
        <button onclick="editRow(${i})">✏️</button>
        <button onclick="delRow(${i})">🗑️</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function updateRef(i, val){ tableData[i].ref = val.toUpperCase(); }
function updateDesc(i, val){ tableData[i].description = val; }

function editRow(i){
  const r = tableData[i];
  document.getElementById("ref").value = r.ref;
  document.getElementById("description").value = r.description;
  document.getElementById("btn-add").value = "Modifier";
  editIndex = i;
}

function delRow(i){ if(confirm("Supprimer ?")){ tableData.splice(i,1); renderTable(); } }

function toBase64(file){
  return new Promise((res, rej)=>{
    const reader = new FileReader();
    reader.onload = ()=>res(reader.result);
    reader.onerror = err=>rej(err);
    reader.readAsDataURL(file);
  });
}

async function exportToXlsx(){
  const res = await fetch("https://ton-backend-url.onrender.com/export-xlsx", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ data: tableData })
  });
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "TradeMaa.xlsx"; a.click();
}
