
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getDatabase, ref, set, get, update, onValue, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD_xSIlG_ZXvNC-1UVbDHgGbjDyc-Vzi7k",
  authDomain: "disney-companion-7dd81.firebaseapp.com",
  databaseURL: "https://disney-companion-7dd81-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "disney-companion-7dd81",
  storageBucket: "disney-companion-7dd81.firebasestorage.app",
  messagingSenderId: "538112323238",
  appId: "1:538112323238:web:8ddbf4243bd47006cf4e67"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const $ = (s) => document.querySelector(s);

const categoryInfo = {
  dpa:["DPA","dpa"], pp:["PP","pp"], sp:["SP","sp"], food:["フード","food"],
  show:["ショー・パレード","show"], special:["特別な体験","special"], other:["その他","other"]
};

let currentCode = "";
let currentPlan = null;
let editingId = null;
let unsubscribe = null;
let metaTimer = null;

function cleanCode(value){
  return value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
}
function makeCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}
function esc(v){
  return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function mins(t){
  if(!t) return 9999;
  const [h,m] = t.split(":").map(Number);
  return h*60+m;
}
function showToast(message){
  const toast=$("#toast");
  toast.textContent=message;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),1800);
}
function getName(){
  return ($("#displayNameInput").value.trim() || localStorage.getItem("dcDisplayName") || "ゲスト").slice(0,20);
}
function storeName(){
  const name = getName();
  localStorage.setItem("dcDisplayName", name);
  return name;
}
function showStart(){
  $("#startScreen").classList.remove("hidden");
  $("#planScreen").classList.add("hidden");
  $("#shareButton").classList.add("hidden");
}
function showPlan(){
  $("#startScreen").classList.add("hidden");
  $("#planScreen").classList.remove("hidden");
  $("#shareButton").classList.remove("hidden");
}
function setQueryCode(code){
  const url = new URL(location.href);
  url.searchParams.set("plan", code);
  history.replaceState({}, "", url);
}
function clearQueryCode(){
  const url = new URL(location.href);
  url.searchParams.delete("plan");
  history.replaceState({}, "", url);
}

async function createPlan(){
  const name = storeName();
  $("#createPlanButton").disabled = true;
  try{
    let code;
    for(let i=0;i<8;i++){
      code = makeCode();
      const snap = await get(ref(db, `plans/${code}`));
      if(!snap.exists()) break;
      code = "";
    }
    if(!code) throw new Error("コードを作れませんでした");

    const today = new Date().toISOString().slice(0,10);
    await set(ref(db, `plans/${code}`), {
      meta:{
        name:"みんなのパークプラン",
        date:today,
        park:"東京ディズニーランド",
        createdBy:name,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      },
      items:{}
    });
    joinPlan(code);
  }catch(error){
    alert("プランを作れませんでした。少し待ってもう一度試してね。");
    console.error(error);
  }finally{
    $("#createPlanButton").disabled = false;
  }
}

async function joinPlan(codeValue){
  const code = cleanCode(codeValue);
  if(code.length !== 6){
    alert("6文字の共有コードを入力してね");
    return;
  }
  storeName();
  $("#syncText").textContent = "接続中…";
  try{
    const snap = await get(ref(db, `plans/${code}`));
    if(!snap.exists()){
      alert("そのコードのプランが見つかりません");
      return;
    }
    currentCode = code;
    setQueryCode(code);
    $("#planCodeText").textContent = code;
    showPlan();
    listenToPlan(code);
  }catch(error){
    alert("プランを開けませんでした。通信状況を確認してね。");
    console.error(error);
  }
}

function listenToPlan(code){
  if(unsubscribe) unsubscribe();
  unsubscribe = onValue(ref(db, `plans/${code}`), snapshot => {
    if(!snapshot.exists()){
      alert("このプランは削除されたようです");
      leavePlan();
      return;
    }
    currentPlan = snapshot.val();
    $("#syncText").textContent = "リアルタイム同期中";
    render();
  }, error => {
    $("#syncText").textContent = "同期エラー";
    console.error(error);
  });
}

function render(){
  const meta = currentPlan?.meta || {};
  const itemsObj = currentPlan?.items || {};
  const items = Object.entries(itemsObj).map(([id,value])=>({id,...value}))
    .sort((a,b)=>mins(a.start)-mins(b.start));

  if(document.activeElement !== $("#planNameInput")) $("#planNameInput").value = meta.name || "";
  if(document.activeElement !== $("#planDateInput")) $("#planDateInput").value = meta.date || "";
  if(document.activeElement !== $("#parkInput")) $("#parkInput").value = meta.park || "東京ディズニーランド";

  $("#itemCount").textContent = `${items.length}件`;
  const list = $("#planList");
  list.innerHTML = "";

  if(!items.length){
    list.innerHTML = `<div class="empty">まだ予定がありません。<br>誰かが追加すると、全員の画面に反映されます。</div>`;
  }

  items.forEach(item=>{
    const [label, cls] = categoryInfo[item.category] || categoryInfo.other;
    const el = document.createElement("article");
    el.className = `plan-item${item.done ? " done" : ""}`;
    el.innerHTML = `
      <div class="item-time">${esc(item.start)}${item.end?`<br><small>〜${esc(item.end)}</small>`:""}</div>
      <div>
        <span class="badge ${cls}">${label}</span>
        <div class="item-title">${esc(item.title)}</div>
        ${item.note?`<div class="item-note">${esc(item.note)}</div>`:""}
        <div class="item-author">追加：${esc(item.author || "ゲスト")}</div>
      </div>
      <div class="item-actions">
        <button class="circle-button done-button" type="button">${item.done?"↩":"✓"}</button>
        <button class="circle-button edit-button" type="button">✎</button>
      </div>`;
    el.querySelector(".done-button").onclick = () =>
      update(ref(db, `plans/${currentCode}/items/${item.id}`), {
        done:!item.done, updatedAt:serverTimestamp()
      });
    el.querySelector(".edit-button").onclick = () => openEdit(item);
    list.appendChild(el);
  });

  const next = items.find(item=>!item.done);
  $("#nextTime").textContent = next?.start || "--:--";
  $("#nextTitle").textContent = next?.title || "予定を追加しよう";
  $("#nextNote").textContent = next ? (next.note || `追加：${next.author || "ゲスト"}`) : "みんなの追加・変更がここに反映されます";
}

