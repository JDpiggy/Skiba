// --- START CONSTANTS ---
const C = {
    GAME_WIDTH: 1000,
    GAME_HEIGHT: 1500,
    SKIER_WIDTH: 20,
    SKIER_HEIGHT: 30,
    SKIER_INITIAL_Y: 50,
    SKIER_HORIZONTAL_SPEED: 4,
    SKIER_DRIFT_SPEED: 1,
    SKIER_VERTICAL_SPEED_BOOST: 0.2,
    SKIER_VERTICAL_SPRING_FORCE: 0.01,
    SKIER_VERTICAL_MAX_OFFSET: 20,
    GAME_SPEED: 3.5,
    OBSTACLE_DENSITY: 0.003,
    OBSTACLE_MIN_SIZE: 25,
    OBSTACLE_MAX_SIZE: 50,
    POWERUP_SPAWN_CHANCE: 0.0005,
    POWERUP_SIZE: 30,
    POWERUP_COLOR: '#67e8f9',
    POWERUP_BUMP_VELOCITY: 30,
    POWERUP_BUMP_DURATION: 8,
    YETI_SPAWN_CHANCE: 0.001,
    YETI_WIDTH: 40,
    YETI_HEIGHT: 50,
    YETI_SPEED: 5,
    YETI_PUSH_VELOCITY: 25,
    YETI_PUSH_DURATION: 10,
    MAX_PARTICLES: 300,
    PLAYER_CONFIGS: [
        { color: '#ef4444', name: 'Red', readyKey: 'w', controlKey: 'w' },
        { color: '#3b82f6', name: 'Blue', readyKey: 'i', controlKey: 'i' },
        { color: '#22c55e', name: 'Green', readyKey: 'z', controlKey: 'z' },
        { color: '#eab308', name: 'Yellow', readyKey: 'm', controlKey: 'm' },
    ],
    GAME_TIPS: [
        "You can tell who the Yeti is targeting by its eye color.",
        "The bump power-up is only good for one use, so make it count!",
        "Skiing off the edge of the screen will end your run.",
        "All skiers have a constant rightward drift. Tap your key to steer left!",
        "Use the vertical 'wobble' to get a better position on your opponents.",
    ],
};

const GameState = {
    PlayerSelect: 'PLAYER_SELECT',
    Playing: 'PLAYING',
    GameOver: 'GAME_OVER',
};

const SkierDirection = {
    Left: 'LEFT',
    Right: 'RIGHT',
    Straight: 'STRAIGHT',
    Crashed: 'CRASHED',
};

const ObstacleType = {
    Tree: 'TREE',
    Rock: 'ROCK',
};
// --- END CONSTANTS ---

// --- STATE MANAGEMENT ---
let gameState = GameState.PlayerSelect;
let playerCount = 1;
let players = [];
let obstacles = [];
let particles = [];
let powerUps = [];
let yeti = null;
let isReadyUpPhase = true;
let score = 0;
let finalScore = 0;
let winner = null;
let gameLoopId = null;
const keysPressed = {};
let frameCount = 0;
let particleIdCounter = 0;
let lastTipIndex = -1;

// --- DOM ELEMENTS ---
const app = document.getElementById('app');
let gameContainer, gameElementsContainer, footerElement;
const entityElements = new Map(); // Maps entity ID to DOM element

// --- HELPER FUNCTIONS ---
// Fix: Add explicit types to the E function to handle string or array inputs for classList and children, resolving multiple TypeScript errors.
function E(tag: string, classList: string | string[] = [], children: string | Node[] = [], styles: Partial<CSSStyleDeclaration> = {}, attributes: Record<string, any> = {}): HTMLElement {
    const el = document.createElement(tag);
    const classes = typeof classList === 'string' ? classList.split(' ') : classList;
    el.classList.add(...classes.filter(c => c));
    if (typeof children === 'string') {
        el.textContent = children;
    } else {
        children.forEach(child => el.appendChild(child));
    }
    Object.assign(el.style, styles);
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

function clearApp() {
    app.innerHTML = '';
}

// --- UI COMPONENTS & SCREENS ---
function createFooter(tip) {
    footerElement = E('footer', 'absolute bottom-2 left-1/2 -translate-x-1/2 text-center p-2 px-4 bg-slate-900/50 text-white rounded-lg text-sm z-20 pointer-events-none w-11/12 max-w-2xl', [
        E('p', [], [
            E('span', 'font-bold', 'Tip: '),
            document.createTextNode(tip)
        ])
    ]);
    app.appendChild(footerElement);
}

function updateFooterTip() {
    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * C.GAME_TIPS.length);
    } while (C.GAME_TIPS.length > 1 && newIndex === lastTipIndex);
    lastTipIndex = newIndex;
    if (footerElement) {
        footerElement.querySelector('p').innerHTML = '';
        footerElement.querySelector('p').appendChild(E('span', 'font-bold', 'Tip: '));
        footerElement.querySelector('p').appendChild(document.createTextNode(C.GAME_TIPS[newIndex]));
    } else {
        createFooter(C.GAME_TIPS[newIndex]);
    }
}

