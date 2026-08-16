
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  getDatabase, ref as dbRef, get, set, update, remove, onValue, push, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js";
import {
  getAuth, signInWithEmailAndPassword,
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
  getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

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
const auth = getAuth(app);
const storage = getStorage(app);
const $ = (s)=>document.querySelector(s);

let currentUser = null;
let isAdmin = false;
let foods = {};
let editingId = null;
let editingPhotoUrl = "";
let editingPhotoPath = "";
let removeExistingPhoto = false;

const statusLabels = {active:"販売中",upcoming:"販売予定",ended:"販売終了"};
const categoryLabels = {meal:"しっかりめ",snack:"軽食",sweet:"スイーツ",drink:"ドリンク"};

function showToast(message){
  const t=$("#toast"); t.textContent=message; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1800);
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function setScreen(name){
  $("#loginScreen").classList.toggle("hidden",name!=="login");
  $("#unauthorizedScreen").classList.toggle("hidden",name!=="unauthorized");
  $("#adminScreen").classList.toggle("hidden",name!=="admin");
  $("#signOutButton").classList.toggle("hidden",name==="login");
}
async function adminCheck(user){
  const snap = await get(dbRef(db,`admins/${user.uid}`));
  return snap.exists() && snap.val() === true;
}

async function login(){
  const email=$("#adminEmailInput").value.trim();
  const password=$("#adminPasswordInput").value;
  const button=$("#emailLoginButton");

  if(!email || !password){
    alert("メールアドレスとパスワードを入力してね");
    return;
  }

  button.disabled=true;
  button.textContent="ログイン中…";

  try{
    await signInWithEmailAndPassword(auth,email,password);
  }catch(error){
    console.error(error);

    const messages={
      "auth/invalid-credential":"メールアドレスかパスワードが違います。",
      "auth/invalid-email":"メールアドレスの形式を確認してね。",
      "auth/too-many-requests":"ログイン試行が多すぎます。少し待ってから試してね。",
      "auth/user-disabled":"このアカウントは無効になっています。"
    };
    alert(messages[error.code] || `ログインできませんでした。
${error.code||error.message}`);
  }finally{
    button.disabled=false;
    button.textContent="ログイン";
  }
}
$("#emailLoginButton").onclick=login;
$("#adminPasswordInput").addEventListener("keydown",e=>{
  if(e.key==="Enter") login();
});
$("#signOutButton").onclick=()=>signOut(auth);
$("#copyUidButton").onclick=async()=>{
  await navigator.clipboard.writeText($("#uidText").textContent);
  showToast("UIDをコピーしました");
};

onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){isAdmin=false;setScreen("login");return;}
  try{
    isAdmin=await adminCheck(user);
    if(!isAdmin){
      $("#uidText").textContent=user.uid;
      setScreen("unauthorized");
      return;
    }
    setScreen("admin");
    startFoodsListener();
  }catch(e){
    console.error(e);
    alert("管理者確認でエラーが発生しました");
  }
});

function startFoodsListener(){
  onValue(dbRef(db,"foods"),snap=>{
    foods=snap.val()||{};
    renderFoods();
  });
}
function filteredFoods(){
  const q=$("#foodSearch").value.trim().toLowerCase();
  const park=$("#parkFilter").value;
  return Object.entries(foods)
    .map(([id,f])=>({id,...f}))
    .filter(f=>{
      if(park!=="all" && f.park!==park)return false;
      const hay=`${f.name||""} ${f.type||""} ${f.flavor||""} ${f.shop||""} ${f.area||""}`.toLowerCase();
      return !q || hay.includes(q);
    })
    .sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
}
function renderFoods(){
  const all=Object.values(foods);
  $("#foodCount").textContent=all.length;
  $("#activeCount").textContent=all.filter(f=>f.status==="active").length;
  $("#photoCount").textContent=all.filter(f=>f.photoUrl).length;

  const list=$("#foodList"), items=filteredFoods();
  list.innerHTML="";
  if(!items.length){list.innerHTML='<div class="empty">登録されたフードがありません。</div>';return;}

  items.forEach(food=>{
    const el=document.createElement("article"); el.className="food-row";
    const visual=food.photoUrl
      ? `<img class="thumb" src="${esc(food.photoUrl)}" alt="">`
      : `<div class="thumb">${food.type==="ポップコーン"?"🍿":food.type==="チュロス"?"🥖":"🍴"}</div>`;
    el.innerHTML=`
      ${visual}
      <div>
        <div class="food-title">${esc(food.name||"名称未設定")}</div>
        <div class="food-meta">${food.park==="sea"?"🌋 シー":"🏰 ランド"}・${esc(categoryLabels[food.category]||food.category||"")}<br>
        ${food.type?esc(food.type):""}${food.flavor?` / ${esc(food.flavor)}`:""}${food.price?`・¥${Number(food.price).toLocaleString()}`:""}</div>
        <span class="status ${esc(food.status||"active")}">${esc(statusLabels[food.status]||"販売中")}</span>
      </div>
      <button class="edit-btn" type="button">✎</button>`;
    el.querySelector(".edit-btn").onclick=()=>openEdit(food);
    list.appendChild(el);
  });
}
$("#foodSearch").oninput=renderFoods;
$("#parkFilter").onchange=renderFoods;

