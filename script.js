let dataList = [];
let currentPhoto = "";

function calc() {
    const fob = parseFloat(document.formulaire.fob.value);
    const pcb = parseFloat(document.formulaire.pcb.value);
    const cbm = parseFloat(document.formulaire.cbm.value);
    const maritime = parseFloat(document.formulaire.maritime.value);
    const tracking = parseFloat(document.formulaire.tracking.value);
    const douane = parseFloat(document.formulaire.douane.value)/100;

    if([fob,pcb,cbm,maritime,tracking,douane].some(isNaN)){
        alert("Remplir tous les champs valides."); return false;
    }

    let pr = ((56/cbm)*pcb*fob)+maritime;
    pr = pr*(1+douane)+tracking;
    pr /= ((56/cbm)*pcb);
    const mcmp = pr/0.88;
    const log = pr*0.15;
    const pv = log + mcmp;
    const rfa = pv*0.06;
    const pvrfa = pv + rfa;
    const pnew = (pvrfa/1).toFixed(2);
    const pvp = Math.ceil((pvrfa*2)*2)/2-0.01;

    document.getElementById("result").innerHTML=`
        <hr/><strong>Prix 2025 : ${pnew} €</strong><br>
        ${pr.toFixed(3)} : P. Brute<br>
        ${mcmp.toFixed(3)} : P. avec marge CMP 12%<br>
        ${log.toFixed(3)} : Coût Logistique<br>
        ${pv.toFixed(3)} : P. sans RFA<br>
        ${rfa.toFixed(3)} : RFA 6%<br>
        <hr/><strong>Prix vente mag coef 2 : ${pvp} €</strong>`;
    return false;
}

function resetForm(){
    document.formulaire.reset();
    document.getElementById("result").innerHTML="";
    currentPhoto="";
}

function handlePhoto(e){
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload = function(ev){currentPhoto=ev.target.result;}
    reader.readAsDataURL(file);
}

function addToTable(){
    const date=new Date().toLocaleString();
    const ref=prompt("Référence (majuscule)").toUpperCase() || "";
    const description=prompt("Description") || "";
    const fob=parseFloat(document.formulaire.fob.value)||0;
    const pcb=parseFloat(document.formulaire.pcb.value)||0;
    const cbm=parseFloat(document.formulaire.cbm.value)||0;
    const maritime=parseFloat(document.formulaire.maritime.value)||0;
    const tracking=parseFloat(document.formulaire.tracking.value)||0;
    const douane=parseFloat(document.formulaire.douane.value)||0;

    let pr=((56/cbm)*pcb*fob)+maritime;
    pr=pr*((1+douane/100))+tracking;
    pr/=((56/cbm)*pcb);
    const mcmp=pr/0.88;
    const log=pr*0.15;
    const pv=log+mcmp;
    const rfa=pv*0.06;
    const pvrfa=pv+rfa;
    const pnew=(pvrfa/1).toFixed(2);
    const pvp=Math.ceil((pvrfa*2)*2)/2-0.01;

    const row={date,ref,description,fob,pcb,cbm,maritime,tracking,douane,pnew,pvp,photo:currentPhoto};
    dataList.push(row);
    renderTable();
    resetForm();
}

function renderTable(){
    const tbody=document.querySelector("#tableData tbody");
    tbody.innerHTML="";
    dataList.forEach(r=>{
        const tr=document.createElement("tr");
        tr.innerHTML=`<td>${r.date}</td><td>${r.ref}</td><td>${r.description}</td><td>${r.fob}</td><td>${r.pcb}</td><td>${r.cbm}</td><td>${r.maritime}</td><td>${r.tracking}</td><td>${r.douane}</td><td>${r.pnew}</td><td>${r.pvp}</td><td>${r.photo?"Oui":""}</td>`;
        tbody.appendChild(tr);
    });
}

function exportXLSXClient(){
    if(dataList.length===0){alert("Aucune donnée à exporter.");return;}
    const wsData=[["Date","Réf","Description","FOB","PCB","CBM","Maritime","Tracking","Douane","Prix 2025","Prix Vente","Photo(Base64)"]];
    dataList.forEach(it=>{
        wsData.push([it.date,it.ref,it.description,it.fob,it.pcb,it.cbm,it.maritime,it.tracking,it.douane,it.pnew,it.pvp,it.photo?it.photo.substring(0,50)+"...":""]);
    });
    const wb=XLSX.utils.book_new();
    const ws=XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb,ws,"Simulations");
    XLSX.writeFile(wb,"Simulations_TradeMaa.xlsx");
}

// PWA service worker
if('serviceWorker' in navigator){
    navigator.serviceWorker.register('service-worker.js').catch(err=>console.warn('SW failed',err));
}
