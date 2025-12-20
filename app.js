const ENDPOINT_URL =
  "https://script.google.com/macros/s/AKfycby97LkJR38ovcmIGmk83L3EwGrwdqK89wRbOoAo5lYS4erc_r9ZdTZrb49P_GQwzc9N/exec";

window.addEventListener("DOMContentLoaded", () => {
  const d = new Date();

  const dateEl = document.getElementById("date");
  const pillEl = document.getElementById("sessionPill");
  const listEl = document.getElementById("exerciseList");
  const addBtn = document.getElementById("addExBtn");
  const sendBtn = document.getElementById("sendBtn");
  const msgEl = document.getElementById("msg");

  let isSending = false;

  // Dátum + fejléc
  if (dateEl) dateEl.value = d.toISOString().slice(0, 10);
  if (pillEl) {
    pillEl.textContent = `Edzés: ${String(d.getDate()).padStart(2, "0")}.${String(
      d.getMonth() + 1
    ).padStart(2, "0")}.`;
  }

  function v(id) {
    const el = document.getElementById(id);
    return (el && el.value ? String(el.value) : "").trim();
  }

  function setMsg(text, isError = false) {
    if (!msgEl) return;
    msgEl.className = isError ? "msg err" : "msg";
    msgEl.textContent = text;
  }

  function collectExercises() {
    if (!listEl) return [];
    return [...listEl.querySelectorAll("[data-ex-row]")]
      .map((row) => {
        const id = row.dataset.exRow;
        return {
          name: v(`${id}_name`),
          weight: v(`${id}_weight`),
          setsreps: v(`${id}_setsreps`),
          difficulty: v(`${id}_rpe`),
          note: v(`${id}_note`),
        };
      })
      .filter((x) => x.name);
  }

  function parseWeightKg(raw) {
    if (!raw) return null;
    const s = String(raw).replace(",", ".").trim();

    const range = s.match(/(\d+(\.\d+)?)\s*[-–]\s*(\d+(\.\d+)?)/);
    if (range) return Number(range[3]);

    const m = s.match(/(\d+(\.\d+)?)/);
    return m ? Number(m[1]) : null;
  }

  function parseSetsReps(raw) {
    if (!raw) return { sets: 0, reps: 0 };
    const s = String(raw).toLowerCase().replace(/\s+/g, "");

    const mSets = s.match(/^(\d+)\s*[x×]/); // csillag nem kell
    const sets = mSets ? Number(mSets[1]) : 0;

    const after = s.split(/x|×/)[1] || "";
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
        totalKgMoved += w * sets * reps;

        if (w > maxWeight) {
          maxWeight = w;
          maxWeightExercise = { name, weight: w };
        }
      }
    }

    return { totalSets, totalKgMoved, maxWeightExercise, maxRepsExercise };
  }

  function buildSummaryText(name, stats) {
    const safeName = (name || "").trim();
    const who = safeName ? safeName : "Szép munka";

    const totalKgRounded = Math.round(stats.totalKgMoved);

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
    const name = v("athlete_name");
    const exercises = collectExercises();
    const stats = calcWorkoutSummary(exercises);
    const html = buildSummaryText(name, stats);

    const card = document.getElementById("summaryCard");
    const text = document.getElementById("summaryText");
    if (card && text) {
      text.innerHTML = html;
      card.style.display = "block";
    }
  }

  function insertAtCursor(input, text) {
    if (!input) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    input.focus();
    const pos = start + text.length;
    if (input.setSelectionRange) input.setSelectionRange(pos, pos);
  }

  function addExerciseRow() {
    if (!listEl) return;

    const id = "ex_" + Math.random().toString(16).slice(2);
    const wrap = document.createElement("div");
    wrap.dataset.exRow = id;
    wrap.className = "card";

    wrap.innerHTML = `
      <label>Gyakorlat neve</label>
      <input id="${id}_name" type="text" />

      <div class="grid">
        <div>
          <label>Súly (kg)</label>
         <input id="${id}_weight"
       type="number"
       inputmode="decimal"
       step="0.5"
       min="0"
       placeholder="pl. 20" />

        </div>

        <div>
          <label>Sorozat × ismétlés</label>
          <input id="${id}_setsreps"
                 type="text"
                 inputmode="numeric"
                 placeholder="pl. 4×10" />

          <div class="row" style="margin-top:8px;">
            <button class="secondary"
                    type="button"
                    data-insert="${id}_setsreps"
                    data-char="×">×</button>
          </div>
        </div>
      </div>

      <label>Nehézség (1–10)</label>
      <input id="${id}_rpe"
             type="number"
             inputmode="numeric"
             min="1"
             max="10" />

      <label>Jegyzet</label>
      <textarea id="${id}_note"></textarea>

      <div class="row" style="margin-top:10px;">
        <button class="secondary" type="button" data-remove="${id}">Törlés</button>
      </div>
    `;

    // × gomb működtetése
    wrap.querySelectorAll("[data-insert]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-insert");
        const ch = btn.getAttribute("data-char") || "×";
        insertAtCursor(document.getElementById(targetId), ch);
      });
    });

    // törlés
    const rm = wrap.querySelector(`[data-remove="${id}"]`);
    if (rm) rm.addEventListener("click", () => wrap.remove());

    // hozzáadás a listához
    listEl.appendChild(wrap);
  }

  // “+ Új gyakorlat” gomb
  if (addBtn) addBtn.addEventListener("click", addExerciseRow);

  // legyen alapból 1 gyakorlat
  addExerciseRow();

  // Küldés (csak egyszer)
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      if (isSending) return;

      isSending = true;
      sendBtn.disabled = true;
      sendBtn.textContent = "Küldés folyamatban…";

      showWorkoutSummary();
      setMsg("Küldés...");

      const payload = {
        athlete_name: v("athlete_name"),
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
        overall_note: v("overall_note"),
      };

      try {
        const res = await fetch(ENDPOINT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(payload),
        });

        const out = await res.json();

        if (out.ok) {
          setMsg("✅ Sikeresen elküldve!");
          sendBtn.textContent = "Elküldve ✅";
          // marad lezárva (ne lehessen duplán)
          return;
        } else {
          setMsg("❌ Hiba: " + (out.error || "ismeretlen"), true);
        }
      } catch (e) {
        setMsg("❌ Nem sikerült elküldeni: " + e, true);
      }

      // ha idáig eljut, hiba volt → feloldjuk
      isSending = false;
      sendBtn.disabled = false;
      sendBtn.textContent = "Küldés";
    });
  }
});

