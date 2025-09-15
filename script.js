
   (() => {
    // -------------------------
    // Configuração de Níveis
    // -------------------------
    const LEVELS = [
      // level, grid, tempo(s), spawn(ms), meta de pontos
      { level: 1, grid: 3, time: 60, spawn: 1200, target: 120 },
      { level: 2, grid: 3, time: 55, spawn: 1000, target: 260 },
      { level: 3, grid: 4, time: 55, spawn: 900,  target: 420 },
      { level: 4, grid: 4, time: 50, spawn: 800,  target: 600 },
      { level: 5, grid: 5, time: 50, spawn: 700,  target: 820 },
    ];
  
    // -------------------------
    // Estado do Jogo
    // -------------------------
    const state = {
      isRunning: false,
      levelIndex: 0,
      score: 0,
      timeLeft: 0,
      waste: 0, // 0..100
      leakTicker: null,
      secondTicker: null,
      boardMap: new Map(), // id -> {el, faucetEl, open, since}
      playerName: "",
    };
  
    // -------------------------
    // DOM
    // -------------------------
    const boardEl = document.getElementById("board");
    const levelEl = document.getElementById("level");
    const scoreEl = document.getElementById("score");
    const timeEl = document.getElementById("time");
    const wasteBarEl = document.getElementById("wasteBar");
  
    const btnStart = document.getElementById("startBtn");
    const btnRestart = document.getElementById("restartBtn");
    const btnHowto = document.getElementById("howtoBtn");
  
    const howtoModal = document.getElementById("howtoModal");
    const closeHowto = document.getElementById("closeHowto");
  
    const levelUpModal = document.getElementById("levelUpModal");
    const nextLevelBtn = document.getElementById("nextLevelBtn");
  
    const gameOverModal = document.getElementById("gameOverModal");
    const finalStats = document.getElementById("finalStats");
    const playAgainBtn = document.getElementById("playAgainBtn");
    const closeGameOverBtn = document.getElementById("closeGameOver");
  
    const nameForm = document.getElementById("nameForm");
    const nameInput = document.getElementById("playerName");
    const leaderboardBody = document.getElementById("leaderboard");
    const clearLbBtn = document.getElementById("clearLbBtn");
  
    // -------------------------
    // Ranking (localStorage)
    // -------------------------
    const LB_KEY = "salveAguaLeaderboard";
  
    function loadLeaderboard() {
      try {
        return JSON.parse(localStorage.getItem(LB_KEY) || "[]");
      } catch {
        return [];
      }
    }
  
    function saveLeaderboard(list) {
      localStorage.setItem(LB_KEY, JSON.stringify(list));
    }
  
    function addToLeaderboard(name, score, level) {
      const list = loadLeaderboard();
      list.push({ name: name || "Jogador", score, level, ts: Date.now() });
      list.sort((a, b) => b.score - a.score || a.ts - b.ts);
      saveLeaderboard(list.slice(0, 15)); // top 15
      renderLeaderboard();
    }
  
    function renderLeaderboard() {
      const rows = loadLeaderboard()
        .slice(0, 15)
        .map((row, i) =>
          `<tr>
            <td>${i + 1}</td>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.score}</td>
            <td>${row.level}</td>
          </tr>`
        )
        .join("");
      leaderboardBody.innerHTML =
        rows || `<tr><td colspan="4">Ainda sem pontuações. Jogue para entrar no ranking!</td></tr>`;
    }
  
    function escapeHtml(s = "") {
      return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m]));
    }
  
    nameForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.playerName = (nameInput.value || "").trim().slice(0, 20);
    });
  
    clearLbBtn.addEventListener("click", () => {
      if (confirm("Deseja limpar o ranking?")) {
        saveLeaderboard([]);
        renderLeaderboard();
      }
    });
  
    // -------------------------
    // Inicialização do Tabuleiro
    // -------------------------
    function buildBoard(grid) {
      boardEl.innerHTML = "";
      boardEl.style.gridTemplateColumns = `repeat(${grid}, 1fr)`;
      state.boardMap.clear();
  
      const total = grid * grid;
      for (let i = 0; i < total; i++) {
        const tile = document.createElement("button");
        tile.className = "tile";
        tile.setAttribute("role", "gridcell");
        tile.setAttribute("aria-label", "Torneira");
        tile.dataset.id = String(i);
  
        // Zona clicável (para acessibilidade/touch)
        const tapzone = document.createElement("span");
        tapzone.className = "tapzone";
        tile.appendChild(tapzone);
  
        // --- TORNEIRA ---
       const faucet = document.createElement("div");
faucet.className = "faucet closed";
faucet.innerHTML = `
  <svg viewBox="0 0 240 160" aria-hidden="true">
    <defs>
      <!-- Cores simples estilo cartoon -->
      <style>
        .outline { stroke:#1f3d45; stroke-width:3; stroke-linejoin:round; stroke-linecap:round; }
      </style>
      <linearGradient id="waterGrad" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#82d1ff"/>
        <stop offset="100%" stop-color="rgba(130,209,255,.12)"/>
      </linearGradient>
    </defs>

    <!-- flange -->
    <circle cx="28" cy="80" r="16" fill="#dfe5ea" class="outline"/>

    <!-- tubo até corpo -->
    <rect x="36" y="72" width="52" height="16" rx="8" fill="#e8ecef" class="outline"/>

    <!-- corpo cilíndrico -->
    <rect x="92" y="56" width="52" height="52" rx="10" fill="#e8ecef" class="outline"/>

    <!-- cruzeta (registro) -->
    <g class="handle">
      <circle cx="120" cy="42" r="6" fill="#b8c4ca" class="outline"/>
      <rect x="102" y="38" width="36" height="8" rx="4" fill="#d4f7ef" class="outline"/>
      <rect x="116" y="26" width="8"  height="28" rx="4" fill="#d4f7ef" class="outline"/>
      <circle cx="102" cy="42" r="5" fill="#c9fff1" class="outline"/>
      <circle cx="138" cy="42" r="5" fill="#c9fff1" class="outline"/>
      <circle cx="120" cy="26" r="5" fill="#c9fff1" class="outline"/>
      <circle cx="120" cy="54" r="5" fill="#c9fff1" class="outline"/>
    </g>

    <!-- pescoço do bico -->
    <rect x="144" y="72" width="22" height="16" rx="8" fill="#e8ecef" class="outline"/>

    <!-- curva do bico (traço grosso sem outline para ficar simples) -->
    <path d="M166,80 C202,80 198,116 186,116"
          fill="none" stroke="#e8ecef" stroke-width="16" stroke-linecap="round"/>

    <!-- anel + bico -->
    <ellipse cx="188" cy="117" rx="13" ry="8" fill="#e8ecef" class="outline"/>
    <rect x="184" y="116" width="8" height="18" rx="3" fill="#e8ecef" class="outline"/>

    <!-- água -->
    <g class="water">
      <rect x="188" y="134" width="12" height="24" rx="6" fill="url(#waterGrad)"/>
    </g>
    <circle class="drop" cx="194" cy="134" r="5" fill="#82d1ff"/>
  </svg>
`;
tile.appendChild(faucet);
  
        // Eventos
        tile.addEventListener("click", onTileClick);
        tile.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            tile.click();
          }
        });
  
        boardEl.appendChild(tile);
  
        state.boardMap.set(String(i), {
          el: tile,
          faucetEl: faucet,
          open: false,
          since: 0,
        });
      }
    }
  
    // -------------------------
    // Lógica de Jogo
    // -------------------------
    function startGame() {
      state.isRunning = true;
      btnStart.disabled = true;
      btnRestart.disabled = false;
  
      const cfg = LEVELS[state.levelIndex];
      state.timeLeft = cfg.time;
      updateHud();
  
      buildBoard(cfg.grid);
      startTickers();
    }
  
    function startTickers() {
      stopTickers();
  
      const cfg = LEVELS[state.levelIndex];
  
      // Abre torneiras aleatoriamente
      state.leakTicker = setInterval(spawnLeak, cfg.spawn);
  
      // Relógio + acúmulo de desperdício
      state.secondTicker = setInterval(() => {
        if (!state.isRunning) return;
  
        state.timeLeft--;
  
        // desperdício: sobe por torneira aberta
        const openCount = getOpenTiles().length;
        increaseWaste(openCount * 2); // ajuste de dificuldade
  
        if (state.timeLeft <= 0) {
          const need = cfg.target;
          if (state.score >= need) {
            // sobe de nível
            state.levelIndex++;
            if (state.levelIndex >= LEVELS.length) {
              // vitória total
              gameOver(true);
            } else {
              stopTickers();
              levelUpModal.showModal();
            }
          } else {
            gameOver(false);
          }
        }
  
        updateHud();
      }, 1000);
    }
  
    function stopTickers() {
      if (state.leakTicker) clearInterval(state.leakTicker);
      if (state.secondTicker) clearInterval(state.secondTicker);
      state.leakTicker = null;
      state.secondTicker = null;
    }
  
    function spawnLeak() {
      const closed = getClosedTiles();
      if (closed.length === 0) return;
  
      const idx = Math.floor(Math.random() * closed.length);
      const cell = closed[idx];
      setOpen(cell, true);
    }
  
    function getOpenTiles() {
      return [...state.boardMap.values()].filter((c) => c.open);
    }
    function getClosedTiles() {
      return [...state.boardMap.values()].filter((c) => !c.open);
    }
  
    function setOpen(cell, open) {
      cell.open = open;
      cell.since = open ? performance.now() : 0;
      cell.faucetEl.classList.toggle("open", open);
      cell.faucetEl.classList.toggle("closed", !open);
      cell.el.setAttribute("aria-label", open ? "Torneira aberta" : "Torneira fechada");
    }
  
    function onTileClick(ev) {
      if (!state.isRunning) return;
  
      const id = ev.currentTarget.dataset.id;
      const cell = state.boardMap.get(id);
      if (!cell) return;
  
      if (cell.open) {
        // fechar com pontuação baseada no tempo de reação
        const now = performance.now();
        const reaction = now - (cell.since || now);
        const lvl = LEVELS[state.levelIndex].level;
  
        const base = 10 + lvl * 2;
        const speedBonus = Math.max(0, Math.floor((600 - reaction) / 60)); // até +10
        const points = Math.max(1, base + speedBonus);
  
        state.score += points;
  
        // recompensa: reduz desperdício ao fechar rápido
        decreaseWaste(5 + Math.min(10, speedBonus));
  
        setOpen(cell, false);
        updateHud();
        pulseScore();
      }
    }
  
    function pulseScore() {
      scoreEl.style.transition = "transform .12s ease";
      scoreEl.style.transform = "scale(1.12)";
      setTimeout(() => {
        scoreEl.style.transform = "scale(1)";
      }, 120);
    }
  
    function increaseWaste(amount) {
      state.waste = Math.min(100, state.waste + amount);
      renderWaste();
      if (state.waste >= 100) {
        gameOver(false);
      }
    }
  
    function decreaseWaste(amount) {
      state.waste = Math.max(0, state.waste - amount);
      renderWaste();
    }
  
    function renderWaste() {
      wasteBarEl.style.width = `${state.waste}%`;
    }
  
    function updateHud() {
      levelEl.textContent = LEVELS[state.levelIndex].level;
      scoreEl.textContent = state.score;
      timeEl.textContent = state.timeLeft;
    }
  
    function resetState() {
      stopTickers();
      state.isRunning = false;
      state.waste = 0;
      renderWaste();
  
      updateHud();
  
      btnStart.disabled = false;
      btnRestart.disabled = true;
    }
  
    // -------------------------
    // Fluxos de Nível / Game Over
    // -------------------------
    nextLevelBtn.addEventListener("click", () => {
      levelUpModal.close();
      startGame();
    });
  
    function gameOver(victoryAll) {
      if (!state.isRunning) return;
  
      stopTickers();
      state.isRunning = false;
  
      // fechar todas as torneiras
      for (const cell of state.boardMap.values()) setOpen(cell, false);
  
      const reached = LEVELS[Math.min(state.levelIndex, LEVELS.length - 1)].level;
      const msg = victoryAll
        ? `Você completou todos os níveis! Pontos: ${state.score}.`
        : `Fim de jogo. Nível alcançado: ${reached}. Pontos: ${state.score}.`;
  
      finalStats.textContent = msg;
      gameOverModal.showModal();
  
      // salva ranking
      addToLeaderboard(state.playerName || nameInput.value, state.score, reached);
  
      btnStart.disabled = false;
      btnRestart.disabled = false;
    }
  
    playAgainBtn.addEventListener("click", () => {
      gameOverModal.close();
      // reinício completo
      state.levelIndex = 0;
      state.score = 0;
      state.waste = 0;
      renderWaste();
      startGame();
    });
  
    closeGameOverBtn.addEventListener("click", () => {
      gameOverModal.close();
    });
  
    // -------------------------
    // Controles
    // -------------------------
    btnStart.addEventListener("click", () => {
      state.levelIndex = 0;
      state.score = 0;
      state.waste = 0;
      renderWaste();
      startGame();
    });
  
    btnRestart.addEventListener("click", () => {
      resetState();
      state.score = 0;
      state.waste = 0;
      renderWaste();
      startGame();
    });
  
    btnHowto.addEventListener("click", () => {
      howtoModal.showModal();
    });
    closeHowto.addEventListener("click", () => howtoModal.close());
  
    // -------------------------
    // Boot
    // -------------------------
    function boot() {
      state.levelIndex = 0;
      state.score = 0;
      state.waste = 0;
      renderWaste();
      buildBoard(LEVELS[0].grid);
      updateHud();
      renderLeaderboard();
  
      boardEl.setAttribute("tabindex", "0"); // acessibilidade
    }
  
    boot();
  })();