function resetForm(){
  editingId=null;editingPhotoUrl="";editingPhotoPath="";removeExistingPhoto=false;
  $("#foodDialogTitle").textContent="フードを登録";
  $("#nameInput").value="";$("#parkInput").value="land";$("#categoryInput").value="snack";
  $("#typeInput").value="";$("#flavorInput").value="";$("#priceInput").value="";
  $("#statusInput").value="active";$("#areaInput").value="";$("#shopInput").value="";
  $("#mobileOrderInput").checked=false;$("#limitedInput").checked=false;
  $("#startDateInput").value="";$("#endDateInput").value="";$("#creditInput").value="";
  $("#photoInput").value="";$("#adminNoteInput").value="";
  $("#photoPreviewWrap").classList.add("hidden");$("#photoPreview").src="";
  $("#deleteFoodButton").classList.add("hidden");
}
function openNew(){resetForm();$("#foodDialog").showModal();}
function openEdit(food){
  resetForm();editingId=food.id;editingPhotoUrl=food.photoUrl||"";editingPhotoPath=food.photoPath||"";
  $("#foodDialogTitle").textContent="フードを編集";
  $("#nameInput").value=food.name||"";$("#parkInput").value=food.park||"land";
  $("#categoryInput").value=food.category||"snack";$("#typeInput").value=food.type||"";
  $("#flavorInput").value=food.flavor||"";$("#priceInput").value=food.price||"";
  $("#statusInput").value=food.status||"active";$("#areaInput").value=food.area||"";
  $("#shopInput").value=food.shop||"";$("#mobileOrderInput").checked=Boolean(food.mobileOrder);
  $("#limitedInput").checked=Boolean(food.limited);$("#startDateInput").value=food.startDate||"";
  $("#endDateInput").value=food.endDate||"";$("#creditInput").value=food.credit||"";
  $("#adminNoteInput").value=food.adminNote||"";
  if(food.photoUrl){$("#photoPreview").src=food.photoUrl;$("#photoPreviewWrap").classList.remove("hidden");}
  $("#deleteFoodButton").classList.remove("hidden");
  $("#foodDialog").showModal();
}
$("#newFoodButton").onclick=openNew;

$("#photoInput").onchange=e=>{
  const file=e.target.files?.[0]; if(!file)return;
  $("#photoPreview").src=URL.createObjectURL(file);
  $("#photoPreviewWrap").classList.remove("hidden");
  removeExistingPhoto=false;
};
$("#removePhotoButton").onclick=()=>{
  $("#photoInput").value="";$("#photoPreview").src="";$("#photoPreviewWrap").classList.add("hidden");
  removeExistingPhoto=true;
};

async function uploadPhoto(foodId,file){
  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`food-images/${foodId}/${Date.now()}-${safeName}`;
  const sref=storageRef(storage,path);
  await uploadBytes(sref,file,{contentType:file.type||"image/jpeg"});
  const url=await getDownloadURL(sref);
  return {url,path};
}

async function saveFood(){
  if(!isAdmin)return;
  const name=$("#nameInput").value.trim();
  if(!name){alert("商品名を入力してね");return;}
  $("#saveFoodButton").disabled=true;$("#saveFoodButton").textContent="保存中…";
  try{
    const id=editingId||push(dbRef(db,"foods")).key;
    let photoUrl=editingPhotoUrl,photoPath=editingPhotoPath;
    const file=$("#photoInput").files?.[0];

    if(removeExistingPhoto && photoPath){
      try{await deleteObject(storageRef(storage,photoPath));}catch(e){console.warn(e);}
      photoUrl="";photoPath="";
    }
    if(file){
      if(photoPath){try{await deleteObject(storageRef(storage,photoPath));}catch(e){console.warn(e);}}
      const uploaded=await uploadPhoto(id,file); photoUrl=uploaded.url;photoPath=uploaded.path;
    }

    const data={
      name,
      park:$("#parkInput").value,
      category:$("#categoryInput").value,
      type:$("#typeInput").value.trim(),
      flavor:$("#flavorInput").value.trim(),
      price:Number($("#priceInput").value)||0,
      status:$("#statusInput").value,
      area:$("#areaInput").value.trim(),
      shop:$("#shopInput").value.trim(),
      mobileOrder:$("#mobileOrderInput").checked,
      limited:$("#limitedInput").checked,
      startDate:$("#startDateInput").value,
      endDate:$("#endDateInput").value,
      credit:$("#creditInput").value.trim(),
      photoUrl,photoPath,
      adminNote:$("#adminNoteInput").value.trim(),
      updatedBy:currentUser.uid,
      updatedAt:serverTimestamp()
    };
    if(!editingId)data.createdAt=serverTimestamp();
    await update(dbRef(db,`foods/${id}`),data);
    $("#foodDialog").close();showToast("保存しました");
  }catch(error){
    console.error(error);
    alert("保存できませんでした。Authentication / Storageの設定を確認してね。");
  }finally{
    $("#saveFoodButton").disabled=false;$("#saveFoodButton").textContent="保存";
  }
}

async function deleteFood(){
  if(!editingId||!confirm("このフードを削除する？"))return;
  try{
    if(editingPhotoPath){try{await deleteObject(storageRef(storage,editingPhotoPath));}catch(e){console.warn(e);}}
    await remove(dbRef(db,`foods/${editingId}`));
    $("#foodDialog").close();showToast("削除しました");
  }catch(e){console.error(e);alert("削除できませんでした");}
}
$("#saveFoodButton").onclick=saveFood;
$("#deleteFoodButton").onclick=deleteFood;
