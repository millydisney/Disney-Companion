const $ = (selector) => document.querySelector(selector);

const categoryInfo = {
  dpa: ["DPA", "badge-dpa"],
  pp: ["PP", "badge-pp"],
  sp: ["SP", "badge-sp"],
  food: ["フード", "badge-food"],
  show: ["ショー・パレード", "badge-show"],
  special: ["特別な体験", "badge-special"],
  other: ["その他", "badge-other"]
};

const foodSamples = [
  {name:"シナモンチュロス", type:"チュロス", detail:"味：シナモン", emoji:"🥖"},
  {name:"クレームブリュレ風チュロス", type:"チュロス", detail:"味：クレームブリュレ風", emoji:"🥖"},
  {name:"キャラメルポップコーン", type:"ポップコーン", detail:"味：キャラメル", emoji:"🍿"},
  {name:"ソルトポップコーン", type:"ポップコーン", detail:"味：ソルト", emoji:"🍿"},
  {name:"季節のカップデザート", type:"スイーツ", detail:"期間限定サンプル", emoji:"🍰"},
  {name:"スモークターキーレッグ", type:"軽食", detail:"食べ歩き", emoji:"🍗"}
];

const state = {
  name: "みんなのパークプラン",
  date: new Date().toISOString().slice(0,10),
  park: "東京ディズニーランド",
  items: [],
  editingId: null,
  foodFilter: "all"
};

function uid(){
  return Math.random().toString(36).slice(2,10);
}

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[char]));
}

function minutes(time){
  if(!time) return 9999;
  const [hours, mins] = time.split(":").map(Number);
  return hours * 60 + mins;
}