function createPlayerSelectScreen() {
    const buttons = [1, 2, 3, 4].map((count, index) => {
        const btn = E('button', 'text-white font-bold text-xl py-6 px-4 rounded-lg shadow-lg transform transition-all duration-200 ease-in-out hover:scale-105 focus:outline-none focus:ring-4', `${count} Player${count > 1 ? 's' : ''}`, {
            backgroundColor: C.PLAYER_CONFIGS[index].color,
            borderColor: C.PLAYER_CONFIGS[index].color
        });
        btn.onclick = () => selectPlayers(count);
        return btn;
    });

    const screen = E('div', 'w-full h-full flex items-center justify-center bg-slate-50 p-4', [
        E('div', 'bg-white p-8 rounded-2xl shadow-2xl text-center w-full max-w-md border-t-4 border-blue-500', [
            E('h1', 'text-5xl font-extrabold text-slate-800 mb-2 tracking-tight', "Jaron's Skifree Battle"),
            E('p', 'text-slate-500 mb-8', 'Select number of players:'),
            E('div', 'grid grid-cols-2 gap-4', buttons),
        ]),
    ]);
    clearApp();
    app.appendChild(screen);
    updateFooterTip();
}

function createGameOverScreen() {
    const winnerColorName = winner ? C.PLAYER_CONFIGS.find(p => p.color === winner.color)?.name || 'Player' : '';
    const title = winner
        ? E('h2', 'text-5xl font-extrabold mb-2', `${winnerColorName} Wins!`, { color: winner.color })
        : E('h2', 'text-5xl font-extrabold text-red-600 mb-2', 'Game Over');

    const playAgainBtn = E('button', 'bg-blue-600 text-white font-bold text-xl py-3 px-8 rounded-lg shadow-lg hover:bg-blue-700 active:bg-blue-800 transform transition-all duration-200 ease-in-out hover:scale-105 focus:outline-none focus:ring-4 focus:ring-blue-300', 'Play Again');
    playAgainBtn.onclick = restartGame;
    
    const changePlayersBtn = E('button', 'text-sm text-slate-500 hover:text-slate-700 underline', 'Change Players');
    changePlayersBtn.onclick = changePlayers;

    const screen = E('div', 'w-full h-full flex items-center justify-center bg-slate-50/80 backdrop-blur-sm p-4', [
        E('div', 'bg-white p-8 rounded-2xl shadow-2xl text-center w-full max-w-md border-t-4 border-blue-500', [
            title,
            E('p', 'text-slate-500 mb-4 text-lg', winner ? 'The last skier standing!' : 'You wiped out!'),
            E('div', 'text-center bg-slate-100 p-4 rounded-lg mb-8', [
                E('p', 'text-slate-500 text-sm font-medium', 'FINAL DISTANCE'),
                E('p', 'text-6xl font-bold text-slate-800', `${finalScore}m`),
            ]),
            E('div', 'flex items-center justify-center gap-6', [
                playAgainBtn,
                changePlayersBtn
            ]),
        ]),
    ]);
    clearApp();
    app.appendChild(screen);
    app.appendChild(footerElement);
}

