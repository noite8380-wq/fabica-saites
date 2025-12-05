/* jogo.js — FULL POWER:
   - Boss adaptativo com fases e IA situacional
   - Eventos psicológicos dinâmicos (drivers de tensão)
   - Autosave multinível (checkpoints invisíveis)
   - UI estável e compatível (sem optional chaining)
*/
(function () {
  'use strict';

  /* ---------- Helpers ---------- */
  const $ = id => document.getElementById(id);
  const now = () => new Date().toISOString();
  const safeParse = (r, f = null) => { try { return JSON.parse(r); } catch (e) { return f; } };
  const log = m => {
    const el = $('log');
    if (!el) { console.log(m); return; }
    el.textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + el.textContent;
  };

  /* ---------- Elements ---------- */
  const playerName = $('playerName'), playerAge = $('playerAge'), playerCode = $('playerCode');
  const btnCreate = $('btnCreate'), btnClear = $('btnClear');
  const inventoryGrid = $('inventory'), invDesc = $('inv-desc');
  const storyBox = $('story-box'), puzzleBox = $('puzzle-box');
  const nextBtn = $('next-btn'), quickSave = $('quickSave'), quickLoad = $('quickLoad');
  const sanVal = $('sanidade-val'), medoVal = $('medo-val'), corVal = $('coragem-val');
  const sanBarHost = $('san-bar'), medoBarHost = $('med-bar'), corBarHost = $('cor-bar');
  const sanBar = sanBarHost ? sanBarHost.firstElementChild : null;
  const medoBar = medoBarHost ? medoBarHost.firstElementChild : null;
  const corBar = corBarHost ? corBarHost.firstElementChild : null;
  const blood = $('blood'), hud = $('hud');
  const slotsContainer = $('slots'), exportAll = $('exportAll'), importAll = $('importAll'), importFile = $('importFile');
  const cutsceneOverlay = $('cutscene'), cutsceneText = $('cutscene-text'), cutNext = $('cut-next'), cutSkip = $('cut-skip');
  const themeToggle = $('themeToggle');

  /* ---------- Data: chapters, puzzles ---------- */
  const chapters = [
    [
      "O corredor parecia respirar junto com Rafael. As luzes tremiam num compasso que não combinava com o pulso humano.",
      "O telefone tocou atrás dele — o fio solto brilhava como um olho aberto.",
      "As portas do 5º repetiam-se; cada uma contava uma pequena diferença.",
      "Fim do Capítulo 1."
    ],
    [
      "A sombra no piso deixou de ser reflexo e passou a ser intenção, curva e fria como aço.",
      "As paredes sussurravam nomes que não pertenciam a ele.",
      "Um painel acendeu: SUJEITO R-FL17 — FASE 2 ATIVADA.",
      "Fim do Capítulo 2."
    ],
    [
      "A sala circular parecia construída fora do tempo; as palavras na parede se moviam.",
      "O candelabro caiu e as chamas desenharam formas que lembravam lembranças que ele não tinha.",
      "A ponte no vazio parecia feita de decisões passadas.",
      "Fim do Capítulo 3."
    ],
    [
      "O salão final abre como um pulmão negro. No centro, algo observa sem olhos e fala sem boca.",
      "A Sentinela do Abismo testa o 'eu' com perguntas que dobram a memória e o medo.",
      "As escolhas e seu inventário determinarão se Rafael sai inteiro... ou se a Sentinela o consome.",
      "Fim do Capítulo 4."
    ]
  ];

  const puzzles = [
    [{ q: "No corredor, três sons: passos, respiração e batida metálica. Qual NÃO pertence?", options: ["Passos", "Respiração", "Batida Metálica"], ans: "Batida Metálica", reward: "Chave do Andar Fantasma" }],
    [{ q: "A sombra imita:", options: ["O passado dele", "O medo dele", "O futuro dele"], ans: "O medo dele", reward: "Símbolo da Revelação" }],
    [{ q: "Qual símbolo revela a ponte como memória?", options: ["Sangue", "Sombra", "Vento"], ans: "Sombra", reward: "Fragmento da Memória Perdida" }],
    [{ q: "Guardião: 'Sou aquilo que você evita; quando me encara, eu me desfaz. O que sou?'", options: ["Medo", "Silêncio", "Mentira"], ans: "Medo", reward: "Coração da Verdade" }]
  ];

  /* ---------- Inventory & saves ---------- */
  const SAVE_KEY = 'sf_final_full_v1';
  const SLOTS_KEY = 'sf_slots_full_v1';
  const CHECKPOINTS_KEY = 'sf_checkpoints_full_v1';

  function createSave(name, age, code) {
    return {
      meta: { name: name || 'Player', age: age || 0, createdAt: now(), unlocked_floor: false },
      cred: { code: code || null },
      progress: { chapter: 0, part: 0 },
      inventory: [],
      solved: puzzles.map(ch => ch.map(() => false)),
      state: { sanidade: 100, medo: 0, coragem: 50 },
      drivers: { fatigue: 0, doubt: 0, loneliness: 0 },
      flags: {}
    };
  }

  const ITEM_LIBRARY = {
    chave_andar: { id: 'chave_andar', name: 'Chave do Andar Fantasma', desc: 'Abre uma porta no 5º andar. Útil para evitar loops.', usable: true },
    simbolo_rev: { id: 'simbolo_rev', name: 'Símbolo da Revelação', desc: 'Revela inscrições ocultas quando usado; reduz medo levemente.', usable: true },
    fragmento_mem: { id: 'fragmento_mem', name: 'Fragmento da Memória Perdida', desc: 'Recupera uma lembrança que pode restaurar sanidade.', usable: true },
    coracao_verdade: { id: 'coracao_verdade', name: 'Coração da Verdade', desc: 'Item final. Usado no confronto com a Sentinela.', usable: true },
    vela: { id: 'vela', name: 'Vela', desc: 'Ilumina textos; consumível.', usable: true },
    pocao: { id: 'pocao', name: 'Poção (sanidade)', desc: 'Restaura 20% de sanidade ao usar.', usable: true }
  };

  function loadLocal() { return safeParse(localStorage.getItem(SAVE_KEY), null); }
  function persist(save) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { log('Erro salvar: ' + e.message); } }
  function loadSlots() { return safeParse(localStorage.getItem(SLOTS_KEY), [null, null, null, null, null]); }
  function saveSlots(a) { try { localStorage.setItem(SLOTS_KEY, JSON.stringify(a)); } catch (e) { log('Erro slots: ' + e.message); } }

  /* ---------- Inventory UI ---------- */
  function renderInventory(save) {
    if (!inventoryGrid) return;
    inventoryGrid.innerHTML = '';
    const inv = (save && Array.isArray(save.inventory)) ? save.inventory : [];
    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div'); cell.className = 'inv-slot';
      if (inv[i]) {
        const it = inv[i];
        cell.innerHTML = `<div class="name">${it.name}</div><div class="qty">x${it.qty || 1}</div>`;
        cell.dataset.index = i;
        cell.addEventListener('mouseenter', () => showItemDesc(it));
        cell.addEventListener('mouseleave', () => hideItemDesc());
        cell.addEventListener('click', () => selectSlot(i));
      } else {
        cell.innerHTML = `<div style="opacity:.35">vazio</div>`;
      }
      inventoryGrid.appendChild(cell);
    }
  }
  function showItemDesc(it) { if (invDesc) invDesc.textContent = it.desc || 'Sem descrição.'; }
  function hideItemDesc() { if (invDesc) invDesc.textContent = 'Passe o mouse em um item para ver descrição.'; }

  let selectedSlot = null;
  function selectSlot(i) {
    const save = loadLocal(); if (!save) return;
    const it = save.inventory[i];
    if (!it) { selectedSlot = null; if (invDesc) invDesc.textContent = 'Slot vazio.'; return; }
    selectedSlot = i;
    if (invDesc) invDesc.textContent = it.desc + (it.qty ? ` (x${it.qty})` : '');
  }

  function addItemToInventory(save, itemTemplate, qty) {
    qty = typeof qty === 'number' ? qty : 1;
    if (!save.inventory) save.inventory = [];
    for (let i = 0; i < save.inventory.length; i++) {
      if (save.inventory[i] && save.inventory[i].id === itemTemplate.id) {
        save.inventory[i].qty = (save.inventory[i].qty || 1) + qty; persist(save); return true;
      }
    }
    for (let i = 0; i < 12; i++) {
      if (!save.inventory[i]) { save.inventory[i] = { ...itemTemplate, qty: qty }; persist(save); return true; }
    }
    if (save.inventory.length < 30) { save.inventory.push({ ...itemTemplate, qty: qty }); persist(save); return true; }
    log('Inventário cheio. Item descartado.');
    return false;
  }

  /* ---------- HUD & state ---------- */
  function updateHUD(state) {
    if (!state) return;
    if (sanVal) sanVal.textContent = state.sanidade;
    if (medoVal) medoVal.textContent = state.medo;
    if (corVal) corVal.textContent = state.coragem;
    if (sanBar) sanBar.style.width = state.sanidade + '%';
    if (medoBar) medoBar.style.width = state.medo + '%';
    if (corBar) corBar.style.width = state.coragem + '%';
    if (blood) {
      if (state.medo > 70) blood.classList.add('fast'); else blood.classList.remove('fast');
    }
    // HUD low sanity indicator
    if (hud) {
      if (state.sanidade < 30) hud.classList.add('low-sanity'); else hud.classList.remove('low-sanity');
    }
  }

  function changeState(delta, opts) {
    opts = opts || {};
    const save = loadLocal(); if (!save) return;
    const prev = { ...save.state };
    save.state.sanidade = Math.max(0, Math.min(100, Math.round((save.state.sanidade || 0) + (delta.san || 0))));
    save.state.medo = Math.max(0, Math.min(100, Math.round((save.state.medo || 0) + (delta.medo || 0))));
    save.state.coragem = Math.max(0, Math.min(100, Math.round((save.state.coragem || 0) + (delta.cor || 0))));
    // drivers update optionally
    if (delta.drivers) {
      Object.keys(delta.drivers).forEach(k => { save.drivers[k] = Math.max(0, Math.min(100, (save.drivers[k] || 0) + delta.drivers[k])); });
    }
    persist(save);
    if (save.state.medo > (prev.medo || 0)) { document.body.classList.add('shake-effect'); setTimeout(() => document.body.classList.remove('shake-effect'), 360); }
    if (save.state.sanidade < (prev.sanidade || 0) && hud) { hud.classList.add('flash'); setTimeout(() => hud.classList.remove('flash'), 900); }
    updateHUD(save.state);
    if (!opts.silent) createCheckpoint('state-change');
    if (save.state.sanidade <= 0) autoRestoreOnDefeat();
  }

  /* ---------- Story & puzzles ---------- */
  function showStory(save) {
    if (!save) return;
    const c = save.progress.chapter, p = save.progress.part;
    const titleEl = $('chapter-title'); if (titleEl) titleEl.textContent = `Capítulo ${c + 1} • Parte ${p + 1}`;
    if (storyBox) storyBox.textContent = (chapters[c] && chapters[c][p]) ? chapters[c][p] : '...';
    if (puzzleBox) puzzleBox.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'inline-block';
    // light drift of sanity (game tension)
    changeState({ san: -1 }, { silent: true });
    // final chapter theme
    if (c === chapters.length - 1) document.body.classList.add('final-chapter'); else document.body.classList.remove('final-chapter');
  }

  function openPuzzle(ch) {
    const p = puzzles[ch] && puzzles[ch][0]; if (!p || !puzzleBox) return;
    puzzleBox.innerHTML = '';
    const q = document.createElement('p'); q.textContent = p.q; puzzleBox.appendChild(q);
    const opts = document.createElement('div'); opts.style.display = 'grid'; opts.style.gap = '8px';
    p.options.forEach(opt => {
      const b = document.createElement('button'); b.className = 'ghost'; b.textContent = opt;
      b.onclick = () => checkPuzzle(opt, ch, 0, p);
      opts.appendChild(b);
    });
    puzzleBox.appendChild(opts); puzzleBox.style.display = 'block';
    if (nextBtn) nextBtn.style.display = 'none';
  }

  function checkPuzzle(choice, ch, idx, p) {
    const save = loadLocal(); if (!save) return;
    if (choice === p.ans) {
      if (!save.solved[ch][idx]) {
        const rewardItem = getItemByRewardName(p.reward);
        addItemToInventory(save, rewardItem, 1);
        save.solved[ch][idx] = true;
        log('Charada resolvida — ' + (p.reward || 'Recompensa'));
        alert('Correto! Você recebeu: ' + (p.reward || 'Item'));
        changeState({ cor: +8, medo: -6 });
      } else {
        alert('Charada já resolvida.');
      }
    } else {
      changeState({ medo: +14, san: -10 });
      alert('Errado. O medo sobe e algo treme ao seu redor.');
    }
    persist(save); renderInventory(save);
    if (puzzleBox) puzzleBox.style.display = 'none';
    if (nextBtn) nextBtn.style.display = 'inline-block';
    applySave(save);
  }

  /* ---------- Cutscene (robusta) ---------- */
  function playCutscene(lines, cb) {
    if (!Array.isArray(lines) || lines.length === 0) { if (cb) cb(); return; }
    if (!cutsceneOverlay || !cutsceneText || !cutNext || !cutSkip) { if (cb) cb(); return; }
    cutsceneOverlay.classList.add('show'); cutsceneText.textContent = lines[0];
    let i = 0;
    function advance() {
      i++;
      if (i >= lines.length) { cleanup(); if (cb) cb(); return; }
      cutsceneText.textContent = lines[i];
    }
    function skip() { cleanup(); if (cb) cb(); }
    function cleanup() { cutsceneOverlay.classList.remove('show'); try { cutNext.removeEventListener('click', advance); } catch (e) {} try { cutSkip.removeEventListener('click', skip); } catch (e) {} }
    cutNext.addEventListener('click', advance); cutSkip.addEventListener('click', skip);
  }

  /* ---------- Slots UI ---------- */
  function renderSlotsUI() {
    const arr = loadSlots();
    if (!Array.isArray(arr)) { saveSlots([null, null, null, null, null]); }
    const current = loadSlots();
    if (!slotsContainer) return;
    slotsContainer.innerHTML = '';
    current.forEach((s, i) => {
      const el = document.createElement('div');
      el.style.display = 'flex'; el.style.justifyContent = 'space-between'; el.style.alignItems = 'center'; el.style.gap = '6px'; el.style.marginTop = '6px';
      el.innerHTML = `<div>${s ? `<strong>Slot ${i + 1}</strong> <small style="color:var(--muted)">${s.meta.name}</small>` : `<strong>Slot ${i + 1}</strong> <small style="color:var(--muted)">vazio</small>`}</div>`;
      const actions = document.createElement('div');
      const btnS = document.createElement('button'); btnS.className = 'ghost'; btnS.textContent = s ? 'Sobrescrever' : 'Salvar aqui'; btnS.onclick = () => saveToSlot(i);
      const btnL = document.createElement('button'); btnL.className = 'ghost'; btnL.textContent = 'Carregar'; btnL.onclick = () => loadFromSlot(i);
      const btnD = document.createElement('button'); btnD.className = 'ghost'; btnD.textContent = 'Excluir'; btnD.onclick = () => { if (confirm('Excluir?')) { const a = loadSlots(); a[i] = null; saveSlots(a); renderSlotsUI(); } };
      actions.appendChild(btnS); actions.appendChild(btnL); actions.appendChild(btnD);
      el.appendChild(actions); slotsContainer.appendChild(el);
    });
  }
  function saveToSlot(i) { const s = loadLocal(); if (!s) return alert('Sem perfil.'); const a = loadSlots(); a[i] = s; saveSlots(a); renderSlotsUI(); alert('Salvo slot ' + (i + 1)); }
  function loadFromSlot(i) { const a = loadSlots(); if (!a[i]) return alert('Slot vazio.'); localStorage.setItem(SAVE_KEY, JSON.stringify(a[i])); applySave(a[i]); renderInventory(a[i]); renderSlotsUI(); alert('Carregado slot ' + (i + 1)); }

  /* ---------- Checkpoints invisíveis (multicamadas) ---------- */
  const MAX_CHECKPOINTS = 8;
  function loadCheckpoints() { return safeParse(localStorage.getItem(CHECKPOINTS_KEY), []); }
  function saveCheckpoints(arr) { try { localStorage.setItem(CHECKPOINTS_KEY, JSON.stringify(arr.slice(-MAX_CHECKPOINTS))); } catch (e) { log('Erro checkpoints: ' + e.message); } }

  function createCheckpoint(tag) {
    const cur = loadLocal();
    if (!cur) return;
    const cp = { tag: tag || 'auto', timestamp: now(), save: cur };
    const arr = loadCheckpoints();
    arr.push(cp);
    if (arr.length > MAX_CHECKPOINTS) arr.shift();
    saveCheckpoints(arr);
    console.debug('Checkpoint criado:', cp.tag, cp.timestamp);
  }

  function listCheckpoints() { return loadCheckpoints(); }
  function restoreCheckpointByIndex(idx) {
    const arr = loadCheckpoints();
    if (!arr || !arr[idx]) return false;
    localStorage.setItem(SAVE_KEY, JSON.stringify(arr[idx].save));
    applySave(arr[idx].save);
    log(`Checkpoint restaurado (${arr[idx].tag})`);
    return true;
  }

  function autoRestoreOnDefeat() {
    const arr = loadCheckpoints();
    if (!arr || arr.length === 0) {
      log('Nenhum checkpoint disponível — reinício requerido.');
      localStorage.removeItem(SAVE_KEY);
      if (storyBox) storyBox.textContent = 'Você perdeu. Crie um novo perfil.';
      return;
    }
    const last = arr[arr.length - 1];
    localStorage.setItem(SAVE_KEY, JSON.stringify(last.save));
    applySave(last.save);
    log('Restauração automática do último checkpoint: ' + last.tag);
    changeState({ medo: +8, san: -6 }, { silent: true });
  }

  /* ---------- Eventos psicológicos dinâmicos 2.0 ---------- */
  const PSY_EVENTS = [
    { id: 'sussurro', label: 'Sussurro na parede', effect: () => changeState({ medo: +5, san: -3 }) },
    { id: 'eco', label: 'Eco de passos vazios', effect: () => changeState({ medo: +8 }) },
    { id: 'sonho', label: 'Vislumbre de lembrança', effect: () => changeState({ san: +6, medo: -4 }) },
    { id: 'queda', label: 'Queda de luz', effect: () => changeState({ san: -6, medo: +6 }) }
  ];

  let psyInterval = null;
  function startPsychEvents() {
    if (psyInterval) clearInterval(psyInterval);
    psyInterval = setInterval(() => {
      const save = loadLocal(); if (!save) return;
      // adapt chance by drivers and medo (more medo -> higher chance)
      const medo = save.state.medo || 0;
      const driverFactor = ((save.drivers.fatigue || 0) + (save.drivers.doubt || 0) + (save.drivers.loneliness || 0)) / 300;
      const chance = 0.16 + (medo / 400) + driverFactor; // base ~16%
      if (Math.random() > Math.min(0.9, chance)) return;
      const ev = PSY_EVENTS[Math.floor(Math.random() * PSY_EVENTS.length)];
      log(`Evento psicológico: ${ev.label}`);
      // narrative injection & effect
      ev.effect();
      // create checkpoint tied to event
      createCheckpoint('psy:' + ev.id);
    }, Math.floor(14000 + Math.random() * 22000)); // 14s - 36s random window
  }
  function stopPsychEvents() { if (psyInterval) clearInterval(psyInterval); psyInterval = null; }

  /* ---------- Boss final adaptativo (IA situacional) ---------- */
  function makeBossForSave(save) {
    const medo = save.state.medo || 0, cor = save.state.coragem || 0, san = save.state.sanidade || 0;
    const baseHP = 160 + Math.round(medo * 1.4) - Math.round(cor * 0.7);
    const atk = 10 + Math.round(medo / 7);
    const defense = 6 + Math.round((100 - san) / 18);
    return { id: 'sentinela_abismo', name: 'Sentinela do Abismo', hp: Math.max(80, baseHP), maxHp: Math.max(80, baseHP), atk, defense, phase: 1, enrage: 0 };
  }

  function initiateBossBattle() {
    const save = loadLocal(); if (!save) return alert('Sem perfil.');
    if (!(save.progress.chapter === chapters.length - 1 && save.progress.part >= chapters[save.progress.chapter].length - 1)) {
      save.progress.chapter = chapters.length - 1;
      save.progress.part = chapters[save.progress.chapter].length - 1;
      persist(save); applySave(save);
    }
    playCutscene(['O salão se abre. Algo sem olhos o encara...', 'A Sentinela do Abismo desperta. Prepare-se.'], () => {
      const boss = makeBossForSave(save);
      createBattleUI(boss, save);
      createCheckpoint('boss-start');
    });
  }

  function createBattleUI(boss, save) {
    if (!puzzleBox || !storyBox) return;
    puzzleBox.style.display = 'block'; puzzleBox.innerHTML = '';
    const title = document.createElement('h3'); title.textContent = `${boss.name} — HP: ${boss.hp}/${boss.maxHp}`; puzzleBox.appendChild(title);

    const bossHpBar = document.createElement('div'); bossHpBar.style.height = '12px'; bossHpBar.style.background = 'rgba(255,255,255,0.06)'; bossHpBar.style.borderRadius = '6px'; bossHpBar.style.marginBottom = '8px';
    const bossInner = document.createElement('div'); bossInner.style.height = '100%'; bossInner.style.width = ((boss.hp / boss.maxHp) * 100) + '%'; bossInner.style.borderRadius = '6px';
    bossHpBar.appendChild(bossInner); puzzleBox.appendChild(bossHpBar);

    const info = document.createElement('div'); info.innerHTML = `<p>Sanidade: ${save.state.sanidade} • Medo: ${save.state.medo} • Coragem: ${save.state.coragem}</p>`;
    puzzleBox.appendChild(info);

    const actions = document.createElement('div'); actions.style.display = 'flex'; actions.style.gap = '8px'; actions.style.flexWrap = 'wrap';
    const btnAttack = document.createElement('button'); btnAttack.className = 'ghost'; btnAttack.textContent = 'Atacar';
    const btnDefend = document.createElement('button'); btnDefend.className = 'ghost'; btnDefend.textContent = 'Defender';
    const btnUseItem = document.createElement('button'); btnUseItem.className = 'ghost'; btnUseItem.textContent = 'Usar item';
    const btnFlee = document.createElement('button'); btnFlee.className = 'ghost'; btnFlee.textContent = 'Tentar recuar';
    actions.appendChild(btnAttack); actions.appendChild(btnDefend); actions.appendChild(btnUseItem); actions.appendChild(btnFlee);
    puzzleBox.appendChild(actions);

    const battleLog = document.createElement('div'); battleLog.style.marginTop = '10px'; battleLog.style.maxHeight = '180px'; battleLog.style.overflow = 'auto'; battleLog.style.fontSize = '0.9em';
    puzzleBox.appendChild(battleLog);
    function appendBattleLog(t) { battleLog.innerHTML = `<div>• ${t}</div>` + battleLog.innerHTML; }

    // --- Battle logic
    function playerAttack() {
      const pl = loadLocal(); if (!pl) return;
      // adaptive attack: boost when boss enraged, scale with coragem
      const base = Math.max(8, Math.round(8 + (pl.state.coragem / 9)));
      const variability = Math.floor(Math.random() * 8) - Math.round(boss.defense / 4);
      const dmg = Math.max(1, base + variability + Math.round((100 - pl.state.sanidade) / 40)); // low sanidade reduces control but may cause desperate hits
      boss.hp = Math.max(0, boss.hp - dmg);
      appendBattleLog(`Você causa ${dmg} de dano.`);
      persist(pl);
      bossPhaseCheck();
      updateBattleUI();
      createCheckpoint('battle-attack');
      if (boss.hp <= 0) return bossDefeated(pl);
      setTimeout(bossTurn, 700);
    }

    function playerDefend() {
      const pl = loadLocal(); if (!pl) return;
      appendBattleLog('Você assume postura defensiva (reduz dano por um turno).');
      pl.flags._defend = (pl.flags._defend || 0) + 1;
      persist(pl);
      setTimeout(bossTurn, 600);
    }

    function playerUseItemFlow() {
      const pl = loadLocal(); if (!pl) return;
      const itemList = document.createElement('div'); itemList.style.display = 'grid'; itemList.style.gridTemplateColumns = '1fr 1fr'; itemList.style.gap = '6px'; itemList.style.marginTop = '8px';
      (pl.inventory || []).forEach((it, idx) => {
        if (!it) return;
        const b = document.createElement('button'); b.className = 'ghost'; b.textContent = `${it.name} x${it.qty || 1}`;
        b.onclick = () => {
          if (it.id === 'pocao') {
            changeState({ san: +20 }, { silent: true });
            appendBattleLog('Você bebeu uma poção — sanidade restaurada.');
            pl.inventory[idx].qty = (pl.inventory[idx].qty || 1) - 1; if (pl.inventory[idx].qty <= 0) pl.inventory[idx] = null; persist(pl); renderInventory(pl); updateHUD(pl.state);
          } else if (it.id === 'simbolo_rev') {
            changeState({ medo: -12 }, { silent: true });
            appendBattleLog('Símbolo da Revelação usado — medo reduzido.');
          } else if (it.id === 'fragmento_mem') {
            changeState({ san: +30 }, { silent: true });
            appendBattleLog('Fragmento integrado — lembrança restaurada.');
            pl.inventory[idx] = null; persist(pl); renderInventory(pl); updateHUD(pl.state);
          } else if (it.id === 'coracao_verdade') {
            appendBattleLog('Você empunha o Coração da Verdade — efeito massivo!');
            const dmg = 32 + Math.round((pl.state.coragem / 2));
            boss.hp = Math.max(0, boss.hp - dmg);
            appendBattleLog(`Coração causa ${dmg} de dano direto.`);
            persist(pl);
            bossPhaseCheck(); updateBattleUI();
            createCheckpoint('used-heart');
            if (boss.hp <= 0) return bossDefeated(pl);
          } else {
            appendBattleLog('Nada acontece com esse item no combate.');
          }
          itemList.remove();
          setTimeout(bossTurn, 700);
        };
        itemList.appendChild(b);
      });
      const cancel = document.createElement('button'); cancel.className = 'ghost'; cancel.textContent = 'Cancelar'; cancel.onclick = () => itemList.remove();
      itemList.appendChild(cancel);
      puzzleBox.appendChild(itemList);
    }

    function playerFlee() {
      appendBattleLog('Você tenta recuar... a Sentinela empurra sua mente de volta.');
      const pl = loadLocal(); if (!pl) return;
      const chance = Math.min(0.6, 0.12 + (pl.state.coragem / 180));
      if (Math.random() < chance) { appendBattleLog('Você recuou com sucesso. Batalha terminada.'); createCheckpoint('flee-success'); endBattleUI(); }
      else { appendBattleLog('Falha. A Sentinela aproveita e ataca direitamente.'); setTimeout(bossTurn, 500); }
    }

    function bossTurn() {
      const pl = loadLocal(); if (!pl) return;
      // dynamic aggression based on player's behavior and drivers
      const driverPressure = ((pl.drivers.fatigue || 0) + (pl.drivers.doubt || 0)) / 120;
      boss.enrage = Math.min(1.8, boss.enrage + Math.random() * 0.08 + driverPressure * 0.02);
      const fearFactor = (pl.state.sanidade < 35) ? 1.45 : (pl.state.sanidade < 70 ? 1.12 : 1.0);
      const dmgRoll = Math.max(3, Math.round(boss.atk * boss.enrage * fearFactor + (Math.random() * 8)));
      const defended = (pl.flags && pl.flags._defend && pl.flags._defend > 0);
      const finalDmg = defended ? Math.max(1, Math.round(dmgRoll / 2)) : dmgRoll;
      changeState({ san: -finalDmg, medo: +Math.round(finalDmg / 3) }, { silent: true });
      appendBattleLog(`Sentinela ataca — sanidade -${finalDmg}.`);
      if (defended) { pl.flags._defend = Math.max(0, (pl.flags._defend || 1) - 1); persist(pl); }
      bossPhaseCheck(); updateBattleUI();
      if (pl.state.sanidade <= 0) { appendBattleLog('Sua sanidade se esvaiu por completo...'); autoRestoreOnDefeat(); endBattleUI(); }
    }

    function bossPhaseCheck() {
      const perc = (boss.hp / boss.maxHp) * 100;
      if (perc < 65 && boss.phase === 1) { boss.phase = 2; appendBattleLog('A Sentinela muda — vozes tornam-se coro.'); createCheckpoint('boss-phase-2'); boss.atk = Math.round(boss.atk * 1.18); boss.defense = Math.round(boss.defense * 1.08); }
      if (perc < 35 && boss.phase === 2) { boss.phase = 3; appendBattleLog('A Sentinela torna-se quase corpórea — pressão intensa.'); createCheckpoint('boss-phase-3'); boss.atk = Math.round(boss.atk * 1.35); boss.defense = Math.round(boss.defense * 1.2); }
    }

    function updateBattleUI() {
      title.textContent = `${boss.name} — HP: ${boss.hp}/${boss.maxHp} • Fase ${boss.phase}`;
      bossInner.style.width = ((boss.hp / boss.maxHp) * 100) + '%';
      const pl = loadLocal();
      if (info && pl) info.innerHTML = `<p>Sanidade: ${pl.state.sanidade} • Medo: ${pl.state.medo} • Coragem: ${pl.state.coragem}</p>`;
    }

    function bossDefeated(pl) {
      appendBattleLog('A Sentinela vacila — algo rompe o silêncio.');
      persist(pl); createCheckpoint('boss-defeated');
      if (pl.inventory && pl.inventory.some(it => it && it.id === 'coracao_verdade')) {
        appendBattleLog('O Coração da Verdade vibra e consome o vazio — você sobreviveu.');
        playCutscene(['A Sentinela se desfaz. Uma porta se abre para a luz.'], () => { pl.flags.bossResolved = true; persist(pl); applySave(pl); });
      } else {
        appendBattleLog('Você venceu, mas algo ainda falta... O final permanece ambíguo.');
        playCutscene(['A Sentinela recua. Você sobreviveu, mas não inteiro.'], () => { pl.flags.bossResolved = true; persist(pl); applySave(pl); });
      }
      endBattleUI();
    }

    function endBattleUI() {
      setTimeout(() => { if (puzzleBox) { puzzleBox.style.display = 'none'; puzzleBox.innerHTML = ''; } showStory(loadLocal()); }, 800);
    }

    // wire buttons
    btnAttack.onclick = playerAttack;
    btnDefend.onclick = playerDefend;
    btnUseItem.onclick = playerUseItemFlow;
    btnFlee.onclick = playerFlee;

    appendBattleLog('Batalha iniciada — escolha sua ação. Use itens sabiamente.');
  }

  /* ---------- Next flow & UI buttons ---------- */
  if (nextBtn) {
    nextBtn.addEventListener('click', function () {
      const save = loadLocal(); if (!save) return alert('Crie um perfil.');
      const ch = save.progress.chapter, pt = save.progress.part;
      const unsolved = puzzles[ch] && !save.solved[ch][0];
      if (unsolved) { openPuzzle(ch); return; }
      if (pt < chapters[ch].length - 1) {
        save.progress.part++; persist(save); applySave(save);
        showStory(save); log(`Avançou para parte ${save.progress.part + 1} do cap ${save.progress.chapter + 1}`);
      } else {
        if (ch < chapters.length - 1) {
          playCutscene([`Você deixou o Capítulo ${ch + 1}. Um presságio ecoa...`, `Próximo: Capítulo ${ch + 2}`], function () {
            save.progress.chapter++; save.progress.part = 0; persist(save); applySave(save);
            showStory(save); createCheckpoint('chapter-advance'); log('Capítulo desbloqueado.');
          });
        } else {
          // final
          initiateBossBattle();
        }
      }
    });
  }

  /* ---------- Quick save/load ---------- */
  if (quickSave) quickSave.addEventListener('click', function () {
    const save = loadLocal(); if (!save) return alert('Sem perfil.');
    const arr = loadSlots(); arr[0] = save; saveSlots(arr); renderSlotsUI(); createCheckpoint('quick-save'); alert('Quick saved.');
  });
  if (quickLoad) quickLoad.addEventListener('click', function () {
    const arr = loadSlots(); if (!arr[0]) return alert('Slot rápido vazio.'); localStorage.setItem(SAVE_KEY, JSON.stringify(arr[0])); applySave(arr[0]); alert('Quick loaded.');
  });

  /* ---------- Create / clear profile ---------- */
  if (btnCreate) btnCreate.addEventListener('click', function () {
    const name = playerName ? playerName.value.trim() : ''; const age = playerAge ? parseInt(playerAge.value, 10) : 0; const code = playerCode ? playerCode.value.trim() : '';
    if (!name || !age || !code) return alert('Preencha todos os campos.');
    if (age < 15) return alert('Idade mínima: 15 anos.');
    const existing = loadLocal();
    if (existing && existing.meta && (existing.meta.name !== name || (existing.cred && existing.cred.code !== code))) {
      if (!confirm('Perfil local diferente existe — sobrescrever?')) return;
    }
    const save = createSave(name, age, code);
    save.inventory = [{ ...ITEM_LIBRARY['vela'], qty: 1 }, { ...ITEM_LIBRARY['chave_andar'], qty: 1 }, null, null, null, null, null, null, null, null, null, null];
    persist(save); applySave(save); renderSlotsUI(); log('Perfil criado: ' + name);
    createCheckpoint('profile-created');
    playCutscene([`Bem-vindo, ${name}. O prédio observa.`], function () { log('Entrada registrada. Boa sorte.'); });
  });
  if (btnClear) btnClear.addEventListener('click', function () {
    if (!confirm('Apagar dados locais?')) return;
    localStorage.removeItem(SAVE_KEY); renderSlotsUI(); if (inventoryGrid) inventoryGrid.innerHTML = ''; if (invDesc) invDesc.textContent = 'Dados apagados.'; if (storyBox) storyBox.textContent = 'Perfil apagado'; alert('Apagado.');
  });

  /* ---------- Export / Import ---------- */
  if (exportAll) exportAll.addEventListener('click', function () {
    const b = new Blob([JSON.stringify(loadSlots(), null, 2)], { type: 'application/json' }); const u = URL.createObjectURL(b);
    const a = document.createElement('a'); a.href = u; a.download = `sombra_saves_${new Date().toISOString()}.json`; a.click(); URL.revokeObjectURL(u); log('Export ok');
  });
  if (importAll) importAll.addEventListener('click', function () { if (importFile) importFile.click(); });
  if (importFile) importFile.addEventListener('change', function (e) {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = function (ev) {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!Array.isArray(parsed)) throw new Error('Formato inválido');
        while (parsed.length < 5) parsed.push(null);
        saveSlots(parsed.slice(0, 5)); renderSlotsUI(); alert('Import ok');
      } catch (err) { alert('Falha import: ' + err.message); }
    };
    r.readAsText(f); e.target.value = '';
  });

  /* ---------- Theme toggle ---------- */
  if (themeToggle) themeToggle.addEventListener('click', function () { document.body.classList.toggle('light'); });

  /* ---------- Utilities ---------- */
  // map reward name to ITEM_LIBRARY by comparing display names robustly
  function getItemByRewardName(name) {
    if (!name) return ITEM_LIBRARY['chave_andar'];
    const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // find by value.name normalized
    for (const k in ITEM_LIBRARY) {
      const val = ITEM_LIBRARY[k];
      const valNorm = (val.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (valNorm === norm) return val;
    }
    // fuzzy fallback: contains words
    for (const k in ITEM_LIBRARY) {
      if ((ITEM_LIBRARY[k].name || '').toLowerCase().indexOf(name.toLowerCase()) !== -1) return ITEM_LIBRARY[k];
    }
    return ITEM_LIBRARY['chave_andar'];
  }

  function applySave(save) {
    if (!save) return;
    renderInventory(save); updateHUD(save.state); showStory(save);
  }

  /* ---------- Init ---------- */
  (function init() {
    if (!Array.isArray(loadSlots())) saveSlots([null, null, null, null, null]);
    renderSlotsUI();
    const existing = loadLocal();
    if (existing) { applySave(existing); log('Perfil carregado do local'); } else { if (storyBox) storyBox.textContent = 'Crie um perfil à esquerda.'; }
    startPsychEvents();
    if ((loadCheckpoints() || []).length === 0 && existing) createCheckpoint('initial');
    // autosave invisível: interval that keeps checkpoints rolling
    setInterval(function () { createCheckpoint('autosave'); }, 22000);
    // expose API for debugging
    window.SombraFinal = {
      loadLocal, persist, loadSlots, saveSlots, ITEM_LIBRARY,
      listCheckpoints, restoreCheckpointByIndex, createCheckpoint, initiateBossBattle
    };
  })();

})();