function encodeState(){
  const payload = {
    name: state.name,
    date: state.date,
    park: state.park,
    items: state.items
  };
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function decodeState(value){
  try{
    return JSON.parse(decodeURIComponent(escape(atob(value))));
  }catch{
    return null;
  }
}

function persist(){
  localStorage.setItem("disneyCompanionState", JSON.stringify(state));
}

function loadState(){
  const shared = location.hash.startsWith("#plan=")
    ? decodeState(location.hash.slice(6))
    : null;
  const local = JSON.parse(localStorage.getItem("disneyCompanionState") || "null");
  const loaded = shared || local;

  if(loaded){
    state.name = loaded.name || state.name;
    state.date = loaded.date || state.date;
    state.park = loaded.park || state.park;
    state.items = Array.isArray(loaded.items) ? loaded.items : [];
  }

  $("#planName").value = state.name;
  $("#planDate").value = state.date;
  $("#parkSelect").value = state.park;
}

function renderPlan(){
  state.items.sort((a,b) => minutes(a.start) - minutes(b.start));
  const list = $("#planList");
  list.innerHTML = "";
  $("#itemCount").textContent = `${state.items.length}件`;

  if(!state.items.length){
    list.innerHTML = `
      <div class="empty-state">
        まだ予定がありません。<br>
        「＋ 予定を追加」から入れてみてね。
      </div>`;
  }

  state.items.forEach(item => {
    const [label, badgeClass] = categoryInfo[item.category] || categoryInfo.other;
    const element = document.createElement("article");
    element.className = `plan-item${item.done ? " done" : ""}`;
    element.innerHTML = `
      <div class="item-time">
        ${item.start}
        ${item.end ? `<br><small>〜${item.end}</small>` : ""}
      </div>
      <div>
        <span class="badge ${badgeClass}">${label}</span>
        <div class="item-title">${escapeHtml(item.title)}</div>
        ${item.note ? `<div class="item-note">${escapeHtml(item.note)}</div>` : ""}
      </div>
      <div class="item-actions">
        <button class="circle-button done-button" type="button">${item.done ? "↩" : "✓"}</button>
        <button class="circle-button edit-button" type="button">✎</button>
      </div>`;

    element.querySelector(".done-button").addEventListener("click", () => {
      item.done = !item.done;
      sync();
    });

    element.querySelector(".edit-button").addEventListener("click", () => {
      openEditDialog(item.id);
    });

    list.appendChild(element);
  });

  const next = state.items.find(item => !item.done);
  $("#nextTime").textContent = next ? next.start : "--:--";
  $("#nextTitle").textContent = next ? next.title : "予定を追加しよう";
  $("#nextNote").textContent = next
    ? (next.note || "次の予定です")
    : "次の予定がここに表示されます";
}

function renderFoods(){
  const query = $("#foodSearch").value.trim().toLowerCase();
  const list = $("#foodList");
  list.innerHTML = "";

  const filtered = foodSamples.filter(food => {
    const matchesFilter = state.foodFilter === "all" || food.type === state.foodFilter;
    const haystack = `${food.name} ${food.type} ${food.detail}`.toLowerCase();
    return matchesFilter && haystack.includes(query);
  });

  filtered.forEach(food => {
    const card = document.createElement("article");
    card.className = "food-card";
    card.innerHTML = `
      <div class="food-visual">${food.emoji}</div>
      <div class="food-body">
        <span class="food-type">${food.type}</span>
        <h3>${escapeHtml(food.name)}</h3>
        <p>${escapeHtml(food.detail)}</p>
        <button class="food-add" type="button">プランに追加</button>
      </div>`;

    card.querySelector(".food-add").addEventListener("click", () => {
      state.editingId = null;
      $("#dialogTitle").textContent = "フードをプランに追加";
      $("#categoryInput").value = "food";
      $("#titleInput").value = food.name;
      $("#startInput").value = "";
      $("#endInput").value = "";
      $("#noteInput").value = food.detail;
      $("#planDialog").showModal();
    });

    list.appendChild(card);
  });
}

function sync(){
  persist();
  renderPlan();
}

function openNewDialog(){
  state.editingId = null;
  $("#dialogTitle").textContent = "予定を追加";
  $("#categoryInput").value = "food";
  $("#titleInput").value = "";
  $("#startInput").value = "";
  $("#endInput").value = "";
  $("#noteInput").value = "";
  $("#planDialog").showModal();
}

function openEditDialog(id){
  const item = state.items.find(entry => entry.id === id);
  if(!item) return;

  state.editingId = id;
  $("#dialogTitle").textContent = "予定を編集";
  $("#categoryInput").value = item.category;
  $("#titleInput").value = item.title;
  $("#startInput").value = item.start;
  $("#endInput").value = item.end || "";
  $("#noteInput").value = item.note || "";
  $("#planDialog").showModal();
}

$("#addPlanButton").addEventListener("click", openNewDialog);

$("#savePlanButton").addEventListener("click", () => {
  const title = $("#titleInput").value.trim();
  const start = $("#startInput").value;

  if(!title || !start){
    alert("予定名と開始時間を入力してね");
    return;
  }

  const newItem = {
    id: state.editingId || uid(),
    category: $("#categoryInput").value,
    title,
    start,
    end: $("#endInput").value,
    note: $("#noteInput").value.trim(),
    done: false
  };

  if(state.editingId){
    const index = state.items.findIndex(item => item.id === state.editingId);
    newItem.done = state.items[index].done;
    state.items[index] = newItem;
  }else{
    state.items.push(newItem);
  }

  $("#planDialog").close();
  sync();
});

$("#planName").addEventListener("input", event => {
  state.name = event.target.value;
  persist();
});

$("#planDate").addEventListener("change", event => {
  state.date = event.target.value;
  persist();
});

$("#parkSelect").addEventListener("change", event => {
  state.park = event.target.value;
  persist();
});

$("#shareButton").addEventListener("click", async () => {
  state.name = $("#planName").value;
  state.date = $("#planDate").value;
  state.park = $("#parkSelect").value;

  const url = `${location.href.split("#")[0]}#plan=${encodeState()}`;
  const shareData = {
    title: state.name,
    text: `${state.date} ${state.park}のプラン`,
    url
  };

  try{
    if(navigator.share){
      await navigator.share(shareData);
    }else{
      await navigator.clipboard.writeText(url);
      alert("共有リンクをコピーしました");
    }
  }catch(error){
    if(error.name !== "AbortError"){
      prompt("このURLをコピーして共有してね", url);
    }
  }
});

document.querySelectorAll(".nav-item").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));
    document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
    button.classList.add("active");
    $(`#${button.dataset.screen}`).classList.add("active");
  });
});

document.querySelectorAll(".chip").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach(chip => chip.classList.remove("active"));
    button.classList.add("active");
    state.foodFilter = button.dataset.filter;
    renderFoods();
  });
});

$("#foodSearch").addEventListener("input", renderFoods);

loadState();
renderPlan();
renderFoods();