// --- GAME LOGIC & RENDERING ---
function createGameScreen() {
    clearApp();
    gameContainer = E('div', 'w-full h-full bg-white overflow-hidden relative');
    gameElementsContainer = E('div', 'absolute top-0 left-0', [], {
        width: `${C.GAME_WIDTH}px`,
        height: `${C.GAME_HEIGHT}px`,
        transformOrigin: 'top left',
    });
    const scoreDisplay = E('div', 'absolute top-4 right-4 bg-slate-900/70 text-white font-bold text-2xl p-2 px-4 rounded-lg z-10', `DISTANCE: ${score}m`);
    scoreDisplay.id = 'score-display';
    
    gameContainer.append(scoreDisplay, gameElementsContainer);
    app.appendChild(gameContainer);
    app.appendChild(footerElement);
    
    window.addEventListener('resize', updateGameTransform);
    updateGameTransform();
}

function updateGameTransform() {
    if (gameContainer && gameElementsContainer) {
        const containerWidth = gameContainer.offsetWidth;
        const containerHeight = gameContainer.offsetHeight;
        const scale = containerWidth / C.GAME_WIDTH;
        const skierCenterY = C.SKIER_INITIAL_Y + C.SKIER_HEIGHT / 2;
        const targetSkierScreenY = containerHeight * 0.3;
        const translateY_px = targetSkierScreenY - skierCenterY * scale;
        gameElementsContainer.style.transform = `scale(${scale}) translateY(${translateY_px}px)`;
    }
}

