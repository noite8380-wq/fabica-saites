// ELEMENTOS
const formSection = document.getElementById("form-section");
const contractSection = document.getElementById("contract-section");
const gameSection = document.getElementById("game-section");
const invList = document.getElementById("inv-list");
const storyBox = document.getElementById("story-box");
const puzzleBox = document.getElementById("puzzle-box");
const nextBtn = document.getElementById("next-btn");

// FUNÇÕES BÁSICAS
function toggleTheme() { document.body.classList.toggle("light"); }

function saveForm() {
    const name = document.getElementById("playerName").value.trim();
    const age = parseInt(document.getElementById("playerAge").value);
    const code = document.getElementById("playerCode").value.trim();
    if (!name || !age || !code) { alert("Preencha todos os campos."); return; }
    if (age < 16) { alert("Você precisa ter 15 anos ou mais."); return; }
    localStorage.setItem("sf_user", JSON.stringify({
        name, age, code, progress: { chapter: 0, part: 0, puzzle: 0 }, inventory: [], state: { medo: 0, coragem: 50, sanidade: 100 }
    }));
    formSection.style.display = "none";
    contractSection.style.display = "block";
}

function acceptContract() {
    contractSection.style.display = "none";
    gameSection.style.display = "block";
    startGame();
}

// HISTÓRIA E PUZZLES
const chapters = [
    // CAPÍTULO 1
    [
        "O silêncio após a ligação parecia vivo. Rafael sentia-o se mover dentro do corredor...",
        "O telefone tocou novamente. Desta vez atrás dele.",
        "Rafael correu para a escada de emergência e percebeu o loop do 5º andar...",
        "Fim do Capítulo 1."
    ],
    // CAPÍTULO 2
    [
        "A sombra no chão não o imitava. Ela respirava e aproximava-se...",
        "O chão tremia sob ele, passos vindos do interior da sala...",
        "Agora diziam: SUJEITO R-FL17 — FASE 2 ATIVADA...",
        "Fim do Capítulo 2."
    ],
    // CAPÍTULO 3
    [
        "A sala circular onde Arthon, Laelynn e o grupo estavam parecia não ter portas...",
        "Uma rachadura se abriu no teto, um candelabro caiu iluminando o ambiente...",
        "O caminho levou a uma ponte sobre um abismo infinito...",
        "Fim do Capítulo 3."
    ]
];

const puzzles = [
    // CAP 1 - 4 puzzles
    [
        { q: "Escolha a runa correta:", options: ["🔥 Fogo", "🩸 Sangue", "🌑 Sombra"], ans: "🩸 Sangue", reward: "Chave Arcana" },
        { q: "Qual o código do elevador?", options: ["1313", "2525", "4444"], ans: "1313", reward: "Cartão de Acesso" },
        { q: "Escolha a porta certa:", options: ["Esquerda", "Direita", "Centro"], ans: "Centro", reward: "Mapa da Escada" },
        { q: "Qual objeto Rafael deve pegar?", options: ["Celular", "Chave", "Lanterna"], ans: "Celular", reward: "Registro da Ligação" }
    ],
    // CAP 2 - 4 puzzles
    [
        { q: "Qual a primeira palavra do diário?", options: ["Segredo", "Medo", "Sombra"], ans: "Segredo", reward: "Medalhão do Sussurro" },
        { q: "Escolha o símbolo certo:", options: ["⚡ Raio", "🌑 Sombra", "🔥 Fogo"], ans: "🌑 Sombra", reward: "Amuleto do Vento" },
        { q: "Qual parede olhar?", options: ["Norte", "Sul", "Leste"], ans: "Norte", reward: "Chave de Ferro" },
        { q: "Qual é o padrão de passos?", options: ["Frente", "Inverso", "Circular"], ans: "Inverso", reward: "Tomo da Névoa" }
    ],
    // CAP 3 - 4 puzzles
    [
        { q: "Qual figura observar primeiro?", options: ["Encapuzada", "Mão", "Ponte"], ans: "Encapuzada", reward: "Tomos da Realidade" },
        { q: "Qual símbolo acender?", options: ["🩸 Sangue", "🌑 Sombra", "🔥 Fogo"], ans: "🩸 Sangue", reward: "Orbe da Memória" },
        { q: "Escolha o caminho na ponte:", options: ["Direita", "Esquerda", "Centro"], ans: "Centro", reward: "Chave do Labirinto" },
        { q: "Qual item pegar antes de avançar?", options: ["Candelabro", "Tomo", "Símbolo"], ans: "Tomo", reward: "Fragmento de Eco" }
    ]
];

let currentChapter = 0, currentPart = 0, currentPuzzle = 0;

// INICIAR JOGO
function startGame() {
    const saved = JSON.parse(localStorage.getItem("sf_user"));
    currentChapter = saved.progress.chapter;
    currentPart = saved.progress.part;
    currentPuzzle = saved.progress.puzzle;
    showStory();
    updateInventory();
}

// INVENTÁRIO
function updateInventory() {
    const saved = JSON.parse(localStorage.getItem("sf_user"));
    invList.innerText = saved.inventory.join(", ") || "vazio";
}

// MOSTRAR HISTÓRIA
function showStory() {
    storyBox.innerHTML = chapters[currentChapter][currentPart];
    puzzleBox.style.display = "none";
    nextBtn.style.display = "inline-block";
}

// CARREGAR PUZZLE
function loadPuzzle() {
    const p = puzzles[currentChapter][currentPuzzle];
    puzzleBox.style.display = "block";
    puzzleBox.innerHTML = `<h2>Puzzle</h2><p>${p.q}</p>`;
    p.options.forEach(opt => {
        const btn = document.createElement("button");
        btn.innerText = opt;
        btn.onclick = () => checkPuzzle(opt, p);
        puzzleBox.appendChild(btn);
    });
    nextBtn.style.display = "none";
}

// CHECAR PUZZLE
function checkPuzzle(choice, p) {
    const saved = JSON.parse(localStorage.getItem("sf_user"));
    if (choice === p.ans) {
        saved.inventory.push(p.reward);
        alert("Acertou! Item: " + p.reward);
        currentPuzzle++;
    } else {
        alert("Errado! Tente de novo mais tarde.");
    }
    saved.progress = { chapter: currentChapter, part: currentPart, puzzle: currentPuzzle };
    localStorage.setItem("sf_user", JSON.stringify(saved));
    updateInventory();
    showStory();
}

// AVANÇAR HISTÓRIA
function nextPart() {
    const saved = JSON.parse(localStorage.getItem("sf_user"));
    if (currentPuzzle < puzzles[currentChapter].length) { loadPuzzle(); return; }
    if (currentPart < chapters[currentChapter].length - 1) { currentPart++; currentPuzzle = 0; }
    else if (currentChapter < chapters.length - 1) { currentChapter++; currentPart = 0; currentPuzzle = 0; alert("Capítulo desbloqueado!"); }
    else { storyBox.innerHTML = "Fim do jogo."; nextBtn.style.display = "none"; puzzleBox.style.display = "none"; return; }
    saved.progress = { chapter: currentChapter, part: currentPart, puzzle: currentPuzzle };
    localStorage.setItem("sf_user", JSON.stringify(saved));
    showStory();
}

// CARREGAMENTO INICIAL
window.onload = () => {
    const saved = localStorage.getItem("sf_user");
    if (saved) {
        formSection.style.display = "none";
        contractSection.style.display = "none";
        gameSection.style.display = "block";
        startGame();
    } else { formSection.style.display = "block"; }
}