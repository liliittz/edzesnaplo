const ENDPOINT_URL = "https://script.google.com/macros/s/AKfycby97LkJR38ovcmIGmk83L3EwGrwdqK89wRbOoAo5lYS4erc_r9ZdTZrb49P_GQwzc9N/exec"; // <-- ide a /exec

const d = new Date();
document.getElementById("date").value = d.toISOString().slice(0,10);
document.getElementById("sessionPill").textContent =
  `Edzés: ${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;

const listEl = document.getElementById("exerciseList");

function addExerciseRow() {
  const id = "ex_" + Math.random().toString(16).slice(2);
  const wrap = document.createElement("div");
  wrap.dataset.exRow = id;
  wrap.className = "card";
  wrap.innerHTML = `
    <label>Gyakorlat neve</label><input id="${id}_name" type="text">
    <div class="grid">
      <div><label>Súly</label><input id="${id}_weight" type="text"></div>
      <div><label>Sorozat × ismétlés</label><input id="${id}_setsreps" type="text"></div>
    </div>
    <label>Nehézség (1–10)</label><input id="${id}_rpe" type="number" min="1" max="10">
    <label>Jegyzet</label><textarea id="${id}_note"></textarea>
    <button class="secondary" type="button" data-remove="${id}">Törlés</button>
  `;
  wrap.querySelector(`[data-remove="${id}"]`).onclick = () => wrap.remove();
  listEl.appendChild(wrap);
}

function v(id){ return (document.getElementById(id)?.value || "").trim(); }

function collectExercises() {
  return [...listEl.querySelectorAll("[data-ex-row]")]
    .map(row => {
      const id = row.dataset.exRow;
      return {
        name: v(`${id}_name`),
        weight: v(`${id}_weight`),
        setsreps: v(`${id}_setsreps`),
        difficulty: v(`${id}_rpe`),
        note: v(`${id}_note`)
      };
    })
    .filter(x => x.name);
}

document.getElementById("addExBtn").addEventListener("click", addExerciseRow);
addExerciseRow();

document.getElementById("sendBtn").addEventListener("click", async () => {
	showWorkoutSummary();
  const msg = document.getElementById("msg");
  msg.className = "msg";
  msg.textContent = "Küldés...";

 const payload = {
athlete_name: v("athlete_name"),
self_message: v("self_message"),
  date: v("date"),
  mood: v("mood"),
  mood_note: v("mood_note"),

  exercises: collectExercises(),

  q_best: v("q_best"),
  q_fav_ex: v("q_fav_ex"),
  q_hardest_why: v("q_hardest_why"),
  q_disliked_ex: v("q_disliked_ex"),
  q_hardest_part: v("q_hardest_part"),
  q_during: v("q_during"),
  q_after: v("q_after"),

  overall_rpe: v("overall_rpe"),
  overall_rpe_note: v("overall_rpe_note"),
  overall_note: v("overall_note")
};

function parseWeightKg(raw) {
  // Elfogad pl: "20", "20 kg", "17.5", "6-8", "6–8"
  if (!raw) return null;
  const s = String(raw).replace(",", ".").trim();

  // tartomány: 6-8 -> vegyük a nagyobbat (8)
  const range = s.match(/(\d+(\.\d+)?)\s*[-–]\s*(\d+(\.\d+)?)/);
  if (range) return Number(range[3]);

  const m = s.match(/(\d+(\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

function parseSetsReps(raw) {
  // Elfogad pl: "4x10", "4×10", "4*10", "3 x 12", "3×10-10"
  // Visszaad: { sets, reps }
  if (!raw) return { sets: 0, reps: 0 };
  const s = String(raw).toLowerCase().replace(/\s+/g, "");

  // sets: első szám az x/×/* előtt
  const mSets = s.match(/^(\d+)\s*[x×\*]/);
  const sets = mSets ? Number(mSets[1]) : 0;

  // reps: szám az x/×/* után
  //  - ha "10-12" -> vegyük a nagyobbat (12)
  const after = s.split(/x|×|\*/)[1] || "";
  const range = after.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return { sets, reps: Number(range[2]) };

  const mReps = after.match(/(\d+)/);
  const reps = mReps ? Number(mReps[1]) : 0;

  return { sets, reps };
}

function calcWorkoutSummary(exercises) {
  let totalSets = 0;
  let totalKgMoved = 0;

  let maxWeight = -Infinity;
  let maxWeightExercise = null;

  let maxRepsTotal = -Infinity;
  let maxRepsExercise = null;

  for (const ex of exercises) {
    const name = (ex.name || "").trim();
    if (!name) continue;

    const w = parseWeightKg(ex.weight);
    const { sets, reps } = parseSetsReps(ex.setsreps);

    totalSets += sets;

    const repsTotal = sets * reps;
    if (repsTotal > maxRepsTotal) {
      maxRepsTotal = repsTotal;
      maxRepsExercise = { name, repsTotal };
    }

    if (typeof w === "number" && !Number.isNaN(w)) {
      // össz kg: súly * sorozat * ismétlés
      totalKgMoved += w * sets * reps;

      if (w > maxWeight) {
        maxWeight = w;
        maxWeightExercise = { name, weight: w };
      }
    }
  }

  return {
    totalSets,
    totalKgMoved,          // szám
    maxWeightExercise,     // {name, weight} vagy null
    maxRepsExercise        // {name, repsTotal} vagy null
  };
}

function buildSummaryText(name, stats) {
  const safeName = (name || "").trim();
  const who = safeName ? safeName : "Szép munka";

  const totalKgRounded = Math.round(stats.totalKgMoved); // kerekítve, hogy “szép” legyen

  const line1 = `Gratulálok, ${who}! Szép edzés volt. Íme a mai edzés összegzése:`;
  const line2 = `A mai edzés ${stats.totalSets} munkasorozatból állt.`;
  const line3 = `Ma összesen ${totalKgRounded} kg súlyt mozgattál meg.`;

  const line4 = stats.maxWeightExercise
    ? `A legnagyobb súllyal végzett gyakorlat: ${stats.maxWeightExercise.name} (${stats.maxWeightExercise.weight} kg).`
    : `A legnagyobb súllyal végzett gyakorlat: (nincs megadva súly).`;

  const line5 = stats.maxRepsExercise
    ? `A legnagyobb ismétlésszám a(z) ${stats.maxRepsExercise.name} esetében volt.`
    : `A legnagyobb ismétlésszám: (nincs megadva sorozat×ismétlés).`;

  const line6 = `Csak így tovább!`;

  return [line1, line2, line3, line4, line5, line6].join("<br>");
}

function showWorkoutSummary() {
  const name = v("athlete_name");           // a név mező id-ja
  const exercises = collectExercises();     // a te gyakorlat-listád

  const stats = calcWorkoutSummary(exercises);
  const html = buildSummaryText(name, stats);

  const card = document.getElementById("summaryCard");
  const text = document.getElementById("summaryText");
  if (card && text) {
    text.innerHTML = html;
    card.style.display = "block";
  }
}



  try {
    const res = await fetch(ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    const out = await res.json();
    if (out.ok) msg.textContent = "✅ Sikeresen elküldve!";
    else { msg.className = "msg err"; msg.textContent = "❌ Hiba: " + (out.error || "ismeretlen"); }
  } catch (e) {
    msg.className = "msg err";
    msg.textContent = "❌ Nem sikerült elküldeni: " + e;
  }
});