function getCameraData() {
    if(!gameContainer) return { scale: 1, translateY_px: 0, gameYTop: 0 };
    const transform = gameElementsContainer.style.transform;
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    const translateYMatch = transform.match(/translateY\(([^p]+)px\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;
    const translateY_px = translateYMatch ? parseFloat(translateYMatch[1]) : 0;
    const gameYTop = scale > 0 ? -translateY_px / scale : 0;
    return { scale, translateY_px, gameYTop };
}

function render() {
    if (!gameElementsContainer) return;
    
    const allEntities = [...players, ...obstacles, ...particles, ...powerUps, yeti].filter(Boolean);
    const renderedIds = new Set();
    
    // Update or create elements
    allEntities.forEach(entity => {
        let el = entityElements.get(entity.id);
        if (!el) {
            el = createEntityElement(entity);
            entityElements.set(entity.id, el);
            gameElementsContainer.appendChild(el);
        }
        updateEntityElement(el, entity);
        renderedIds.add(entity.id);
    });

    // Remove old elements
    entityElements.forEach((el, id) => {
        if (!renderedIds.has(id)) {
            el.remove();
            entityElements.delete(id);
        }
    });
    
    // Update score
    const scoreDisplay = document.getElementById('score-display');
    if (scoreDisplay) scoreDisplay.textContent = `DISTANCE: ${Math.floor(score / 10)}m`;

    // Update ready-up UI
    if (gameState === GameState.Playing && isReadyUpPhase) {
        let readyUpOverlay = document.getElementById('ready-up-overlay');
        if (!readyUpOverlay) {
            readyUpOverlay = createReadyUpOverlay();
            gameContainer.appendChild(readyUpOverlay);
        }
        updateReadyUpOverlay(readyUpOverlay);
    } else {
        const readyUpOverlay = document.getElementById('ready-up-overlay');
        if (readyUpOverlay) readyUpOverlay.remove();
    }
}

function createEntityElement(entity) {
    if (entity.hasOwnProperty('isAlive')) return E('div', 'absolute'); // Skier
    if (entity.hasOwnProperty('type')) return E('div', 'absolute'); // Obstacle
    if (entity.hasOwnProperty('opacity')) return E('div', 'absolute bg-slate-300 rounded-full'); // Particle
    if (entity.hasOwnProperty('targetPlayerId')) return E('div', 'absolute'); // Yeti
    return E('div', 'absolute rounded-full'); // PowerUp
}

function updateEntityElement(el, entity) {
    if (entity.hasOwnProperty('isAlive')) { // Skier
        const rotation = { [SkierDirection.Left]: -25, [SkierDirection.Right]: 25, [SkierDirection.Crashed]: 90 }[entity.direction] || 0;
        el.innerHTML = `
            ${entity.hasPowerUp ? `<div class="absolute rounded-full animate-pulse" style="width: ${C.SKIER_WIDTH + 20}px; height: ${C.SKIER_HEIGHT + 15}px; left: -10px; top: -5px; border: 3px solid ${C.POWERUP_COLOR}; box-shadow: 0 0 8px ${C.POWERUP_COLOR};"></div>` : ''}
            <div class="w-full h-full relative" style="transform: rotate(${rotation}deg); transition: transform 0.1s linear; transform-origin: bottom center;">
                <div class="absolute bg-gray-800" style="width: 4px; height: 100%; left: 2px; top: 0; border-radius: 2px;"></div>
                <div class="absolute bg-gray-800" style="width: 4px; height: 100%; right: 2px; top: 0; border-radius: 2px;"></div>
                <div class="absolute rounded-t-md" style="width: 10px; height: 18px; left: 50%; transform: translateX(-50%); top: 5px; background-color: ${entity.color};"></div>
            </div>`;
        Object.assign(el.style, { left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${C.SKIER_WIDTH}px`, height: `${C.SKIER_HEIGHT}px` });
    } else if (entity.hasOwnProperty('type')) { // Obstacle
        const classList = entity.type === ObstacleType.Rock ? 'bg-slate-500 rounded-full' : 'bg-emerald-700';
        el.className = `absolute ${classList}`;
        Object.assign(el.style, { left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${entity.size}px`, height: `${entity.size}px` });
    } else if (entity.hasOwnProperty('opacity')) { // Particle
        Object.assign(el.style, { left: `${entity.x}px`, top: `${entity.y}px`, width: `${entity.size}px`, height: `${entity.size}px`, opacity: entity.opacity });
    } else if (entity.hasOwnProperty('targetPlayerId')) { // Yeti
        el.innerHTML = `
            <div class="absolute rounded-full" style="top: 10px; left: 8px; width: 8px; height: 8px; background-color: ${entity.targetPlayerColor}; box-shadow: 0 0 5px ${entity.targetPlayerColor};"></div>
            <div class="absolute rounded-full" style="top: 10px; right: 8px; width: 8px; height: 8px; background-color: ${entity.targetPlayerColor}; box-shadow: 0 0 5px ${entity.targetPlayerColor};"></div>
            <div class="absolute bg-slate-800" style="bottom: 10px; left: 50%; transform: translateX(-50%); width: 20px; height: 4px; border-radius: 2px;"></div>`;
        el.className = 'absolute bg-slate-200 rounded-md';
        Object.assign(el.style, { left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${C.YETI_WIDTH}px`, height: `${C.YETI_HEIGHT}px`, border: '2px solid #64748b' });
    } else { // PowerUp
        Object.assign(el.style, { left: `${entity.position.x}px`, top: `${entity.position.y}px`, width: `${C.POWERUP_SIZE}px`, height: `${C.POWERUP_SIZE}px`, backgroundColor: C.POWERUP_COLOR, boxShadow: `0 0 15px ${C.POWERUP_COLOR}` });
    }
}

function createReadyUpOverlay() {
    const playerDisplays = players.map(player => E('div', 'text-center text-white font-bold', [
        // Fix: Pass ID as an attribute, not a style, to ensure element can be queried correctly.
        E('p', 'text-2xl mb-2 opacity-50', 'Press Key', {}, { id: `ready-status-${player.id}` }),
        E('div', 'w-24 h-24 rounded-lg flex items-center justify-center text-5xl shadow-lg border-4 border-white/50', player.readyKey, { backgroundColor: player.color }),
        E('p', 'mt-2 text-sm bg-black/50 px-2 py-1 rounded', `Steer Left: [${player.controlKey}]`),
    ]));
    
    // Fix: Pass ID as an attribute, not a style, to ensure element can be queried correctly.
    return E('div', 'absolute inset-0 bg-slate-900/80 z-20 flex flex-col items-center justify-center', [
        E('h2', 'text-6xl font-bold text-white mb-8 animate-pulse', 'GET READY!'),
        E('div', 'flex justify-around items-end w-full max-w-4xl px-4', playerDisplays)
    ], {}, { id: 'ready-up-overlay' });
}

function updateReadyUpOverlay(overlay) {
    players.forEach(player => {
        const statusEl = overlay.querySelector(`#ready-status-${player.id}`);
        if (statusEl) {
            if (player.isReady) {
                statusEl.textContent = 'Ready!';
                statusEl.classList.remove('opacity-50');
                statusEl.classList.add('text-green-400');
            }
        }
    });
}

function gameLoop() {
    frameCount++;
    const { gameYTop } = getCameraData();
    
    // 1. Calculate next players state
    let playersAfterMove = players.map(player => {
        if (player.direction === SkierDirection.Crashed) return { ...player, position: { ...player.position, y: player.position.y - C.GAME_SPEED }};
        if (!player.isAlive) return player;
        
        const verticalOffset = player.position.y - C.SKIER_INITIAL_Y;
        let newVerticalSpeed = player.verticalSpeed + (Math.random() - 0.5) * C.SKIER_VERTICAL_SPEED_BOOST - verticalOffset * C.SKIER_VERTICAL_SPRING_FORCE;
        let newPlayerY = player.position.y + newVerticalSpeed;
        if (Math.abs(newPlayerY - C.SKIER_INITIAL_Y) > C.SKIER_VERTICAL_MAX_OFFSET) {
            newPlayerY = C.SKIER_INITIAL_Y + Math.sign(verticalOffset || 1) * C.SKIER_VERTICAL_MAX_OFFSET;
            newVerticalSpeed = 0;
        }

        let newPlayerX = player.position.x, newDirection = player.direction, newKnockback = player.knockback;
        if (player.knockback) {
            newPlayerX += player.knockback.velocity;
            newDirection = player.knockback.velocity > 0 ? SkierDirection.Right : SkierDirection.Left;
            const newDuration = player.knockback.duration - 1;
            newKnockback = newDuration <= 0 ? null : { ...player.knockback, duration: newDuration };
        } else {
            newPlayerX += C.SKIER_DRIFT_SPEED;
            newDirection = SkierDirection.Right;
            if (keysPressed[player.controlKey]) {
                newPlayerX -= C.SKIER_HORIZONTAL_SPEED;
                newDirection = SkierDirection.Left;
            }
        }
        return { ...player, position: { x: newPlayerX, y: newPlayerY }, direction: newDirection, verticalSpeed: newVerticalSpeed, knockback: newKnockback };
    });

    // 2. Handle Power-ups
    powerUps = powerUps
        .map(p => ({ ...p, position: { ...p.position, y: p.position.y - C.GAME_SPEED } }))
        .filter(p => p.position.y + C.POWERUP_SIZE > gameYTop);
    if (powerUps.length === 0 && Math.random() < C.POWERUP_SPAWN_CHANCE) {
        powerUps.push({ id: Date.now(), position: { x: Math.random() * C.GAME_WIDTH, y: C.GAME_HEIGHT + 50 } });
    }
    let collectedPowerUpId = null;
    playersAfterMove = playersAfterMove.map(player => {
        if (!player.isAlive || player.hasPowerUp) return player;
        for (const powerUp of powerUps) {
            const skierRect = { x: player.position.x, y: player.position.y, width: C.SKIER_WIDTH, height: C.SKIER_HEIGHT };
            const powerUpRect = { x: powerUp.position.x, y: powerUp.position.y, width: C.POWERUP_SIZE, height: C.POWERUP_SIZE };
            if (skierRect.x < powerUpRect.x + powerUpRect.width && skierRect.x + skierRect.width > powerUpRect.x && skierRect.y < powerUpRect.y + powerUpRect.height && skierRect.height + skierRect.y > powerUpRect.y) {
                collectedPowerUpId = powerUp.id;
                return { ...player, hasPowerUp: true };
            }
        }
        return player;
    });
    if (collectedPowerUpId !== null) powerUps = powerUps.filter(p => p.id !== collectedPowerUpId);
    
    // 3. Player vs Player collision
    let playersAfterBump = [...playersAfterMove];
    for (let i = 0; i < playersAfterBump.length; i++) {
        for (let j = i + 1; j < playersAfterBump.length; j++) {
            const p1 = playersAfterBump[i], p2 = playersAfterBump[j];
            if (!p1.isAlive || !p2.isAlive) continue;
            if (p1.position.x < p2.position.x + C.SKIER_WIDTH && p1.position.x + C.SKIER_WIDTH > p2.position.x && p1.position.y < p2.position.y + C.SKIER_HEIGHT && p1.position.y + C.SKIER_HEIGHT > p2.position.y) {
                const overlapX = (p1.position.x + C.SKIER_WIDTH / 2) - (p2.position.x + C.SKIER_WIDTH / 2);
                let p1_updated = { ...p1 }, p2_updated = { ...p2 };
                if (p1.hasPowerUp && !p2.hasPowerUp) {
                    const direction = overlapX === 0 ? 1 : -Math.sign(overlapX);
                    p2_updated.knockback = { velocity: C.POWERUP_BUMP_VELOCITY * direction, duration: C.POWERUP_BUMP_DURATION };
                    p1_updated.hasPowerUp = false;
                } else if (p2.hasPowerUp && !p1.hasPowerUp) {
                    const direction = overlapX === 0 ? -1 : Math.sign(overlapX);
                    p1_updated.knockback = { velocity: C.POWERUP_BUMP_VELOCITY * direction, duration: C.POWERUP_BUMP_DURATION };
                    p2_updated.hasPowerUp = false;
                } else {
                    const bumpAmount = 4;
                    const p1_newPos = { ...p1_updated.position }, p2_newPos = { ...p2_updated.position };
                    if (overlapX > 0) { p1_newPos.x += bumpAmount; p2_newPos.x -= bumpAmount; } else { p1_newPos.x -= bumpAmount; p2_newPos.x += bumpAmount; }
                    p1_updated.position = p1_newPos;
                    p2_updated.position = p2_newPos;
                }
                playersAfterBump[i] = p1_updated;
                playersAfterBump[j] = p2_updated;
            }
        }
    }

    // 4. Handle Yeti
    const alivePlayersForYeti = playersAfterBump.filter(p => p.isAlive);
    if (!yeti && alivePlayersForYeti.length > 0 && Math.random() < C.YETI_SPAWN_CHANCE) {
        const target = alivePlayersForYeti[Math.floor(Math.random() * alivePlayersForYeti.length)];
        yeti = { id: Date.now(), position: { x: -C.YETI_WIDTH, y: target.position.y - (C.YETI_HEIGHT - C.SKIER_HEIGHT) / 2 }, targetPlayerId: target.id, targetPlayerColor: target.color };
    }
    if (yeti) {
        yeti.position.x += C.YETI_SPEED;
        const targetPlayer = playersAfterBump.find(p => p.id === yeti.targetPlayerId);
        if (!targetPlayer || !targetPlayer.isAlive || yeti.position.x > C.GAME_WIDTH) {
            yeti = null;
        } else {
            const yetiRect = { x: yeti.position.x, y: yeti.position.y, width: C.YETI_WIDTH, height: C.YETI_HEIGHT };
            const playerRect = { x: targetPlayer.position.x, y: targetPlayer.position.y, width: C.SKIER_WIDTH, height: C.SKIER_HEIGHT };
            if (yetiRect.x < playerRect.x + playerRect.width && yetiRect.x + yetiRect.width > playerRect.x && yetiRect.y < playerRect.y + playerRect.height && yetiRect.height + yetiRect.y > playerRect.y) {
                playersAfterBump = playersAfterBump.map(p => p.id === targetPlayer.id ? { ...p, knockback: { velocity: C.YETI_PUSH_VELOCITY, duration: C.YETI_PUSH_DURATION } } : p);
                yeti = null;
            }
        }
    }
    
    // 5. Finalize player state (off-screen check after all movement)
    let playersFinal = playersAfterBump.map(p => {
        if (!p.isAlive) return p;
        if (p.position.x <= 0 || p.position.x >= C.GAME_WIDTH - C.SKIER_WIDTH) {
             return { ...p, position: { ...p.position, x: Math.max(0, Math.min(C.GAME_WIDTH - C.SKIER_WIDTH, p.position.x)) }, isAlive: false, direction: SkierDirection.Crashed, verticalSpeed: 0 };
        }
        return p;
    });

    // 6. Calculate next obstacles state
    obstacles = obstacles.map(o => ({ ...o, position: { ...o.position, y: o.position.y - C.GAME_SPEED } })).filter(o => o.position.y + o.size > gameYTop);
    if (Math.random() < C.OBSTACLE_DENSITY * 10) {
      obstacles.push({
        id: Date.now() + Math.random(),
        position: { x: Math.random() * C.GAME_WIDTH, y: C.GAME_HEIGHT + 50 },
        type: Math.random() > 0.5 ? ObstacleType.Tree : ObstacleType.Rock,
        size: C.OBSTACLE_MIN_SIZE + Math.random() * (C.OBSTACLE_MAX_SIZE - C.OBSTACLE_MIN_SIZE)
      });
    }

    // 7. Collision detection (Player vs Obstacle)
    playersFinal = playersFinal.map(player => {
        if (!player.isAlive) return player;
        for (const obstacle of obstacles) {
            const skierRect = { x: player.position.x, y: player.position.y, width: C.SKIER_WIDTH, height: C.SKIER_HEIGHT };
            const obstacleRect = { x: obstacle.position.x, y: obstacle.position.y, width: obstacle.size, height: obstacle.size };
            if (skierRect.x < obstacleRect.x + obstacleRect.width && skierRect.x + skierRect.width > obstacleRect.x && skierRect.y < obstacleRect.y + obstacleRect.height && skierRect.height + skierRect.y > obstacleRect.y) {
                return { ...player, isAlive: false, direction: SkierDirection.Crashed, verticalSpeed: 0 };
            }
        }
        return player;
    });
    
    players = playersFinal.filter(p => p.position.y + C.SKIER_HEIGHT > gameYTop);

    // 8. Calculate next particles state
    particles = particles.map(p => ({ ...p, y: p.y - C.GAME_SPEED, opacity: p.opacity - 0.03 })).filter(p => p.opacity > 0);
    if (frameCount % 3 === 0 && particles.length < C.MAX_PARTICLES) {
      players.forEach(player => {
          if (player.isAlive) {
              particles.push({ id: `p${particleIdCounter++}`, x: player.position.x + C.SKIER_WIDTH / 2 + (Math.random() - 0.5) * 15, y: player.position.y, size: Math.random() * 3 + 2, opacity: 1 });
          }
      });
    }

    // 9. Check for game over
    const alivePlayers = players.filter(p => p.isAlive);
    if ((playerCount > 1 && alivePlayers.length <= 1) || (playerCount === 1 && alivePlayers.length === 0)) {
        endGame(alivePlayers[0] || null);
        return;
    }

    // 10. Update score
    score += 1;

    render();
    gameLoopId = requestAnimationFrame(gameLoop);
}

// --- GAME STATE TRANSITIONS ---
function selectPlayers(count) {
    playerCount = count;
    score = 0;
    winner = null;
    gameState = GameState.Playing;

    // Reset game entities for a clean start
    obstacles = [];
    particles = [];
    powerUps = [];
    yeti = null;
    frameCount = 0;
    
    players = [];
    const startingXOffset = C.GAME_WIDTH / (playerCount + 1);
    for (let i = 0; i < playerCount; i++) {
        players.push({
            id: i,
            position: { x: startingXOffset * (i + 1) - C.SKIER_WIDTH / 2, y: C.SKIER_INITIAL_Y },
            direction: SkierDirection.Straight,
            ...C.PLAYER_CONFIGS[i],
            isReady: false, isAlive: true, verticalSpeed: 0, hasPowerUp: false, knockback: null,
        });
    }
    isReadyUpPhase = true;
    updateFooterTip();
    createGameScreen();
    render();
}

function endGame(winningPlayer) {
    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
    gameState = GameState.GameOver;
    finalScore = Math.floor(score / 10);
    winner = winningPlayer;
    createGameOverScreen();
    entityElements.forEach(el => el.remove());
    entityElements.clear();
}

function restartGame() {
    selectPlayers(playerCount);
}

function changePlayers() {
    init();
}

// --- EVENT HANDLERS ---
function handleKeyDown(e) {
    const key = e.key.toLowerCase();
    keysPressed[key] = true;
    if (isReadyUpPhase) {
        players = players.map(p => p.readyKey === key ? { ...p, isReady: true } : p);
        render(); // Render to show the "Ready!" status update
        if (players.length > 0 && players.every(p => p.isReady)) {
            setTimeout(() => {
                isReadyUpPhase = false;
                if (gameState === GameState.Playing) gameLoopId = requestAnimationFrame(gameLoop);
            }, 1000);
        }
    }
}

function handleKeyUp(e) {
    keysPressed[e.key.toLowerCase()] = false;
}

// --- INITIALIZATION ---
function init() {
    gameState = GameState.PlayerSelect;
    players = [];
    obstacles = [];
    particles = [];
    powerUps = [];
    yeti = null;
    score = 0;
    Object.keys(keysPressed).forEach(key => keysPressed[key] = false);
    if(gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = null;

    entityElements.forEach(el => el.remove());
    entityElements.clear();

    createPlayerSelectScreen();
    
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
}

init();