function queueMetaUpdate(){
  clearTimeout(metaTimer);
  metaTimer = setTimeout(async()=>{
    if(!currentCode) return;
    try{
      await update(ref(db, `plans/${currentCode}/meta`), {
        name:$("#planNameInput").value.trim() || "みんなのパークプラン",
        date:$("#planDateInput").value,
        park:$("#parkInput").value,
        updatedAt:serverTimestamp()
      });
    }catch(error){
      showToast("保存できませんでした");
      console.error(error);
    }
  },350);
}

function openNew(){
  editingId = null;
  $("#dialogTitle").textContent = "予定を追加";
  $("#categoryInput").value = "food";
  $("#itemTitleInput").value = "";
  $("#startTimeInput").value = "";
  $("#endTimeInput").value = "";
  $("#noteInput").value = "";
  $("#deleteItemButton").classList.add("hidden");
  $("#itemDialog").showModal();
}

function openEdit(item){
  editingId = item.id;
  $("#dialogTitle").textContent = "予定を編集";
  $("#categoryInput").value = item.category || "other";
  $("#itemTitleInput").value = item.title || "";
  $("#startTimeInput").value = item.start || "";
  $("#endTimeInput").value = item.end || "";
  $("#noteInput").value = item.note || "";
  $("#deleteItemButton").classList.remove("hidden");
  $("#itemDialog").showModal();
}

async function saveItem(){
  const title = $("#itemTitleInput").value.trim();
  const start = $("#startTimeInput").value;
  if(!title || !start){
    alert("予定名と開始時間を入力してね");
    return;
  }
  const id = editingId || makeId();
  const old = currentPlan?.items?.[id] || {};
  const data = {
    category:$("#categoryInput").value,
    title,
    start,
    end:$("#endTimeInput").value,
    note:$("#noteInput").value.trim(),
    author:editingId ? (old.author || getName()) : getName(),
    done:editingId ? Boolean(old.done) : false,
    updatedBy:getName(),
    updatedAt:serverTimestamp()
  };
  $("#saveItemButton").disabled = true;
  try{
    await set(ref(db, `plans/${currentCode}/items/${id}`), data);
    $("#itemDialog").close();
  }catch(error){
    alert("保存できませんでした");
    console.error(error);
  }finally{
    $("#saveItemButton").disabled = false;
  }
}

async function deleteItem(){
  if(!editingId || !confirm("この予定を削除する？")) return;
  try{
    await remove(ref(db, `plans/${currentCode}/items/${editingId}`));
    $("#itemDialog").close();
  }catch(error){
    alert("削除できませんでした");
    console.error(error);
  }
}

function leavePlan(){
  if(unsubscribe) unsubscribe();
  unsubscribe = null;
  currentCode = "";
  currentPlan = null;
  clearQueryCode();
  showStart();
}

async function sharePlan(){
  const url = new URL(location.href);
  url.searchParams.set("plan", currentCode);
  const data = {
    title:currentPlan?.meta?.name || "Disney Companion",
    text:`共有コード：${currentCode}`,
    url:url.toString()
  };
  try{
    if(navigator.share) await navigator.share(data);
    else{
      await navigator.clipboard.writeText(url.toString());
      showToast("共有URLをコピーしました");
    }
  }catch(error){
    if(error.name !== "AbortError") prompt("このURLをコピーして送ってね",url.toString());
  }
}

$("#displayNameInput").value = localStorage.getItem("dcDisplayName") || "";
$("#displayNameInput").addEventListener("change",storeName);
$("#joinCodeInput").addEventListener("input",e=>e.target.value=cleanCode(e.target.value));
$("#createPlanButton").addEventListener("click",createPlan);
$("#joinPlanButton").addEventListener("click",()=>joinPlan($("#joinCodeInput").value));
$("#addButton").addEventListener("click",openNew);
$("#saveItemButton").addEventListener("click",saveItem);
$("#deleteItemButton").addEventListener("click",deleteItem);
$("#planNameInput").addEventListener("input",queueMetaUpdate);
$("#planDateInput").addEventListener("change",queueMetaUpdate);
$("#parkInput").addEventListener("change",queueMetaUpdate);
$("#shareButton").addEventListener("click",sharePlan);
$("#leaveButton").addEventListener("click",()=>{ if(confirm("このプランから退出する？")) leavePlan(); });
$("#copyCodeButton").addEventListener("click",async()=>{
  await navigator.clipboard.writeText(currentCode);
  showToast("共有コードをコピーしました");
});

const urlCode = cleanCode(new URL(location.href).searchParams.get("plan") || "");
if(urlCode.length === 6){
  $("#joinCodeInput").value = urlCode;
  if($("#displayNameInput").value.trim()){
    joinPlan(urlCode);
  }else{
    showToast("表示名を入れて参加してね");
  }
}
