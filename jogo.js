/* jogo.js — final: inventário Resident + Cap 4 mix + HUD + cutscenes */
(function(){
  'use strict';
  const $ = id => document.getElementById(id);
  const now = ()=> new Date().toISOString();
  const safeParse = (r,f=null)=>{ try{return JSON.parse(r);}catch(e){return f} };
  const log = m => { $('log').textContent = `[${new Date().toLocaleTimeString()}] ${m}\n` + $('log').textContent; };

  // ELEMENTOS
  const playerName = $('playerName'), playerAge = $('playerAge'), playerCode = $('playerCode');
  const btnCreate = $('btnCreate'), btnClear = $('btnClear');
  const inventoryGrid = $('inventory'), invDesc = $('inv-desc');
  const storyBox = $('story-box'), puzzleBox = $('puzzle-box');
  const nextBtn = $('next-btn'), quickSave = $('quickSave'), quickLoad = $('quickLoad');
  const sanVal = $('sanidade-val'), medoVal = $('medo-val'), corVal = $('coragem-val');
  const sanBar = $('san-bar').firstElementChild, medoBar = $('med-bar').firstElementChild, corBar = $('cor-bar').firstElementChild;
  const blood = $('blood'), hud = $('hud');
  const slotsContainer = $('slots'), exportAll = $('exportAll'), importAll = $('importAll'), importFile = $('importFile');
  const cutsceneOverlay = $('cutscene'), cutsceneText = $('cutscene-text'), cutNext = $('cut-next'), cutSkip = $('cut-skip');
  const themeToggle = $('themeToggle');

  // DATA (capítulos + charadas)
  const chapters = [
    [
      "O corredor parecia respirar junto com Rafael. As luzes tremiam num compasso que não combinava com o pulso humano.",
      "O telefone tocou atrás dele — o fio solto brilhava como um olho aberto.",
      "As portas do 5º repetiam-se; cada uma contava uma pequena diferença, um erro de memória.",
      "Fim do Capítulo 1."
    ],
    [
      "A sombra no piso deixou de ser reflexo e passou a ser intenção, curva e fria como aço.",
      "As paredes sussurravam nomes que não pertenciam a ele.",
      "Um painel acendeu: SUJEITO R-FL17 — FASE 2 ATIVADA. O sistema o chamava pelo nome.",
      "Fim do Capítulo 2."
    ],
    [
      "A sala circular parecia construída fora do tempo; as palavras na parede se moviam para evitar leitura direta.",
      "O candelabro caiu e as chamas desenharam formas que lembravam lembranças que ele não tinha.",
      "A ponte no vazio parecia feita de decisões passadas; cada passo era uma escolha de memória.",
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
    [{ q:"No corredor, três sons: passos, respiração e batida metálica. Qual NÃO pertence?", options:["Passos","Respiração","Batida Metálica"], ans:"Batida Metálica", reward:"Chave do Andar Fantasma" }],
    [{ q:"A sombra imita:", options:["O passado dele","O medo dele","O futuro dele"], ans:"O medo dele", reward:"Símbolo da Revelação" }],
    [{ q:"Qual símbolo revela a ponte como memória?", options:["Sangue","Sombra","Vento"], ans:"Sombra", reward:"Fragmento da Memória Perdida" }],
    [{ q:"Guardião: 'Sou aquilo que você evita; quando me encara, eu me desfaz. O que sou?'", options:["Medo","Silêncio","Mentira"], ans:"Medo", reward:"Coração da Verdade" }]
  ];

  // SAVE KEYS
  const SAVE_KEY = 'sf_final_v1';
  const SLOTS_KEY = 'sf_slots_final_v1';

  // default save
  function createSave(name, age, code){
    return {
      meta:{name:name||'Player', age:age||0, createdAt:now()},
      cred:{code:code||null},
      progress:{chapter:0, part:0},
      inventory: [], // objects: {id,name,desc,qty,usable}
      solved: puzzles.map(ch=>ch.map(()=>false)),
      state:{sanidade:100, medo:0, coragem:50}
    };
  }

  // INVENTORY HELPERS (items relevantes)
  const ITEM_LIBRARY = {
    'chave_andar': {id:'chave_andar', name:'Chave do Andar Fantasma', desc:'Abre uma porta no 5º andar. Útil para evitar loops.', usable:true},
    'simbolo_rev': {id:'simbolo_rev', name:'Símbolo da Revelação', desc:'Revela inscrições ocultas quando usado; reduz medo levemente.', usable:true},
    'fragmento_mem': {id:'fragmento_mem', name:'Fragmento da Memória Perdida', desc:'Recupera uma lembrança que pode restaurar sanidade.', usable:true},
    'coracao_verdade': {id:'coracao_verdade', name:'Coração da Verdade', desc:'Item final. Usado no confronto com a Sentinela.', usable:true},
    'vela': {id:'vela', name:'Vela', desc:'Ilumina textos; consumível.', usable:true},
    'poção': {id:'poção', name:'Poção (sanidade)', desc:'Restaura 20% de sanidade ao usar.', usable:true}
  };

  // STORAGE HELPERS
  function loadLocal(){ return safeParse(localStorage.getItem(SAVE_KEY), null); }
  function persist(save){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }catch(e){ log('Erro salvar: '+e.message); } }
  function loadSlots(){ return safeParse(localStorage.getItem(SLOTS_KEY), [null,null,null,null,null]); }
  function saveSlots(a){ try{ localStorage.setItem(SLOTS_KEY, JSON.stringify(a)); }catch(e){ log('Erro slots: '+e.message);} }

  // UI: inventory render (Resident style)
  function renderInventory(save){
    inventoryGrid.innerHTML = '';
    const inv = (save && Array.isArray(save.inventory)) ? save.inventory : [];
    // ensure 12 slots (3x4)
    const slots = 12;
    for(let i=0;i<slots;i++){
      const cell = document.createElement('div'); cell.className='inv-slot';
      if(inv[i]){
        const it = inv[i];
        cell.innerHTML = `<div class="name">${it.name}</div><div class="qty">x${it.qty||1}</div>`;
        cell.dataset.index = i;
        cell.addEventListener('mouseenter', ()=> showItemDesc(it));
        cell.addEventListener('mouseleave', ()=> hideItemDesc());
        cell.addEventListener('click', ()=> selectSlot(i));
      } else {
        cell.innerHTML = `<div style="opacity:.35">vazio</div>`;
      }
      inventoryGrid.appendChild(cell);
    }
  }
  function showItemDesc(it){ invDesc.textContent = it.desc || 'Sem descrição.'; }
  function hideItemDesc(){ invDesc.textContent = 'Passe o mouse em um item para ver descrição.'; }

  // SELECT / USE / COMBINE
  let selectedSlot = null;
  function selectSlot(i){
    const save = loadLocal(); if(!save) return;
    const it = save.inventory[i];
    if(!it){ selectedSlot = null; invDesc.textContent='Slot vazio.'; return; }
    selectedSlot = i;
    invDesc.textContent = it.desc + (it.qty ? ` (x${it.qty})` : '');
  }
  $('useItem').addEventListener ? $('useItem').addEventListener('click', useSelected) : null;
  $('combineItem').addEventListener ? $('combineItem').addEventListener('click', combineSelected) : null;

  function useSelected(){
    const save = loadLocal(); if(!save) return alert('Sem perfil.');
    if(selectedSlot===null){ return alert('Selecione um item para usar.'); }
    const it = save.inventory[selectedSlot];
    if(!it || !it.usable) return alert('Item não utilizável.');
    // implement usage effects by id
    switch(it.id){
      case 'poção':
        save.state.sanidade = Math.min(100, save.state.sanidade + 20);
        it.qty = (it.qty||1) - 1;
        if(it.qty <= 0) save.inventory[selectedSlot] = null;
        alert('Poção usada — sanidade +20');
        break;
      case 'simbolo_rev':
        // reveals hidden text in story (implementation: reduce medo)
        save.state.medo = Math.max(0, save.state.medo - 10);
        alert('Símbolo usado — medo reduzido.');
        break;
      case 'vela':
        // consumir vela and reveal small hint: restore small sanidade
        save.state.sanidade = Math.min(100, save.state.sanidade + 6);
        it.qty = (it.qty||1) - 1; if(it.qty<=0) save.inventory[selectedSlot]=null;
        alert('Vela acesa — pequena restauração de sanidade.');
        break;
      case 'fragmento_mem':
        // big sanidade restore
        save.state.sanidade = Math.min(100, save.state.sanidade + 30);
        alert('Fragmento integrado — lembrança restaurada.');
        save.inventory[selectedSlot] = null;
        break;
      case 'chave_andar':
        alert('Chave usada em uma porta especial — algo mudou no corredor.');
        // set a flag to unlock special branch
        save.meta.unlocked_floor = true;
        save.inventory[selectedSlot] = null;
        break;
      case 'coracao_verdade':
        alert('Coração empregado — prepara-se para o confronto final.');
        // leave item (final usage handled at boss)
        break;
      default:
        alert('Item usado, mas nada aconteceu.');
    }
    persist(save); renderInventory(save); updateHUD(save.state);
  }

  function combineSelected(){
    const save = loadLocal(); if(!save) return alert('Sem perfil.');
    if(selectedSlot===null) return alert('Selecione um item para combinar (slot A).');
    const a = save.inventory[selectedSlot];
    const targetIndex = prompt('Digite o número do slot para combinar (0 a 11):');
    const bIndex = parseInt(targetIndex,10);
    if(isNaN(bIndex) || bIndex<0 || bIndex>11) return alert('Slot inválido.');
    const b = save.inventory[bIndex];
    if(!b) return alert('Slot alvo vazio.');
    // example: combining vela + fragmento => poção
    if((a.id === 'vela' && b.id === 'fragmento_mem') || (b.id === 'vela' && a.id === 'fragmento_mem')){
      // remove both, add potion
      save.inventory[selectedSlot] = null; save.inventory[bIndex] = null;
      addItemToInventory(save, ITEM_LIBRARY['poção'], 1);
      alert('Você combinou itens e criou uma Poção de Sanidade.');
      persist(save); renderInventory(save); updateHUD(save.state);
      return;
    }
    alert('Combinação não funciona. Nada aconteceu.');
  }

  function addItemToInventory(save, itemTemplate, qty=1){
    // place item in first empty slot or stack if same id exists
    for(let i=0;i<save.inventory.length;i++){
      if(save.inventory[i] && save.inventory[i].id === itemTemplate.id){
        save.inventory[i].qty = (save.inventory[i].qty||1) + qty;
        return true;
      }
    }
    // try to fill empty
    for(let i=0;i<12;i++){
      if(!save.inventory[i]){ save.inventory[i] = { ...itemTemplate, qty: qty }; return true; }
    }
    // if full, push and lose (simple)
    return false;
  }

  // SAVE & SLOTS UI
  function renderSlots(){
    const arr = loadSlots();
    slotsContainer.innerHTML = '';
    arr.forEach((s,i)=>{
      const el = document.createElement('div'); el.style.display='flex'; el.style.justifyContent='space-between'; el.style.alignItems='center'; el.style.gap='6px'; el.style.marginTop='6px';
      el.innerHTML = `<div>${s ? `<strong>Slot ${i+1}</strong> <small style="color:var(--muted)">${s.meta.name}</small>` : `<strong>Slot ${i+1}</strong> <small style="color:var(--muted)">vazio</small>`}</div>`;
      const actions = document.createElement('div');
      const btnS = document.createElement('button'); btnS.className='ghost'; btnS.textContent = s ? 'Sobrescrever' : 'Salvar aqui'; btnS.onclick = ()=> saveToSlot(i);
      const btnL = document.createElement('button'); btnL.className='ghost'; btnL.textContent='Carregar'; btnL.onclick = ()=> loadFromSlot(i);
      const btnD = document.createElement('button'); btnD.className='ghost'; btnD.textContent='Excluir'; btnD.onclick = ()=> { if(confirm('Excluir?')){ const a=loadSlots(); a[i]=null; saveSlots(a); renderSlots(); } };
      actions.appendChild(btnS); actions.appendChild(btnL); actions.appendChild(btnD);
      el.appendChild(actions); slotsContainer.appendChild(el);
    });
  }
  function saveToSlot(i){
    const cur = loadLocal(); if(!cur) return alert('Crie perfil antes de salvar.');
    const arr = loadSlots(); arr[i] = cur; saveSlots(arr); renderSlots(); alert('Salvo no slot '+(i+1));
  }
  function loadFromSlot(i){
    const arr = loadSlots(); if(!arr[i]) return alert('Slot vazio.');
    localStorage.setItem(SAVE_KEY, JSON.stringify(arr[i])); applySave(arr[i]); renderInventory(arr[i]); renderSlots(); alert('Carregado slot '+(i+1));
  }

  // HUD & blood speed mapping
  function updateHUD(state){
    if(!state) return;
    sanVal.textContent = state.sanidade; medoVal.textContent = state.medo; corVal.textContent = state.coragem;
    sanBar.style.width = state.sanidade + '%'; medoBar.style.width = state.medo + '%'; corBar.style.width = state.coragem + '%';
    // blood speed: if medo > 60 make drip faster
    if(state.medo > 70) blood.classList.add('fast'); else blood.classList.remove('fast');
  }

  // change state with effects
  function changeState(delta){
    const save = loadLocal(); if(!save) return;
    const prev = {...save.state};
    save.state.sanidade = Math.max(0, Math.min(100, Math.round((save.state.sanidade||0) + (delta.san||0))));
    save.state.medo = Math.max(0, Math.min(100, Math.round((save.state.medo||0) + (delta.medo||0))));
    save.state.coragem = Math.max(0, Math.min(100, Math.round((save.state.coragem||0) + (delta.cor||0))));
    persist(save);
    // shake when medo increased
    if(save.state.medo > (prev.medo||0)){ document.body.classList.add('shake-effect'); setTimeout(()=>document.body.classList.remove('shake-effect'),360); }
    // hud flash when sanidade dropped
    if(save.state.sanidade < (prev.sanidade||0)){ hud.classList.add('flash'); setTimeout(()=>hud.classList.remove('flash'),900); }
    updateHUD(save.state);
  }

  // story rendering
  function showStory(save){
    const c = save.progress.chapter; const p = save.progress.part;
    $('chapter-title').textContent = `Capítulo ${c+1} • Parte ${p+1}`;
    storyBox.textContent = (chapters[c] && chapters[c][p]) ? chapters[c][p] : '...';
    puzzleBox.style.display = 'none';
    nextBtn.style.display = 'inline-block';
    // small auto-state drift (sanidade decays slightly per part)
    changeState({san:-1});
  }

  // puzzle (1 per chapter)
  function openPuzzle(ch, part){
    const p = puzzles[ch] && puzzles[ch][0]; if(!p) return;
    puzzleBox.innerHTML = '';
    const q = document.createElement('p'); q.textContent = p.q; puzzleBox.appendChild(q);
    const opts = document.createElement('div'); opts.style.display='grid'; opts.style.gap='8px';
    p.options.forEach(opt=>{
      const b = document.createElement('button'); b.className='ghost'; b.textContent=opt;
      b.onclick = ()=> checkPuzzle(opt, ch, 0, p);
      opts.appendChild(b);
    });
    puzzleBox.appendChild(opts); puzzleBox.style.display='block'; nextBtn.style.display='none';
  }

  function checkPuzzle(choice, ch, idx, p){
    const save = loadLocal(); if(!save) return;
    if(choice === p.ans){
      if(!save.solved[ch][idx]){
        addItemToInventory(save, ITEM_LIBRARY[p.reward? p.reward.toLowerCase().replace(/\s+/g,'_') : Object.keys(ITEM_LIBRARY)[0]] || ITEM_LIBRARY['chave_andar'], 1);
        save.solved[ch][idx] = true;
        log('Charada resolvida — ' + (p.reward||'Recompensa'));
        alert('Correto! Você recebeu: ' + (p.reward||'Item'));
        changeState({cor:+8, medo:-6});
      } else {
        alert('Charada já resolvida.');
      }
    } else {
      // wrong -> increase medo, reduce sanidade, trigger screen shake
      changeState({medo:+14, san:-10});
      alert('Errado. O medo sobe e algo treme ao seu redor.');
    }
    persist(save); renderInventory(save); puzzleBox.style.display='none'; nextBtn.style.display='inline-block';
    applySave(save);
  }

  // addItem helper (uses ITEM_LIBRARY by key)
  function addItemToInventory(save, itemTemplate, qty=1){
    if(!save.inventory) save.inventory = [];
    // stack if same id
    for(let i=0;i<save.inventory.length;i++){
      if(save.inventory[i] && save.inventory[i].id === itemTemplate.id){
        save.inventory[i].qty = (save.inventory[i].qty||1) + qty; persist(save); return true;
      }
    }
    // fill first empty slot up to 12
    for(let i=0;i<12;i++){
      if(!save.inventory[i]){ save.inventory[i] = {...itemTemplate, qty: qty}; persist(save); return true; }
    }
    // if no space, try push and lose
    if(save.inventory.length < 20){ save.inventory.push({...itemTemplate, qty: qty}); persist(save); return true; }
    alert('Inventário cheio. Item descartado.');
    return false;
  }

  // NEXT flow
  nextBtn.addEventListener('click', ()=>{
    const save = loadLocal(); if(!save) return alert('Crie um perfil.');
    const ch = save.progress.chapter; const pt = save.progress.part;
    const unsolved = puzzles[ch] && !save.solved[ch][0];
    if(unsolved){ openPuzzle(ch, pt); return; }
    // advance
    if(pt < chapters[ch].length - 1){
      save.progress.part++; persist(save); applySave(save);
      showStory(save);
      log(`Avançou para parte ${save.progress.part+1} do cap ${save.progress.chapter+1}`);
    } else {
      // end of chapter
      if(ch < chapters.length - 1){
        // play cutscene between chapters
        playCutscene([`Você deixou o Capítulo ${ch+1}. Um presságio ecoa...`, `Próximo: Capítulo ${ch+2}`], ()=>{
          save.progress.chapter++; save.progress.part=0; persist(save); applySave(save);
          showStory(save); alert('Capítulo desbloqueado.');
        });
      } else {
        // final end
        playCutscene(['Silêncio. Você deixou algo para trás — e algo ficou com você.'], ()=>{ storyBox.textContent='Fim do jogo.'; nextBtn.style.display='none'; });
      }
    }
  });

  // CUTSCENE
  function playCutscene(lines, cb){
    if(!Array.isArray(lines) || lines.length===0){ if(cb) cb(); return; }
    cutsceneOverlay.classList.add('show'); cutsceneText.textContent = lines[0];
    let i = 0;
    const advance = ()=>{ i++; if(i>=lines.length){ cutsceneOverlay.classList.remove('show'); cutNext.removeEventListener('click', advance); cutSkip.removeEventListener('click', skip); if(cb) cb(); return; } cutsceneText.textContent = lines[i]; };
    const skip = ()=>{ cutsceneOverlay.classList.remove('show'); cutNext.removeEventListener('click', advance); cutSkip.removeEventListener('click', skip); if(cb) cb(); };
    cutNext.addEventListener('click', advance); cutSkip.addEventListener('click', skip);
  }

  // apply save to UI
  function applySave(save){
    if(!save) return;
    renderInventory(save); updateHUD(save.state); showStory(save);
  }

  // quick save/load (slot0)
  quickSave.addEventListener('click', ()=>{
    const save = loadLocal(); if(!save) return alert('Sem perfil.');
    const arr = loadSlots(); arr[0] = save; saveSlots(arr); renderSlots(); alert('Quick saved.');
  });
  quickLoad.addEventListener('click', ()=>{
    const arr = loadSlots(); if(!arr[0]) return alert('Slot rápido vazio.'); localStorage.setItem(SAVE_KEY, JSON.stringify(arr[0])); applySave(arr[0]); alert('Quick loaded.'); 
  });

  // create profile
  btnCreate.addEventListener('click', ()=>{
    const name = playerName.value.trim(); const age = parseInt(playerAge.value,10); const code = playerCode.value.trim();
    if(!name || !age || !code) return alert('Preencha todos os campos.');
    if(age < 15) return alert('Idade mínima: 15 anos.');
    const existing = loadLocal();
    if(existing && existing.meta && (existing.meta.name !== name || (existing.cred && existing.cred.code !== code))){
      if(!confirm('Perfil local diferente existe — sobrescrever?')) return;
    }
    const save = createSave(name, age, code);
    // initial starter items relevant to story
    save.inventory = [ {...ITEM_LIBRARY['vela'], qty:1}, {...ITEM_LIBRARY['chave_andar'], qty:1}, null, null, null, null, null, null, null, null, null, null ];
    persist(save); applySave(save); renderSlots(); log('Perfil criado: '+name);
    playCutscene([`Bem-vindo, ${name}. O prédio observa.`], ()=> alert('Entrada registrada. Boa sorte.'));
  });

  btnClear.addEventListener('click', ()=>{
    if(!confirm('Apagar dados locais?')) return;
    localStorage.removeItem(SAVE_KEY); renderSlots(); inventoryGrid.innerHTML=''; invDesc.textContent='Dados apagados.'; storyBox.textContent='Perfil apagado'; alert('Apagado.');
  });

  // export/import slots
  exportAll.addEventListener('click', ()=>{
    const b = new Blob([JSON.stringify(loadSlots(),null,2)],{type:'application/json'}); const u=URL.createObjectURL(b);
    const a = document.createElement('a'); a.href=u; a.download = `sombra_saves_${new Date().toISOString()}.json`; a.click(); URL.revokeObjectURL(u); log('Export ok');
  });
  importAll.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', e=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ev=>{ try{ const parsed = JSON.parse(ev.target.result); if(!Array.isArray(parsed)) throw new Error('Formato inválido'); while(parsed.length<5) parsed.push(null); saveSlots(parsed.slice(0,5)); renderSlots(); alert('Import ok'); }catch(err){ alert('Falha import: '+err.message);} };
    r.readAsText(f); e.target.value='';
  });

  // render initial slots and load if exists
  function renderSlots(){ const arr = loadSlots(); if(!Array.isArray(arr)){ saveSlots([null,null,null,null,null]); } const current = loadSlots(); slotsContainer.innerHTML=''; current.forEach((s,i)=>{ const el = document.createElement('div'); el.style.display='flex'; el.style.justifyContent='space-between'; el.style.alignItems='center'; el.style.gap='6px'; el.style.marginTop='6px'; el.innerHTML = `<div>${s ? `<strong>Slot ${i+1}</strong> <small style="color:var(--muted)">${s.meta.name}</small>` : `<strong>Slot ${i+1}</strong> <small style="color:var(--muted)">vazio</small>`}</div>`; const actions = document.createElement('div'); const bS=document.createElement('button'); bS.className='ghost'; bS.textContent=s?'Sobrescrever':'Salvar aqui'; bS.onclick=()=>saveToSlot(i); const bL=document.createElement('button'); bL.className='ghost'; bL.textContent='Carregar'; bL.onclick=()=>loadFromSlot(i); const bD=document.createElement('button'); bD.className='ghost'; bD.textContent='Excluir'; bD.onclick=()=>{ if(confirm('Excluir?')){ const a=loadSlots(); a[i]=null; saveSlots(a); renderSlots(); } }; actions.appendChild(bS); actions.appendChild(bL); actions.appendChild(bD); el.appendChild(actions); slotsContainer.appendChild(el); }); }
  function saveToSlot(i){ const s=loadLocal(); if(!s) return alert('Sem perfil.'); const a=loadSlots(); a[i]=s; saveSlots(a); renderSlots(); alert('Salvo slot '+(i+1)); }
  function loadFromSlot(i){ const a=loadSlots(); if(!a[i]) return alert('Slot vazio.'); localStorage.setItem(SAVE_KEY, JSON.stringify(a[i])); applySave(a[i]); renderInventory(a[i]); renderSlots(); alert('Carregado slot '+(i+1)); }

  // theme toggle
  themeToggle.addEventListener('click', ()=> document.body.classList.toggle('light'));

  // helpers to map item reward name to ITEM_LIBRARY key
  function getItemByRewardName(name){
    if(!name) return ITEM_LIBRARY['chave_andar'];
    const key = name.toLowerCase().replace(/\s+/g,'_');
    return ITEM_LIBRARY[key] || ITEM_LIBRARY['chave_andar'];
  }

  // final apply function
  function applySave(save){
    if(!save) return;
    renderInventory(save); updateHUD(save.state); showStory(save);
  }

  // updateHUD uses earlier function updateHUD
  function updateHUD(state){ sanVal.textContent=state.sanidade; medoVal.textContent=state.medo; corVal.textContent=state.coragem; sanBar.style.width=state.sanidade+'%'; medoBar.style.width=state.medo+'%'; corBar.style.width=state.coragem+'%'; if(state.medo>70) blood.classList.add('fast'); else blood.classList.remove('fast'); }

  // init
  (function init(){
    if(!Array.isArray(loadSlots())) saveSlots([null,null,null,null,null]);
    renderSlots();
    const existing = loadLocal();
    if(existing){ applySave(existing); log('Perfil carregado do local'); } else { storyBox.textContent='Crie um perfil à esquerda.'; }
    // expose small debug
    window.SombraFinal = { loadLocal, persist, loadSlots, saveSlots, ITEM_LIBRARY };
  })();

})();
