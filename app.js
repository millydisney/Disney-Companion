
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

const DEVICE_KEY = "dcDeviceId";
const NAME_KEY = "dcDisplayName";
const GROUP_KEY = "dcGroups";

let currentCode = "";
let currentPlan = null;
let editingId = null;
let unsubscribe = null;
let metaTimer = null;
let pendingJoinCode = "";

function deviceId(){
  let id = localStorage.getItem(DEVICE_KEY);
  if(!id){
    id = crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY,id);
  }
  return id;
}
function cleanCode(value){ return String(value||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6); }
function makeCode(){
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
function makeId(){ return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function esc(v){ return String(v ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function mins(t){ if(!t)return 9999; const [h,m]=t.split(":").map(Number); return h*60+m; }
function formatDate(value){
  if(!value) return "日付未設定";
  const d = new Date(`${value}T00:00:00`);
  return `${d.getMonth()+1}/${d.getDate()}`;
}
function parkIcon(park){ return park === "東京ディズニーシー" ? "🌋" : park === "その他" ? "✨" : "🏰"; }
function showToast(message){
  const toast=$("#toast"); toast.textContent=message; toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"),1800);
}
function getName(){ return (localStorage.getItem(NAME_KEY) || "ゲスト").slice(0,20); }
function requireName(){
  if(localStorage.getItem(NAME_KEY)) return true;
  openProfile();
  showToast("最初に名前を登録してね");
  return false;
}
function getGroups(){
  try{return JSON.parse(localStorage.getItem(GROUP_KEY)||"{}");}catch{return {};}
}
function saveGroups(groups){ localStorage.setItem(GROUP_KEY,JSON.stringify(groups)); }
function rememberGroup(code,plan,role){
  const groups=getGroups(), meta=plan?.meta||{};
  groups[code]={code,name:meta.name||"みんなのパークプラン",date:meta.date||"",park:meta.park||"",role:role||"member",lastOpened:Date.now()};
  saveGroups(groups); renderGroupList();
}
function forgetGroup(code){ const groups=getGroups(); delete groups[code]; saveGroups(groups); renderGroupList(); }

function refreshNameUI(){
  const name=getName();
  $("#homeNameText").textContent=name;
  $("#profileNameInput").value=name==="ゲスト"?"":name;
  $("#currentNameText").textContent=name;
}
function openProfile(){ refreshNameUI(); $("#profileDialog").showModal(); }
function saveProfile(){
  const value=$("#profileNameInput").value.trim().slice(0,20);
  if(!value){ alert("表示名を入力してね"); return; }
  localStorage.setItem(NAME_KEY,value);
  refreshNameUI();
  $("#profileDialog").close();
  if(currentCode) updateMyMemberName(value);
  showToast("名前を保存しました");
}
async function updateMyMemberName(name){
  try{ await update(ref(db,`plans/${currentCode}/members/${deviceId()}`),{name,updatedAt:serverTimestamp()}); }catch(e){console.error(e);}
}

function showStart(){
  $("#startScreen").classList.remove("hidden"); $("#planScreen").classList.add("hidden");
  $("#shareButton").classList.add("hidden"); renderGroupList(); refreshNameUI();
}
function showPlan(){
  $("#startScreen").classList.add("hidden"); $("#planScreen").classList.remove("hidden");
  $("#shareButton").classList.remove("hidden");
}
function setQueryCode(code){ const url=new URL(location.href); url.searchParams.set("plan",code); history.replaceState({},"",url); }
function clearQueryCode(){ const url=new URL(location.href); url.searchParams.delete("plan"); history.replaceState({},"",url); }

async function renderGroupList(){
  const groups=getGroups();
  const entries=Object.values(groups).sort((a,b)=>(b.lastOpened||0)-(a.lastOpened||0));
  $("#groupCount").textContent=`${entries.length}件`;
  const list=$("#groupList"); list.innerHTML="";
  if(!entries.length){
    list.innerHTML='<div class="empty-groups">まだ参加中のプランはありません。<br>新しいプランを作るか、届いた共有リンクから参加してね。</div>';
    return;
  }
  entries.forEach(group=>{
    const card=document.createElement("article"); card.className="group-card";
    card.innerHTML=`
      <button class="group-main" type="button">
        <span class="group-icon">${parkIcon(group.park)}</span>
        <span>
          <div class="group-title">${esc(group.name)}</div>
          <div class="group-meta">${esc(formatDate(group.date))}・${esc(group.park||"パーク未設定")}<br>CODE ${esc(group.code)}</div>
        </span>
        <span class="group-arrow">›</span>
      </button>
      <div class="group-footer">
        <span class="group-role">${group.role==="owner"?"👑 オーナー":"👥 参加メンバー"}</span>
        <div class="group-buttons">
          <button class="group-share" type="button">共有</button>
          <button class="group-hide" type="button">一覧から削除</button>
        </div>
      </div>`;
    card.querySelector(".group-main").onclick=()=>joinPlan(group.code,{skipConfirm:true});
    card.querySelector(".group-share").onclick=()=>shareCode(group.code,group.name);
    card.querySelector(".group-hide").onclick=()=>{
      if(confirm("このiPhoneの一覧から削除する？\\n共有コードがあれば、あとで再参加できます。")) forgetGroup(group.code);
    };
    list.appendChild(card);
  });
}

async function createPlan(){
  if(!requireName()) return;
  $("#createPlanButton").disabled=true;
  try{
    let code="";
    for(let i=0;i<8;i++){
      const candidate=makeCode(), snap=await get(ref(db,`plans/${candidate}`));
      if(!snap.exists()){ code=candidate; break; }
    }
    if(!code) throw new Error("code");
    const today=new Date().toISOString().slice(0,10);
    const id=deviceId(), name=getName();
    const data={
      meta:{name:"みんなのパークプラン",date:today,park:"東京ディズニーランド",createdBy:name,ownerId:id,createdAt:serverTimestamp(),updatedAt:serverTimestamp()},
      members:{[id]:{name,role:"owner",joinedAt:serverTimestamp(),updatedAt:serverTimestamp()}},
      items:{}
    };
    await set(ref(db,`plans/${code}`),data);
    await joinPlan(code,{skipConfirm:true});
  }catch(error){ alert("プランを作れませんでした。少し待ってもう一度試してね。"); console.error(error); }
  finally{$("#createPlanButton").disabled=false;}
}

async function findPlanForJoin(codeValue){
  if(!requireName()) return;
  const code=cleanCode(codeValue);
  if(code.length!==6){alert("6文字の共有コードを入力してね");return;}
  try{
    const snap=await get(ref(db,`plans/${code}`));
    if(!snap.exists()){alert("そのコードのプランが見つかりません");return;}
    pendingJoinCode=code;
    const plan=snap.val(), meta=plan.meta||{};
    $("#invitePlanName").textContent=meta.name||"みんなのパークプラン";
    $("#invitePlanMeta").textContent=`${formatDate(meta.date)}・${meta.park||"パーク未設定"}`;
    $("#inviteParkIcon").textContent=parkIcon(meta.park);
    const owner=Object.values(plan.members||{}).find(m=>m.role==="owner");
    $("#inviteOwnerName").textContent=owner?.name||meta.createdBy||"オーナー";
    $("#joinDialog").close();
    $("#inviteDialog").showModal();
  }catch(error){alert("プランを探せませんでした");console.error(error);}
}

async function joinPlan(codeValue,{skipConfirm=false}={}){
  const code=cleanCode(codeValue);
  if(code.length!==6){alert("6文字の共有コードを入力してね");return;}
  if(!requireName()) return;
  if(!skipConfirm){ await findPlanForJoin(code); return; }
  $("#syncText").textContent="接続中…";
  try{
    const planRef=ref(db,`plans/${code}`), snap=await get(planRef);
    if(!snap.exists()){forgetGroup(code);alert("そのプランは見つかりません");return;}
    const plan=snap.val(), id=deviceId();
    let ownerId=plan.meta?.ownerId;
    if(!ownerId){
      ownerId=id;
      await update(ref(db,`plans/${code}/meta`),{ownerId,updatedAt:serverTimestamp()});
      plan.meta={...(plan.meta||{}),ownerId};
    }
    const isOwner=ownerId===id;
    await update(ref(db,`plans/${code}/members/${id}`),{
      name:getName(),role:isOwner?"owner":"member",joinedAt:plan.members?.[id]?.joinedAt||serverTimestamp(),updatedAt:serverTimestamp()
    });
    currentCode=code; currentPlan=plan; setQueryCode(code); $("#planCodeText").textContent=code;
    rememberGroup(code,plan,isOwner?"owner":"member");
    showPlan(); listenToPlan(code);
  }catch(error){alert("プランを開けませんでした。通信状況を確認してね。");console.error(error);}
}

function listenToPlan(code){
  if(unsubscribe)unsubscribe();
  unsubscribe=onValue(ref(db,`plans/${code}`),snapshot=>{
    if(!snapshot.exists()){alert("このプランは削除されたようです");forgetGroup(code);leavePlan({removeMember:false});return;}
    currentPlan=snapshot.val(); $("#syncText").textContent="リアルタイム同期中";
    const role=currentPlan.meta?.ownerId===deviceId()?"owner":"member";
    rememberGroup(code,currentPlan,role); render();
  },error=>{$("#syncText").textContent="同期エラー";console.error(error);});
}

function render(){
  const meta=currentPlan?.meta||{}, itemsObj=currentPlan?.items||{};
  const items=Object.entries(itemsObj).map(([id,value])=>({id,...value})).sort((a,b)=>mins(a.start)-mins(b.start));
  if(document.activeElement!==$("#planNameInput"))$("#planNameInput").value=meta.name||"";
  if(document.activeElement!==$("#planDateInput"))$("#planDateInput").value=meta.date||"";
  if(document.activeElement!==$("#parkInput"))$("#parkInput").value=meta.park||"東京ディズニーランド";
  $("#itemCount").textContent=`${items.length}件`;
  const list=$("#planList");list.innerHTML="";
  if(!items.length)list.innerHTML='<div class="empty">まだ予定がありません。<br>誰かが追加すると、全員の画面に反映されます。</div>';
  items.forEach(item=>{
    const [label,cls]=categoryInfo[item.category]||categoryInfo.other;
    const el=document.createElement("article");el.className=`plan-item${item.done?" done":""}`;
    el.innerHTML=`<div class="item-time">${esc(item.start)}${item.end?`<br><small>〜${esc(item.end)}</small>`:""}</div>
      <div><span class="badge ${cls}">${label}</span><div class="item-title">${esc(item.title)}</div>
      ${item.note?`<div class="item-note">${esc(item.note)}</div>`:""}<div class="item-author">追加：${esc(item.author||"ゲスト")}</div></div>
      <div class="item-actions"><button class="circle-button done-button" type="button">${item.done?"↩":"✓"}</button><button class="circle-button edit-button" type="button">✎</button></div>`;
    el.querySelector(".done-button").onclick=()=>update(ref(db,`plans/${currentCode}/items/${item.id}`),{done:!item.done,updatedAt:serverTimestamp()});
    el.querySelector(".edit-button").onclick=()=>openEdit(item);list.appendChild(el);
  });
  const next=items.find(item=>!item.done);
  $("#nextTime").textContent=next?.start||"--:--";$("#nextTitle").textContent=next?.title||"予定を追加しよう";
  $("#nextNote").textContent=next?(next.note||`追加：${next.author||"ゲスト"}`):"みんなの追加・変更がここに反映されます";
}

function queueMetaUpdate(){
  clearTimeout(metaTimer);
  metaTimer=setTimeout(async()=>{
    if(!currentCode)return;
    try{await update(ref(db,`plans/${currentCode}/meta`),{
      name:$("#planNameInput").value.trim()||"みんなのパークプラン",date:$("#planDateInput").value,
      park:$("#parkInput").value,updatedAt:serverTimestamp()
    });}catch(error){showToast("保存できませんでした");console.error(error);}
  },350);
}

function openNew(){
  editingId=null;$("#dialogTitle").textContent="予定を追加";$("#categoryInput").value="food";
  $("#itemTitleInput").value="";$("#startTimeInput").value="";$("#endTimeInput").value="";$("#noteInput").value="";
  $("#deleteItemButton").classList.add("hidden");$("#itemDialog").showModal();
}
function openEdit(item){
  editingId=item.id;$("#dialogTitle").textContent="予定を編集";$("#categoryInput").value=item.category||"other";
  $("#itemTitleInput").value=item.title||"";$("#startTimeInput").value=item.start||"";$("#endTimeInput").value=item.end||"";
  $("#noteInput").value=item.note||"";$("#deleteItemButton").classList.remove("hidden");$("#itemDialog").showModal();
}
async function saveItem(){
  const title=$("#itemTitleInput").value.trim(),start=$("#startTimeInput").value;
  if(!title||!start){alert("予定名と開始時間を入力してね");return;}
  const id=editingId||makeId(),old=currentPlan?.items?.[id]||{};
  const data={category:$("#categoryInput").value,title,start,end:$("#endTimeInput").value,note:$("#noteInput").value.trim(),
    author:editingId?(old.author||getName()):getName(),done:editingId?Boolean(old.done):false,updatedBy:getName(),updatedAt:serverTimestamp()};
  $("#saveItemButton").disabled=true;
  try{await set(ref(db,`plans/${currentCode}/items/${id}`),data);$("#itemDialog").close();}
  catch(error){alert("保存できませんでした");console.error(error);}
  finally{$("#saveItemButton").disabled=false;}
}
async function deleteItem(){
  if(!editingId||!confirm("この予定を削除する？"))return;
  try{await remove(ref(db,`plans/${currentCode}/items/${editingId}`));$("#itemDialog").close();}
  catch(error){alert("削除できませんでした");console.error(error);}
}

async function openMembers(){
  if(!currentPlan)return;
  const members=currentPlan.members||{}, ownerId=currentPlan.meta?.ownerId, me=deviceId();
  const isOwner=ownerId===me, list=$("#memberList"); list.innerHTML="";
  Object.entries(members).sort((a,b)=>(a[0]===ownerId?-1:b[0]===ownerId?1:0)).forEach(([id,m])=>{
    const row=document.createElement("div");row.className="member-row";
    row.innerHTML=`<span class="member-avatar">${id===ownerId?"👑":"👤"}</span>
      <div class="member-info"><div class="member-name">${esc(m.name||"ゲスト")}${id===me?"（自分）":""}</div>
      <div class="member-role">${id===ownerId?"オーナー":"参加メンバー"}</div></div>
      ${isOwner&&id!==ownerId?'<button class="member-remove" type="button">削除</button>':""}`;
    const btn=row.querySelector(".member-remove");
    if(btn)btn.onclick=async()=>{if(confirm(`${m.name||"このメンバー"}さんを削除する？`)){await remove(ref(db,`plans/${currentCode}/members/${id}`));}};
    list.appendChild(row);
  });
  $("#deletePlanButton").classList.toggle("hidden",!isOwner);
  $("#membersDialog").showModal();
}
async function leavePlan({removeMember=true}={}){
  const code=currentCode;
  if(removeMember&&code&&currentPlan?.meta?.ownerId!==deviceId()){
    try{await remove(ref(db,`plans/${code}/members/${deviceId()}`));}catch(e){console.error(e);}
  }
  if(unsubscribe)unsubscribe();unsubscribe=null;currentCode="";currentPlan=null;clearQueryCode();forgetGroup(code);showStart();
}
async function deleteCurrentPlan(){
  if(currentPlan?.meta?.ownerId!==deviceId())return;
  if(!confirm("このプランを全員の画面から完全に削除する？\\nこの操作は元に戻せません。"))return;
  const code=currentCode;
  try{await remove(ref(db,`plans/${code}`));forgetGroup(code);$("#membersDialog").close();leavePlan({removeMember:false});}
  catch(error){alert("削除できませんでした");console.error(error);}
}

async function shareCode(code,name){
  const url=new URL(location.href);url.searchParams.set("plan",code);
  const data={title:name||"Disney Companion",text:`Disney Companionのプランに参加してね`,url:url.toString()};
  try{
    if(navigator.share)await navigator.share(data);
    else{await navigator.clipboard.writeText(url.toString());showToast("共有URLをコピーしました");}
  }catch(error){if(error.name!=="AbortError")prompt("このURLをコピーして送ってね",url.toString());}
}
function sharePlan(){return shareCode(currentCode,currentPlan?.meta?.name);}
function storeTypedCode(e){e.target.value=cleanCode(e.target.value);}

deviceId();refreshNameUI();renderGroupList();
$("#profileButton").addEventListener("click",openProfile);
$("#homeProfileButton").addEventListener("click",openProfile);
$("#saveProfileButton").addEventListener("click",saveProfile);
$("#createPlanButton").addEventListener("click",createPlan);
$("#showJoinButton").addEventListener("click",()=>{$("#joinCodeInput").value="";$("#joinDialog").showModal();});
$("#joinCodeInput").addEventListener("input",storeTypedCode);
$("#joinPlanButton").addEventListener("click",()=>findPlanForJoin($("#joinCodeInput").value));
$("#confirmJoinButton").addEventListener("click",async()=>{$("#inviteDialog").close();await joinPlan(pendingJoinCode,{skipConfirm:true});});
$("#addButton").addEventListener("click",openNew);
$("#saveItemButton").addEventListener("click",saveItem);
$("#deleteItemButton").addEventListener("click",deleteItem);
$("#planNameInput").addEventListener("input",queueMetaUpdate);
$("#planDateInput").addEventListener("change",queueMetaUpdate);
$("#parkInput").addEventListener("change",queueMetaUpdate);
$("#shareButton").addEventListener("click",sharePlan);
$("#membersButton").addEventListener("click",openMembers);
$("#shareFromMembersButton").addEventListener("click",sharePlan);
$("#deletePlanButton").addEventListener("click",deleteCurrentPlan);
$("#leaveButton").addEventListener("click",()=>{if(confirm("このプランから退出する？"))leavePlan();});
$("#copyCodeButton").addEventListener("click",async()=>{await navigator.clipboard.writeText(currentCode);showToast("共有コードをコピーしました");});

const urlCode=cleanCode(new URL(location.href).searchParams.get("plan")||"");
if(urlCode.length===6){
  if(requireName())findPlanForJoin(urlCode);
}
