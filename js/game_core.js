import { state } from './state.js';
import { CONFIG, ASSETS } from './config.js';
import { initAssets, loadLevelAssets } from './assets.js';
import { initInput } from './input.js';
import { generateLevel } from './map.js';
import { updateHUD, switchWeapon, damagePlayer, shoot, shootLaserFrame, updateShopUI } from './player.js';
import { render } from './raycaster.js';
import { audioManager } from './audio.js';
import { initMobileControls, refreshMobileUI, updateWeaponBar } from './mobile.js';

let width, height;
let canvas, ctx;
let pathfindingWorker = null;

console.log("GAME: Script loaded. Waiting for init...");

export function init() {
    console.log("GAME: Init function called.");

    // Expose for debugging
    window.state = state;
    window.ASSETS = ASSETS;
    window.audioManager = audioManager;

    // Initialize Pathfinding Worker
    try {
        pathfindingWorker = new Worker('js/pathfinding.worker.js');
        pathfindingWorker.onmessage = function (e) {
            const { enemyId, path } = e.data;
            const enemy = state.enemies.find(item => item.id === enemyId);
            if (enemy) {
                enemy.path = path;
                enemy.pathPending = false;
                enemy.pathTimer = 1.0 + Math.random() * 0.5;
            }
        };
        console.log("GAME: Pathfinding Web Worker initialized successfully.");
    } catch (err) {
        console.error("GAME: Failed to initialize Pathfinding Web Worker, will fallback to sync BFS.", err);
    }

    canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error("GAME: Canvas not found!");
        return;
    }
    ctx = canvas.getContext('2d', { alpha: false });
    console.log("GAME: Canvas context obtained.");

    resize();
    window.addEventListener('resize', resize);

    initAssets();

    initInput(canvas, startGame, shoot, togglePause, nextLevel, resetGame, toggleVolumeMenu, nextTrack);

    // Initialize mobile controls (always — activated on demand)
    initMobileControls(shoot, togglePause, switchWeapon);

    // Audio Controls
    document.getElementById('music-volume').addEventListener('input', (e) => {
        audioManager.setMusicVolume(parseFloat(e.target.value));
    });
    document.getElementById('sfx-volume').addEventListener('input', (e) => {
        audioManager.setSfxVolume(parseFloat(e.target.value));
    });

    // UI Buttons
    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', togglePause);

    const btnVolume = document.getElementById('btn-volume-menu');
    if (btnVolume) btnVolume.addEventListener('click', toggleVolumeMenu);

    const btnReset = document.getElementById('btn-reset');
    if (btnReset) btnReset.addEventListener('click', () => {
        togglePause(); // Unpause first to reset state correctly
        resetGame();
    });

    const btnNextTrack = document.getElementById('btn-next-track');
    if (btnNextTrack) btnNextTrack.addEventListener('click', nextTrack);

    requestAnimationFrame(loop);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * CONFIG.resolution;
    canvas.height = height * CONFIG.resolution;
    ctx.imageSmoothingEnabled = false;
}

function updatePathfindingWorkerMap() {
    if (pathfindingWorker && state.map) {
        pathfindingWorker.postMessage({
            type: 'init',
            width: state.map.width,
            height: state.map.height,
            data: state.map.data
        });
    }
}

export function startGame() {
    // Reset Game State
    state.level = 1;
    state.player.health = 100;
    state.player.ammo = { 0: Infinity, 1: 20, 2: 50, 3: Infinity, 4: 10 };
    state.player.inventory = { red: false, green: false, blue: false };
    state.player.kills = 0;
    state.player.score = 0;
    state.player.coins = 0;
    state.player.weaponIndex = 0; // Reset to Pistol
    state.player.lastWeaponIndex = 0;
    state.player.animState = 'IDLE';
    state.player.machineGunHeat = 0;
    state.player.machineGunOverheated = false;
    state.player.chaingunDurability = 1000;
    state.player.heavyMachineGunHeat = 0;
    state.player.heavyMachineGunOverheated = false;
    state.player.autoShotgunHeat = 0;
    state.player.autoShotgunOverheated = false;

    // Reset new systems
    state.player.comboCount = 0;
    state.player.comboMultiplier = 1;
    state.player.comboTimer = 0;
    state.player.dashCooldown = 0;
    state.player.dashActive = false;
    state.player.dashTimer = 0;
    state.player.screenShakeIntensity = 0;
    state.player.screenShakeTimer = 0;
    state.player.crosshairSpread = 0;
    state.player.totalKills = 0;
    state.player.killsByType = { soldier: 0, soldierB: 0, monster: 0, monsterB2: 0, brain: 0, geco: 0 };
    state.player.totalCoinsEarned = 0;
    state.player.gameStartTime = Date.now();
    state.player.laserState = 'IDLE';
    state.player.laserTimer = 0;

    // Reset stamina
    state.showMap = false;
    state.player.stamina = CONFIG.playerStamina;
    state.player.staminaCooldown = 0;
    state.player.staminaDepleted = false;

    // Reset particles
    state.particles = [];

    // Reset projectiles using pool clear
    state.clearProjectiles();

    // Reset boss wave state
    state.bossWave = null;

    state.player.weapons.forEach(w => {
        if (w.name !== 'PISTOL' && w.name !== 'SONAR') w.unlocked = false;
        else w.unlocked = true;
    });
    state.levelStartTime = Date.now();

    state.gameState = 'PLAYING';
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
        uiLayer.classList.remove('hidden');
        uiLayer.style.display = '';
    }
    document.getElementById('menus').classList.add('hidden');
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('history-screen').classList.add('hidden');
    document.getElementById('level-complete-screen').classList.add('hidden');
    document.getElementById('death-menu').classList.add('hidden'); // Ensure death menu is hidden

    // Mobile mode: show/hide controls overlay & crosshair
    const mobileOverlay = document.getElementById('mobile-controls');
    const crosshair = document.getElementById('crosshair-container');
    if (state.mobileMode) {
        document.body.classList.add('mobile-mode');
        if (mobileOverlay) mobileOverlay.classList.remove('hidden');
        if (crosshair) crosshair.style.display = 'none'; // crosshair not needed on mobile
        refreshMobileUI();
    } else {
        document.body.classList.remove('mobile-mode');
        if (mobileOverlay) mobileOverlay.classList.add('hidden');
        if (crosshair) crosshair.style.display = '';
    }

    // Generate Initial Level
    loadLevelAssets(1);
    generateLevel(1);
    updatePathfindingWorkerMap();

    // Start Music
    audioManager.init();
    // Ensure random track is picked fresh
    const musicTrack = Math.floor(Math.random() * (state.musicCount || 4)) + 1;
    console.log(`GAME: Starting music track ${musicTrack}`);
    audioManager.playMusic(`bg_music_${musicTrack}`, () => {
        console.log("GAME: Track ended, auto-advancing...");
        nextTrack();
    });

    // Ensure Audio State Reset
    audioManager.setLaserActive(false);
}

export function resetGame() {
    startGame();
}

export function nextTrack() {
    let current = 1;
    if (audioManager.currentMusic) {
        // Extract number from key 'bg_music_X'
        const parts = audioManager.currentMusic.key.split('_');
        current = parseInt(parts[2]);
    }
    let next = current + 1;
    if (state.musicCount && next > state.musicCount) next = 1;
    else if (!state.musicCount && next > 4) next = 1; // Fallback

    console.log(`GAME: Switching to music track ${next}`);
    audioManager.playMusic(`bg_music_${next}`, () => {
        // Auto-advance when track ends
        console.log("GAME: Track ended, auto-advancing...");
        nextTrack();
    });
}

export function toggleVolumeMenu() {
    const volMenu = document.getElementById('volume-controls');
    if (volMenu.classList.contains('hidden')) {
        volMenu.classList.remove('hidden');
    } else {
        volMenu.classList.add('hidden');
    }
}

export function nextLevel() {
    state.level++;
    state.gameState = 'PLAYING';
    state.showMap = false;
    state.levelStartTime = Date.now();
    state.player.kills = 0;
    state.player.inventory = { red: false, green: false, blue: false };

    // Reset Level State
    state.enemies = [];
    state.npcs = [];
    state.items = [];
    state.clearProjectiles();
    state.explosions = [];
    state.decals = [];
    state.hitMarkers = [];

    // Generate New Map
    loadLevelAssets(state.level);
    generateLevel(state.level);
    updatePathfindingWorkerMap();

    // Hide Menus
    const uiLayer = document.getElementById('ui-layer');
    if (uiLayer) {
        uiLayer.classList.remove('hidden');
        uiLayer.style.display = '';
    }
    document.getElementById('menus').classList.add('hidden');
    document.getElementById('level-complete-screen').classList.add('hidden');

    // Pointer lock only in desktop mode
    if (!state.mobileMode) {
        if (document.pointerLockElement !== canvas) {
            try {
                canvas.requestPointerLock();
            } catch (e) {
                console.warn("Next level pointer lock failed:", e);
            }
        }
    } else {
        updateWeaponBar(); // refresh weapon icons after level transition
    }
}

export function togglePause() {
    if (state.gameState === 'PLAYING') {
        state.gameState = 'PAUSED';
        document.getElementById('menus').classList.remove('hidden');
        document.getElementById('pause-menu').classList.remove('hidden');
        document.getElementById('pause-kills').innerText = state.player.kills;

        // Update Totem Status
        document.getElementById('pause-totem-red').style.opacity = state.player.inventory.red ? 1 : 0.2;
        document.getElementById('pause-totem-green').style.opacity = state.player.inventory.green ? 1 : 0.2;
        document.getElementById('pause-totem-blue').style.opacity = state.player.inventory.blue ? 1 : 0.2;

        // Update Volume Sliders
        document.getElementById('music-volume').value = audioManager.musicVolume;
        document.getElementById('sfx-volume').value = audioManager.sfxVolume;

        // Show/hide Edit Controls button based on mode
        const editBtn = document.getElementById('mobile-edit-controls-btn');
        if (editBtn) {
            if (state.mobileMode) {
                editBtn.classList.remove('hidden');
            } else {
                editBtn.classList.add('hidden');
            }
        }

        if (!state.mobileMode) document.exitPointerLock();
    } else if (state.gameState === 'PAUSED') {
        state.gameState = 'PLAYING';
        document.getElementById('menus').classList.add('hidden');
        document.getElementById('pause-menu').classList.add('hidden');
        // Hide volume menu on resume
        document.getElementById('volume-controls').classList.add('hidden');
        if (!state.mobileMode) {
            if (document.pointerLockElement !== canvas) {
                try {
                    canvas.requestPointerLock();
                } catch (e) {
                    console.warn("Resume pointer lock failed:", e);
                }
            }
        }
    } else if (state.gameState === 'SHOP') {
        closeShop();
    }
}

export function closeShop() {
    if (state.gameState === 'SHOP') {
        document.getElementById('shop-menu').classList.add('hidden');
        state.gameState = 'PLAYING';
        if (!state.mobileMode) {
            if (document.pointerLockElement !== canvas) {
                try {
                    canvas.requestPointerLock();
                } catch (e) {
                    console.warn("Shop close pointer lock failed:", e);
                }
            }
        }
    }
}
window.closeShop = closeShop;

// --- GAME LOOP ---
function loop(timestamp) {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1);
    state.lastTime = timestamp;

    try {
        if (state.gameState === 'PLAYING') {
            update(dt);
            render(canvas, ctx);
            renderLaserFunc(ctx); // Render beam on top
        } else if (state.gameState === 'SHOP') {
            render(canvas, ctx); // Keep rendering in shop mode
        }

        // Apply screen shake to canvas element via CSS transform
        const canvasEl = document.getElementById('gameCanvas');
        if (canvasEl) {
            if (state.gameState === 'PLAYING' && state.player.screenShakeIntensity > 0) {
                const dx = (Math.random() - 0.5) * state.player.screenShakeIntensity * 3.0;
                const dy = (Math.random() - 0.5) * state.player.screenShakeIntensity * 3.0;
                canvasEl.style.transform = `translate(${dx}px, ${dy}px)`;
            } else {
                canvasEl.style.transform = 'none';
            }
        }
    } catch (e) {
        console.error("GAME LOOP ERROR:", e);
        state.gameState = 'ERROR'; // Stop loop
    }

    requestAnimationFrame(loop);
}

// --- COLLISION & LINE OF SIGHT HELPERS ---
function checkItemCollision(x, y, radius) {
    const r = radius || 0.35;
    for (let item of state.items) {
        if (['barrel', 'chair', 'chair2', 'hanger', 'lamp'].includes(item.type)) {
            const dx = x - item.x;
            const dy = y - item.y;
            if (dx * dx + dy * dy < r * r) return true;
        }
    }
    return false;
}

function checkCollision(x, y, radius) {
    const r = radius || 0.3;
    const points = [
        { x: x - r, y: y - r },
        { x: x + r, y: y - r },
        { x: x - r, y: y + r },
        { x: x + r, y: y + r }
    ];
    for (let p of points) {
        if (state.map.data[Math.floor(p.y) * state.map.width + Math.floor(p.x)] > 0) return true;
    }
    if (checkItemCollision(x, y, r + 0.1)) return true;
    return false;
}

function checkLineOfSight(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(dist * 2);
    const stepX = dx / steps;
    const stepY = dy / steps;

    let currX = x1;
    let currY = y1;
    for (let i = 0; i < steps; i++) {
        currX += stepX;
        currY += stepY;
        if (state.map.data[Math.floor(currY) * state.map.width + Math.floor(currX)] !== 0) return false;
    }
    return true;
}

// --- ENEMY AI STATE MACHINES ---

function findPath(startX, startY, endX, endY) {
    const mapW = state.map.width;
    const mapH = state.map.height;

    const startTileX = Math.floor(startX);
    const startTileY = Math.floor(startY);
    const endTileX = Math.floor(endX);
    const endTileY = Math.floor(endY);

    if (startTileX === endTileX && startTileY === endTileY) {
        return [];
    }

    const startIdx = startTileY * mapW + startTileX;
    const queue = [startIdx];
    const visited = new Uint8Array(mapW * mapH);
    visited[startIdx] = 1;

    const parentMap = new Int32Array(mapW * mapH).fill(-1);

    const dirX = [0, 0, 1, -1];
    const dirY = [1, -1, 0, 0];

    let found = false;
    let head = 0;

    while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % mapW;
        const cy = Math.floor(curr / mapW);

        if (cx === endTileX && cy === endTileY) {
            found = true;
            break;
        }

        for (let i = 0; i < 4; i++) {
            const nx = cx + dirX[i];
            const ny = cy + dirY[i];

            if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
                const idx = ny * mapW + nx;
                if (!visited[idx] && state.map.data[idx] === 0) {
                    visited[idx] = 1;
                    parentMap[idx] = curr;
                    queue.push(idx);
                }
            }
        }
    }

    if (!found) return [];

    const path = [];
    let currIdx = endTileY * mapW + endTileX;
    while (currIdx !== -1) {
        const cx = currIdx % mapW;
        const cy = Math.floor(currIdx / mapW);
        path.push({ x: cx + 0.5, y: cy + 0.5 });
        const parentKey = parentMap[currIdx];
        if (parentKey === startIdx) break;
        currIdx = parentKey;
    }

    path.reverse();
    return path;
}

function getSteeringDir(e, targetX, targetY) {
    const tdx = targetX - e.x;
    const tdy = targetY - e.y;
    let tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist === 0) tdist = 0.1;

    let desiredX = tdx / tdist;
    let desiredY = tdy / tdist;

    // 1. Separation force
    let sepX = 0, sepY = 0, sepCount = 0;
    state.enemies.forEach(other => {
        if (other === e || other.hp <= 0 || other.state === 'FLOOR' || other.state === 'FLOOR_FIRE_2' || other.state === 'FLOOR_SHOTGUN' || other.state === 'FLOOR_V2') return;
        const odx = e.x - other.x;
        const ody = e.y - other.y;
        const od = Math.sqrt(odx * odx + ody * ody);
        if (od > 0 && od < 0.8) {
            sepX += odx / od;
            sepY += ody / od;
            sepCount++;
        }
    });

    if (sepCount > 0) {
        desiredX = desiredX * 0.75 + (sepX / sepCount) * 0.25;
        desiredY = desiredY * 0.75 + (sepY / sepCount) * 0.25;
        const len = Math.sqrt(desiredX * desiredX + desiredY * desiredY);
        if (len > 0) { desiredX /= len; desiredY /= len; }
    }

    // 2. Wall Avoidance
    let avoidX = 0, avoidY = 0, avoidCount = 0;
    const checkRadius = 0.6;
    const dirs = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        { x: 0.7, y: 0.7 }, { x: -0.7, y: 0.7 }, { x: 0.7, y: -0.7 }, { x: -0.7, y: -0.7 }
    ];
    for (let d of dirs) {
        const checkX = e.x + d.x * checkRadius;
        const checkY = e.y + d.y * checkRadius;
        if (checkX < 0 || checkX >= state.map.width || checkY < 0 || checkY >= state.map.height) {
            avoidX -= d.x;
            avoidY -= d.y;
            avoidCount++;
        } else if (state.map.data[Math.floor(checkY) * state.map.width + Math.floor(checkX)] > 0) {
            avoidX -= d.x;
            avoidY -= d.y;
            avoidCount++;
        }
    }
    if (avoidCount > 0) {
        desiredX = desiredX * 0.7 + (avoidX / avoidCount) * 0.3;
        desiredY = desiredY * 0.7 + (avoidY / avoidCount) * 0.3;
        const len = Math.sqrt(desiredX * desiredX + desiredY * desiredY);
        if (len > 0) { desiredX /= len; desiredY /= len; }
    }

    return { x: desiredX, y: desiredY };
}

function moveEnemyTowardsTarget(e, targetX, targetY, speed, dt) {
    const steer = getSteeringDir(e, targetX, targetY);
    const nx = e.x + steer.x * speed * dt;
    if (!checkCollision(nx, e.y, 0.3)) {
        e.x = nx;
    }
    const ny = e.y + steer.y * speed * dt;
    if (!checkCollision(e.x, ny, 0.3)) {
        e.y = ny;
    }
}

function getNavigationTarget(e, hasLOS, dist, dt) {
    if (!e.pathTimer) e.pathTimer = 0;

    if (hasLOS) {
        e.path = null;
        e.pathTimer = 0;

        let targetX = state.player.x;
        let targetY = state.player.y;

        if (e.type === 'soldierB') {
            if (!e.flankTimer) e.flankTimer = 0;
            e.flankTimer -= dt;
            if (e.flankTimer <= 0) {
                e.flankTimer = 1.5 + Math.random() * 1.5;
                const sideAngle = state.player.dir + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
                e.flankOffsetX = Math.cos(sideAngle) * 3.5;
                e.flankOffsetY = Math.sin(sideAngle) * 3.5;
            }
            targetX += e.flankOffsetX || 0;
            targetY += e.flankOffsetY || 0;
        }
        return { x: targetX, y: targetY };
    }

    e.pathTimer -= dt;
    if (!e.path || e.path.length === 0 || e.pathTimer <= 0) {
        if (pathfindingWorker && !e.pathPending) {
            e.pathPending = true;
            pathfindingWorker.postMessage({
                type: 'findPath',
                enemyId: e.id,
                startX: e.x,
                startY: e.y,
                endX: state.player.x,
                endY: state.player.y
            });
            if (!e.path) e.path = [];
        } else if (!pathfindingWorker) {
            e.path = findPath(e.x, e.y, state.player.x, state.player.y);
            e.pathTimer = 1.0 + Math.random() * 0.5;
        }
    }

    if (e.path && e.path.length > 0) {
        const wp = e.path[0];
        const wdx = wp.x - e.x;
        const wdy = wp.y - e.y;
        const wdist = Math.sqrt(wdx * wdx + wdy * wdy);
        if (wdist < 0.4) {
            e.path.shift();
        }

        if (e.path.length > 0) {
            return e.path[0];
        }
    }

    return { x: state.player.x, y: state.player.y };
}

function updateZombieAI(e, dist, dx, dy, dt, speedScale) {
    if (e.attackAnimTimer && e.attackAnimTimer > 0) {
        e.attackAnimTimer -= dt;
        if (e.attackAnimTimer <= 0) {
            e.state = 'IDLE';
        } else {
            e.state = 'ATTACK';
            return;
        }
    }

    const hasLOS = checkLineOfSight(e.x, e.y, state.player.x, state.player.y);
    if (!hasLOS || dist > 15) {
        if (e.aggroTimer && e.aggroTimer > 0) {
            e.aggroTimer -= dt;
            e.state = 'IDLE';
        } else {
            e.state = 'STAND_BY';
            return;
        }
    } else {
        if (e.state === 'STAND_BY') e.state = 'IDLE';
        e.hasDetectedPlayer = true;
    }

    if (dist < 8) {
        e.animTimer += dt;
        if (e.animTimer > 0.2) {
            e.animTimer = 0;
            const maxFrames = e.type === 'soldier' ? 4 : 3;
            e.frame = (e.frame + 1) % maxFrames;
        }

        const attackRange = 1.20;
        if (dist > attackRange) {
            // SoldierB: zig-zag approach
            let target;
            if (e.type === 'soldierB') {
                // Zig-zag: pick a perpendicular offset that alternates side
                if (!e.zigzagTimer) e.zigzagTimer = 0;
                if (!e.zigzagSide) e.zigzagSide = 1;
                e.zigzagTimer -= dt;
                if (e.zigzagTimer <= 0) {
                    e.zigzagTimer = 0.6 + Math.random() * 0.5;
                    e.zigzagSide *= -1;
                }
                // Perpendicular direction to player
                const perpX = -dy / (dist || 1);
                const perpY = dx / (dist || 1);
                const zigOffset = 2.5;
                target = {
                    x: state.player.x + perpX * zigOffset * e.zigzagSide,
                    y: state.player.y + perpY * zigOffset * e.zigzagSide
                };
            } else {
                target = getNavigationTarget(e, hasLOS, dist, dt);
            }
            const speedConf = e.type === 'soldierB' ? 2.5 : 1.5;
            moveEnemyTowardsTarget(e, target.x, target.y, speedConf * speedScale, dt);
        } else {
            const baseFreq = dt * 2;
            const scaledFreq = baseFreq * (1 + Math.min(state.level * 0.1, 1.0));
            if (Math.random() < scaledFreq) {
                let dmg = 5 + Math.floor(Math.random() * 5);
                if (e.type === 'soldierB') dmg = 10 + Math.floor(Math.random() * 10);
                damagePlayer(dmg, e.type);

                const pushAngle = Math.atan2(dy, dx);
                const force = 8.0;
                state.player.vx += Math.cos(pushAngle) * force;
                state.player.vy += Math.sin(pushAngle) * force;

                if (e.type === 'soldier') {
                    e.state = 'ATTACK';
                    e.attackAnimTimer = 0.45;
                }

                if (ASSETS.audio.zombie.attack.length > 0) {
                    const idx = Math.floor(Math.random() * ASSETS.audio.zombie.attack.length);
                    audioManager.play3D(`zombie_attack_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 2.0);
                } else {
                    const idx = Math.floor(Math.random() * 7);
                    audioManager.play3D(`zombie_dtc_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 2.0);
                }
            }
        }
    }

    if (!e.sbTimer) e.sbTimer = Math.random() * 2 + 1;
    e.sbTimer -= dt;

    if (dist < 10) {
        if (e.sbTimer > 2.1) e.sbTimer = 0;
        if (e.sbTimer <= 0) {
            const idx = Math.floor(Math.random() * 7);
            audioManager.play3D(`zombie_dtc_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 3.0);
            e.sbTimer = 2.0;
        }
    } else {
        if (e.sbTimer <= 0) {
            const idx = Math.floor(Math.random() * 7);
            audioManager.play3D(`zombie_dtc_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 1.5);
            e.sbTimer = Math.random() * 4 + 3;
        }
    }
}

function updateMonsterAI(e, dist, dx, dy, dt, speedScale) {
    if (!e.chargeCooldown) e.chargeCooldown = 0;
    if (e.chargeCooldown > 0) e.chargeCooldown -= dt;

    if (e.chargeActive) {
        e.state = 'CHARGE'; // Maintain charge state
        e.chargeTimer -= dt;
        if (e.chargeTimer <= 0) {
            e.chargeActive = false;
            e.state = 'IDLE';
        } else {
            // Animate charge/run frames (alternating between 2 frames)
            if (!e.animTimer) e.animTimer = 0;
            e.animTimer += dt;
            if (e.animTimer > 0.12) {
                e.animTimer = 0;
                e.frame = (e.frame + 1) % 2;
            }

            const speed = 8.0 * speedScale * dt;
            const nx = e.x + e.chargeDirX * speed;
            const ny = e.y + e.chargeDirY * speed;

            if (checkCollision(nx, ny, 0.3)) {
                e.chargeActive = false;
                e.state = 'HIT';
                e.hitTimer = 1.0;
                state.explosions.push({ x: e.x, y: e.y, frame: 0, timer: 0, type: 'wall' });
                console.log("MONSTER CHARGE BONK!");
                return;
            }

            e.x = nx;
            e.y = ny;

            const pdx = state.player.x - e.x;
            const pdy = state.player.y - e.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (pdist < 0.8) {
                damagePlayer(25, e.type);
                const pushAngle = Math.atan2(pdy, pdx);
                state.player.vx += Math.cos(pushAngle) * 20.0;
                state.player.vy += Math.sin(pushAngle) * 20.0;
                e.chargeActive = false;
                e.state = 'IDLE';
                console.log("MONSTER CHARGE HIT PLAYER!");
            }
            return;
        }
    }

    const hasLOS = checkLineOfSight(e.x, e.y, state.player.x, state.player.y);

    if (dist >= 5.0 && dist <= 8.0 && hasLOS && e.chargeCooldown <= 0 && Math.random() < dt * 0.5) {
        e.chargeActive = true;
        e.chargeTimer = 1.0;
        e.chargeDirX = dx / dist;
        e.chargeDirY = dy / dist;
        e.chargeCooldown = 6.0;
        e.state = 'CHARGE';
        e.frame = 0;
        e.animTimer = 0;
        if (ASSETS.audio.monster.attack.length > 0) {
            audioManager.play3D('monster_attack_0', e.x, e.y, state.player.x, state.player.y);
        }
        console.log("MONSTER CHARGING PLAYER!");
        return;
    }

    if (dist < 8) {
        e.animTimer += dt;
        if (e.animTimer > 0.2) {
            e.animTimer = 0;
            e.frame = (e.frame + 1) % 3;
        }

        if (dist > 1.0) {
            const target = getNavigationTarget(e, hasLOS, dist, dt);
            moveEnemyTowardsTarget(e, target.x, target.y, 4.0 * speedScale, dt);
        } else {
            const baseFreq = dt * 2;
            const scaledFreq = baseFreq * (1 + Math.min(state.level * 0.1, 1.0));
            if (Math.random() < scaledFreq) {
                let dmg = 5 + Math.floor(Math.random() * 5);
                damagePlayer(dmg, e.type);

                const pushAngle = Math.atan2(dy, dx);
                const force = 8.0;
                state.player.vx += Math.cos(pushAngle) * force;
                state.player.vy += Math.sin(pushAngle) * force;

                if (ASSETS.audio.monster.attack.length > 0) {
                    const idx = Math.floor(Math.random() * ASSETS.audio.monster.attack.length);
                    audioManager.play3D(`monster_attack_${idx}`, e.x, e.y, state.player.x, state.player.y);
                }
            }
        }
    }

    if (!e.sbTimer) e.sbTimer = Math.random() * 2 + 1;
    e.sbTimer -= dt;
    if (e.sbTimer <= 0) {
        if (dist > 8) {
            const idx = Math.floor(Math.random() * 4);
            audioManager.play3D(`monster_sb_${idx}`, e.x, e.y, state.player.x, state.player.y);
        }
        e.sbTimer = Math.random() * 4 + 3;
    }
}

function updateBrainAI(e, dist, dx, dy, dt, speedScale) {
    if (!e.attackTimer) e.attackTimer = 0;
    e.attackTimer += dt;

    if (!e.teleportCooldown) e.teleportCooldown = 0;
    if (e.teleportCooldown > 0) e.teleportCooldown -= dt;

    // --- TELEPORT_OUT animation: play frames 0→3 at origin ---
    if (e.state === 'TELEPORT_OUT') {
        e.animTimer += dt;
        if (e.animTimer > 0.15) {
            e.animTimer = 0;
            e.frame++;
            if (e.frame >= 4) {
                // Animation done, move to destination and start TELEPORT_IN
                e.x = e.teleportDestX;
                e.y = e.teleportDestY;
                e.state = 'TELEPORT_IN';
                e.frame = 3; // Start from frame 3 (will play 3→0)
                e.animTimer = 0;
                // No cannon explosion here — the teleport sprite handles the visual
            }
        }
        return;
    }

    // --- TELEPORT_IN animation: play frames 3→0 at destination ---
    if (e.state === 'TELEPORT_IN') {
        e.animTimer += dt;
        if (e.animTimer > 0.15) {
            e.animTimer = 0;
            e.frame--;
            if (e.frame < 0) {
                // Animation done, return to normal IDLE
                e.state = 'IDLE';
                e.frame = 0;
                e.animTimer = 0;
            }
        }
        return;
    }

    // --- Trigger teleport when player is close and cooldown is ready ---
    if (dist < 3.0 && e.teleportCooldown <= 0) {
        let tpSuccess = false;
        if (state.killRoom.active) {
            // Stay inside active Kill/Arena room, but teleport as far as possible from the player
            const kr = state.killRoom.isArena ? state.rooms[state.killRoom.roomIndex] : state.killRoomCandidates[state.killRoom.roomIndex];
            if (kr) {
                let bestX = e.x;
                let bestY = e.y;
                let maxDistSq = -1;
                for (let attempt = 0; attempt < 30; attempt++) {
                    const tpx = kr.x + 1.2 + Math.random() * (kr.w - 2.4);
                    const tpy = kr.y + 1.2 + Math.random() * (kr.h - 2.4);
                    const mapIdx = Math.floor(tpy) * state.map.width + Math.floor(tpx);
                    if (state.map.data[mapIdx] === 0) {
                        const dx = tpx - state.player.x;
                        const dy = tpy - state.player.y;
                        const distSq = dx * dx + dy * dy;
                        if (distSq > maxDistSq) {
                            maxDistSq = distSq;
                            bestX = tpx;
                            bestY = tpy;
                            tpSuccess = true;
                        }
                    }
                }
                if (tpSuccess) {
                    e.teleportDestX = bestX;
                    e.teleportDestY = bestY;
                    audioManager.play3D('brain_hit_0', e.x, e.y, state.player.x, state.player.y);
                    e.state = 'TELEPORT_OUT';
                    e.frame = 0;
                    e.animTimer = 0;
                    e.teleportCooldown = 10.0;
                    console.log(`BRAIN TELEPORTING inside Arena/KillRoom to farthest point: ${bestX.toFixed(2)}, ${bestY.toFixed(2)}`);
                    return;
                }
            }
        } else {
            // Normal teleport logic when not in a Kill/Arena Room
            for (let attempt = 0; attempt < 20; attempt++) {
                const tpAngle = Math.random() * Math.PI * 2;
                const tpDist = 4.0 + Math.random() * 6.0;
                const tpx = state.player.x + Math.cos(tpAngle) * tpDist;
                const tpy = state.player.y + Math.sin(tpAngle) * tpDist;

                if (tpx > 1 && tpx < state.map.width - 2 && tpy > 1 && tpy < state.map.height - 2) {
                    if (state.map.data[Math.floor(tpy) * state.map.width + Math.floor(tpx)] === 0) {
                        e.teleportDestX = tpx;
                        e.teleportDestY = tpy;
                        audioManager.play3D('brain_hit_0', e.x, e.y, state.player.x, state.player.y);
                        e.state = 'TELEPORT_OUT';
                        e.frame = 0;
                        e.animTimer = 0;
                        e.teleportCooldown = 10.0;
                        tpSuccess = true;
                        console.log("BRAIN TELEPORTING (Normal)!");
                        break;
                    }
                }
            }
            if (tpSuccess) return;
        }
    }

    if (e.state === 'ATTACK') {
        e.animTimer += dt;
        if (e.animTimer > 0.2) {
            e.animTimer = 0;
            e.frame++;
            if (e.frame >= 3) {
                e.state = 'IDLE';
                e.frame = 0;
                const pDir = Math.atan2(dy, dx);

                // Brain burst: 3 projectiles from level 4+
                if (state.level >= 4) {
                    const spreadAngles = [-0.26, 0, 0.26]; // ~15 degrees
                    spreadAngles.forEach((offset, idx) => {
                        setTimeout(() => {
                            if (state.gameState !== 'PLAYING') return;
                            const fireDir = pDir + offset;
                            state.spawnProjectile(
                                e.x + Math.cos(fireDir) * 0.5,
                                e.y + Math.sin(fireDir) * 0.5,
                                fireDir,
                                'energyBall',
                                6.0,
                                50
                            );
                        }, idx * 300);
                    });
                } else {
                    state.spawnProjectile(
                        e.x + Math.cos(pDir) * 0.5,
                        e.y + Math.sin(pDir) * 0.5,
                        pDir,
                        'energyBall',
                        6.0,
                        50
                    );
                }
            }
        }
        return;
    }

    if (!e.sbTimer) e.sbTimer = Math.random() * 3 + 2;
    e.sbTimer -= dt;
    if (e.sbTimer <= 0) {
        if (ASSETS.audio.brain.sb.length > 0) {
            const idx = Math.floor(Math.random() * ASSETS.audio.brain.sb.length);
            audioManager.play3D(`brain_sb_${idx}`, e.x, e.y, state.player.x, state.player.y);
        }
        e.sbTimer = Math.random() * 4 + 3;
    }

    if (dist < 12) {
        if (dist < 2 && dist > 0.1) {
            const speed = 2.5 * dt * speedScale;
            const moveX = -(dx / dist) * speed;
            const moveY = -(dy / dist) * speed;

            const nx = e.x + moveX;
            if (!checkCollision(nx, e.y, 0.3)) {
                e.x = nx;
            }

            const ny = e.y + moveY;
            if (!checkCollision(e.x, ny, 0.3)) {
                e.y = ny;
            }
        }

        const attackCooldownLimit = Math.max(1.5, 4.0 * (1 - Math.min(state.level * CONFIG.enemyAttackCooldownReduction, 0.5)));
        if (e.attackTimer > attackCooldownLimit) {
            e.state = 'ATTACK';
            e.frame = 0;
            e.animTimer = 0;
            e.attackTimer = 0;
            if (ASSETS.audio.brain.attack.length > 0) {
                const idx = Math.floor(Math.random() * ASSETS.audio.brain.attack.length);
                audioManager.play3D(`brain_attack_${idx}`, e.x, e.y, state.player.x, state.player.y);
            }
        }

        e.animTimer += dt;
        if (e.animTimer > 0.2) {
            e.animTimer = 0;
            e.frame = (e.frame + 1) % 3;
        }
    }
}

function updateGecoAI(e, dist, dx, dy, dt, speedScale) {
    if (!e.climbCooldown) e.climbCooldown = 0;
    if (e.climbCooldown > 0) e.climbCooldown -= dt;

    if (e.isClimbing) {
        e.climbTimer -= dt;
        if (e.climbTimer <= 0) {
            e.isClimbing = false;
            console.log("GECO CLIMBED DOWN!");
        }
    }

    if (!e.isClimbing && e.climbCooldown <= 0 && dist < 8.0 && Math.random() < dt * 0.25) {
        e.isClimbing = true;
        e.climbTimer = 3.0;
        e.climbCooldown = 10.0;
        if (ASSETS.audio.geco.sb.length > 0) {
            audioManager.play3D('geco_sb_0', e.x, e.y, state.player.x, state.player.y);
        }
        console.log("GECO CLIMBED UP (SEMI-TRANSPARENT)!");
    }

    // Handle HIDING state (ambush Gecos that start hidden)
    if (e.state === 'HIDING') {
        if (dist < 4.0) {
            // Player got close — ambush!
            e.state = 'IDLE';
            e.isClimbing = false;
            if (ASSETS.audio.geco.sb.length > 0) {
                const idx = Math.floor(Math.random() * ASSETS.audio.geco.sb.length);
                audioManager.play3D(`geco_sb_${idx}`, e.x, e.y, state.player.x, state.player.y);
            }
            console.log("GECO AMBUSH! Jumped from HIDING");
        } else {
            // Stay hidden and immobile
            return;
        }
    }

    if (dist > 6.0) {
        const hasLOS = checkLineOfSight(e.x, e.y, state.player.x, state.player.y);
        const target = getNavigationTarget(e, hasLOS, dist, dt);
        moveEnemyTowardsTarget(e, target.x, target.y, 2.5 * speedScale, dt);
    }

    if (!e.attackTimer) e.attackTimer = 2.0 + Math.random() * 5.0;
    e.attackTimer -= dt;

    if (e.attackTimer <= 0) {
        const baseCooldown = 9.0 + Math.random() * 2.0;
        e.attackTimer = baseCooldown * (1 - Math.min(state.level * CONFIG.enemyAttackCooldownReduction, 0.5));
        e.state = 'ATTACK';
        e.frame = 0;
        e.animTimer = 0;
        if (ASSETS.audio.geco.attack.length > 0) {
            const idx = Math.floor(Math.random() * ASSETS.audio.geco.attack.length);
            audioManager.play3D(`geco_attack_${idx}`, e.x, e.y, state.player.x, state.player.y);
        }
    }

    if (!e.sbTimer) e.sbTimer = Math.random() * 3 + 2;
    e.sbTimer -= dt;
    if (e.sbTimer <= 0) {
        if (ASSETS.audio.geco.sb.length > 0) {
            const idx = Math.floor(Math.random() * ASSETS.audio.geco.sb.length);
            audioManager.play3D(`geco_sb_${idx}`, e.x, e.y, state.player.x, state.player.y);
        }
        e.sbTimer = Math.random() * 4 + 3;
    }

    if (e.state === 'ATTACK') {
        e.animTimer += dt;
        if (e.animTimer > 0.2) {
            e.animTimer = 0;
            e.frame++;
            if (e.frame >= 3) {
                const pDir = Math.atan2(dy, dx);
                state.spawnProjectile(
                    e.x + Math.cos(pDir) * 0.5,
                    e.y + Math.sin(pDir) * 0.5,
                    pDir,
                    'gecoInkBall',
                    6.0,
                    10
                );

                e.state = 'IDLE';
                e.frame = 0;
            }
        }
    }
}

// --- UPDATE SUB-FUNCTIONS ---

function updatePlayerMovement(dt) {
    if (state.keys['ArrowLeft']) state.player.dir -= CONFIG.rotSpeed * dt;
    if (state.keys['ArrowRight']) state.player.dir += CONFIG.rotSpeed * dt;

    let inputMove = 0, inputStrafe = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp']) inputMove += 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) inputMove -= 1;
    if (state.keys['KeyA']) inputStrafe -= 1;
    if (state.keys['KeyD']) inputStrafe += 1;

    let wishDirX = 0;
    let wishDirY = 0;

    if (inputMove !== 0 || inputStrafe !== 0) {
        const cos = Math.cos(state.player.dir);
        const sin = Math.sin(state.player.dir);

        wishDirX = cos * inputMove - sin * inputStrafe;
        wishDirY = sin * inputMove + cos * inputStrafe;

        const len = Math.sqrt(wishDirX * wishDirX + wishDirY * wishDirY);
        if (len > 0) {
            wishDirX /= len;
            wishDirY /= len;
        }
    }

    const targetSpeed = (state.keys['ShiftLeft'] || state.keys['ShiftRight']) && !state.player.staminaDepleted
        ? CONFIG.playerMaxSpeed * CONFIG.playerRunMultiplier
        : CONFIG.playerMaxSpeed;
    const currentSpeed = Math.sqrt(state.player.vx * state.player.vx + state.player.vy * state.player.vy);

    const speedDrop = currentSpeed * CONFIG.playerFriction * dt;
    let newSpeed = currentSpeed - speedDrop;
    if (newSpeed < 0) newSpeed = 0;
    if (currentSpeed > 0) {
        const scale = newSpeed / currentSpeed;
        state.player.vx *= scale;
        state.player.vy *= scale;
    }

    if (inputMove !== 0 || inputStrafe !== 0) {
        let accel = CONFIG.playerAccel;
        if (inputMove === 0 && inputStrafe !== 0) {
            accel = state.keys['ShiftLeft'] ? CONFIG.playerRunStrafeAccel : CONFIG.playerStrafeAccel;
        }
        state.player.vx += wishDirX * accel * dt;
        state.player.vy += wishDirY * accel * dt;
    }

    if (currentSpeed > 0.1) {
        state.player.bobbing += dt * 10 * (currentSpeed / 3.0);
    }

    const finalSpeed = Math.sqrt(state.player.vx * state.player.vx + state.player.vy * state.player.vy);
    if (finalSpeed > targetSpeed) {
        const scale = targetSpeed / finalSpeed;
        state.player.vx *= scale;
        state.player.vy *= scale;
    }

    let nextX = state.player.x + state.player.vx * dt;
    const nextXCell = state.map.data[Math.floor(state.player.y) * state.map.width + Math.floor(nextX)];
    if (nextXCell <= 0 && !checkItemCollision(nextX, state.player.y, 0.45)) {
        state.player.x = nextX;
        if (nextXCell === -1) {
            const sx = Math.floor(nextX);
            const sy = Math.floor(state.player.y);
            state.map.data[sy * state.map.width + sx] = 0;
            const sw = state.secretWalls.find(s => s.x === sx && s.y === sy);
            if (sw) { sw.discovered = true; console.log("SECRET WALL DISCOVERED!"); }
        }
    } else {
        state.player.vx = 0;
    }

    let nextY = state.player.y + state.player.vy * dt;
    const nextYCell = state.map.data[Math.floor(nextY) * state.map.width + Math.floor(state.player.x)];
    if (nextYCell <= 0 && !checkItemCollision(state.player.x, nextY, 0.45)) {
        state.player.y = nextY;
        if (nextYCell === -1) {
            const sx = Math.floor(state.player.x);
            const sy = Math.floor(nextY);
            state.map.data[sy * state.map.width + sx] = 0;
            const sw = state.secretWalls.find(s => s.x === sx && s.y === sy);
            if (sw) { sw.discovered = true; console.log("SECRET WALL DISCOVERED!"); }
        }
    } else {
        state.player.vy = 0;
    }

    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const viewRadius = 8;
    for (let y = py - viewRadius; y <= py + viewRadius; y++) {
        for (let x = px - viewRadius; x <= px + viewRadius; x++) {
            if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
                state.map.visited[y * state.map.width + x] = 1;
            }
        }
    }

    // --- STAMINA SYSTEM ---
    const isSprinting = (state.keys['ShiftLeft'] || state.keys['ShiftRight']) && (inputMove !== 0 || inputStrafe !== 0);
    if (isSprinting && !state.player.staminaDepleted) {
        state.player.stamina -= CONFIG.playerStaminaDrain * dt;
        if (state.player.stamina <= 0) {
            state.player.stamina = 0;
            state.player.staminaDepleted = true;
            state.player.staminaCooldown = CONFIG.playerStaminaCooldown;
        }
    } else {
        if (state.player.staminaDepleted) {
            state.player.staminaCooldown -= dt;
            if (state.player.staminaCooldown <= 0) {
                state.player.staminaDepleted = false;
            }
        } else {
            state.player.stamina = Math.min(CONFIG.playerStamina, state.player.stamina + CONFIG.playerStaminaRegen * dt);
        }
    }

    // Update stamina HUD bar
    const staminaBarEl = document.getElementById('stamina-bar');
    if (staminaBarEl) {
        const pct = Math.max(0, Math.min(100, (state.player.stamina / CONFIG.playerStamina) * 100));
        staminaBarEl.style.width = pct + '%';
        if (state.player.staminaDepleted) {
            staminaBarEl.classList.add('depleted');
        } else {
            staminaBarEl.classList.remove('depleted');
        }
    }
}


function updateWeaponLogic(dt) {
    if (state.keys['Digit1']) switchWeapon(0);
    if (state.keys['Digit2']) {
        const current = state.player.weaponIndex;
        if (current === 1) {
            if (state.player.weapons[7].unlocked) switchWeapon(7);
        } else if (current === 7) {
            switchWeapon(1);
        } else {
            if (state.player.weapons[1].unlocked) switchWeapon(1);
            else if (state.player.weapons[7].unlocked) switchWeapon(7);
        }
    }
    if (state.keys['Digit3']) switchWeapon(2);
    if (state.keys['Digit4']) switchWeapon(3);
    if (state.keys['Digit5']) switchWeapon(5);
    if (state.keys['Digit6']) switchWeapon(6);

    if (state.mouseLeft) {
        shoot();
    }

    const currentWeapon = state.player.weapons[state.player.weaponIndex];

    if (currentWeapon.name === 'CHAINGUN') {
        if (state.mouseLeft) {
            state.player.machineGunHeat = Math.min(5.0, state.player.machineGunHeat + dt);
        } else {
            state.player.machineGunHeat = Math.max(0, state.player.machineGunHeat - dt * 2);
        }
        if (state.player.machineGunHeat > 4.0) {
            state.player.machineGunOverheated = true;
        } else {
            state.player.machineGunOverheated = false;
        }
    } else {
        state.player.machineGunHeat = Math.max(0, state.player.machineGunHeat - dt);
        if (state.player.machineGunHeat < 4.0) state.player.machineGunOverheated = false;
    }

    if (currentWeapon.name === 'HEAVYMACHINEGUN') {
        if (state.mouseLeft) {
            state.player.heavyMachineGunHeat = Math.min(5.0, state.player.heavyMachineGunHeat + dt);
        } else {
            state.player.heavyMachineGunHeat = Math.max(0, state.player.heavyMachineGunHeat - dt * 2);
        }
        if (state.player.heavyMachineGunHeat > 4.0) {
            state.player.heavyMachineGunOverheated = true;
        } else {
            state.player.heavyMachineGunOverheated = false;
        }
    } else {
        state.player.heavyMachineGunHeat = Math.max(0, state.player.heavyMachineGunHeat - dt);
        if (state.player.heavyMachineGunHeat < 4.0) state.player.heavyMachineGunOverheated = false;
    }

    if (currentWeapon.name === 'AUTOSHOTGUN') {
        if (state.mouseLeft) {
            state.player.autoShotgunHeat = Math.min(6.0, state.player.autoShotgunHeat + dt);
        } else {
            state.player.autoShotgunHeat = Math.max(0, state.player.autoShotgunHeat - dt * 1.66);
        }
        if (!state.mouseLeft && state.player.autoShotgunHeat > 5.0) {
            state.player.autoShotgunOverheated = true;
        }
        if (state.player.autoShotgunOverheated) {
            if (state.player.autoShotgunHeat <= 0) {
                state.player.autoShotgunOverheated = false;
            }
        }
    } else {
        state.player.autoShotgunHeat = Math.max(0, state.player.autoShotgunHeat - dt);
        state.player.autoShotgunOverheated = false;
    }

    if (state.player.laserState !== 'IDLE') {
        state.player.laserTimer += dt;

        if (state.player.laserState === 'CHARGING') {
            if (state.player.laserTimer >= 2.0) {
                state.player.laserState = 'FIRING';
                state.player.laserTimer = 0;
                audioManager.setLaserActive(true);
            }
        } else if (state.player.laserState === 'FIRING') {
            shootLaserFrame();

            if (state.player.laserTimer >= 6.0) {
                state.player.laserState = 'COOLDOWN';
                state.player.laserTimer = 0;
                audioManager.setLaserActive(false);
            }
        } else if (state.player.laserState === 'COOLDOWN') {
            if (state.player.laserTimer >= 15.0) {
                state.player.laserState = 'IDLE';
                state.player.laserTimer = 0;
            }
        }
    }
}

function updateEnemies(dt) {
    let speedScale = 1.0 + Math.min(state.level * CONFIG.enemySpeedScalePerLevel, CONFIG.enemySpeedScaleCap);

    // Director System (L4D style): Adjust speed scale based on player HP/Ammo tension
    const hp = state.player.health;
    const shotgunAmmo = state.player.ammo[1] || 0;
    const mgAmmo = state.player.ammo[2] || 0;
    const cannonAmmo = state.player.ammo[4] || 0;
    const isLowAmmo = shotgunAmmo < 5 && mgAmmo < 40 && cannonAmmo < 3;

    if (hp < 30 || (hp < 50 && isLowAmmo)) {
        speedScale *= 0.8; // High tension: slow down enemies slightly to give player a breather
    } else if (hp > 85 && !isLowAmmo) {
        speedScale *= 1.25; // Low tension: speed up enemies to keep the action intense
    }

    state.enemies.forEach(e => {
        // Enforce boundary limits inside active Arena/Kill Room
        if (e.hp > 0 && e.isKillRoomEnemy && state.killRoom.active) {
            const kr = state.killRoom.isArena ? state.rooms[state.killRoom.roomIndex] : state.killRoomCandidates[state.killRoom.roomIndex];
            if (kr) {
                const minX = kr.x + 1.2;
                const maxX = kr.x + kr.w - 1.2;
                const minY = kr.y + 1.2;
                const maxY = kr.y + kr.h - 1.2;
                if (e.x < minX || e.x > maxX || e.y < minY || e.y > maxY) {
                    e.x = Math.max(minX, Math.min(maxX, e.x));
                    e.y = Math.max(minY, Math.min(maxY, e.y));
                }
            }
        }

        // Anti-clipping damage: if stuck inside a wall, lose 15 HP/sec
        if (e.hp > 0 && state.map.data[Math.floor(e.y) * state.map.width + Math.floor(e.x)] > 0) {
            e.hp -= 15.0 * dt;
            if (e.hp <= 0) {
                if (e.type === 'brain' && Math.random() < 0.5) {
                    e.state = 'HIT_DEATH_V2';
                    e.hitTimer = 0.2;
                    e.deathTimer = 0.8;
                } else {
                    e.state = 'DOWN';
                    e.deathTimer = (e.type === 'soldier') ? 0.5 : 1.0;
                }
                if (e.isKillRoomEnemy) {
                    e.isKillRoomEnemy = false;
                    if (state.killRoom && state.killRoom.active) {
                        state.killRoom.timer = 0;
                    }
                }
                state.player.kills++;
                state.player.totalKills++;
                if (state.player.killsByType[e.type] !== undefined) {
                    state.player.killsByType[e.type]++;
                }
                const dropConfig = CONFIG.dropChances[e.type];
                if (dropConfig && Math.random() < dropConfig.chance) {
                    state.items.push({ x: e.x, y: e.y, type: dropConfig.type });
                }
                let scoreAwarded = 0;
                if (e.type === 'soldier') scoreAwarded = 100;
                else if (e.type === 'soldierB') scoreAwarded = 175;
                else if (e.type === 'monster' || e.type === 'monsterB2') scoreAwarded = 150;
                else if (e.type === 'geco') scoreAwarded = 200;
                else if (e.type === 'brain') scoreAwarded = 300;
                state.player.score += scoreAwarded;

                let coinsAwarded = 0;
                if (e.type === 'soldier' || e.type === 'soldierB' || e.type === 'monster' || e.type === 'monsterB2') coinsAwarded = 2;
                else if (e.type === 'geco') coinsAwarded = 5;
                else if (e.type === 'brain') coinsAwarded = 15;
                state.player.coins += coinsAwarded;
                state.player.totalCoinsEarned += coinsAwarded;

                updateHUD();
                console.log(`Enemy ${e.type} died from wall clipping!`);
            }
        }

        if (!e.vx) e.vx = 0;
        if (!e.vy) e.vy = 0;

        const eSpeed = Math.sqrt(e.vx * e.vx + e.vy * e.vy);
        if (eSpeed > 0) {
            const drop = eSpeed * CONFIG.enemyKnockbackFriction * dt;
            let newESpeed = eSpeed - drop;
            if (newESpeed < 0) newESpeed = 0;
            const scale = newESpeed / eSpeed;
            e.vx *= scale;
            e.vy *= scale;

            const nextEX = e.x + e.vx * dt;
            if (!checkCollision(nextEX, e.y, 0.3)) e.x = nextEX;
            else e.vx = 0;

            const nextEY = e.y + e.vy * dt;
            if (!checkCollision(e.x, nextEY, 0.3)) e.y = nextEY;
            else e.vy = 0;
        }

        if (e.state === 'FLOOR' || e.state === 'FLOOR_FIRE_2' || e.state === 'FLOOR_SHOTGUN' || e.state === 'FLOOR_V2') return;

        if (e.state === 'DOWN') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) e.state = 'FLOOR';
            return;
        }

        if (e.state === 'DOWN_V2') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) e.state = 'FLOOR_V2';
            return;
        }

        if (e.state === 'DOWN_SHOTGUN') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) e.state = 'FLOOR_SHOTGUN';
            return;
        }

        if (e.state === 'HIT_DEATH_V2') {
            e.hitTimer -= dt;
            if (e.hitTimer <= 0) {
                e.state = 'DOWN_V2';
                e.deathTimer = 0.8;
            }
            return;
        }

        if (e.state === 'HIT') {
            e.hitTimer -= dt;
            if (e.hitTimer <= 0) e.state = 'IDLE';
            return;
        }

        if (e.state === 'HIT_SHOTGUN') {
            e.hitTimer -= dt;
            if (e.hitTimer <= 0) {
                e.state = 'DOWN_SHOTGUN';
                e.deathTimer = (e.type === 'soldier') ? 0.1 : 0.2;
            }
            return;
        }

        if (e.state === 'HIT_FIRE') {
            e.animTimer += dt;
            if (e.animTimer > 0.4) {
                e.animTimer = 0;
                e.frame++;
                if (e.frame >= 3) {
                    e.state = 'FLOOR_FIRE_1';
                    e.deathTimer = 1.0;
                }
            }
            return;
        }

        if (e.state === 'HIT_LASER') {
            e.animTimer += dt;
            if (e.animTimer > 0.4) {
                e.animTimer = 0;
                e.state = 'FLOOR_FIRE_1';
                e.deathTimer = 1.0;
            }
            return;
        }

        if (e.state === 'FLOOR_FIRE_1') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) e.state = 'FLOOR_FIRE_2';
            return;
        }

        if (e.state === 'FLOOR_FIRE_2') return;

        const dx = state.player.x - e.x;
        const dy = state.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (e.type === 'brain') {
            updateBrainAI(e, dist, dx, dy, dt, speedScale);
        } else if (e.type === 'geco') {
            updateGecoAI(e, dist, dx, dy, dt, speedScale);
        } else if (e.type === 'monster' || e.type === 'monsterB2') {
            updateMonsterAI(e, dist, dx, dy, dt, speedScale);
        } else {
            updateZombieAI(e, dist, dx, dy, dt, speedScale);
        }
    });
}

function updateNPCs(dt) {
    state.npcs.forEach(npc => {
        const dx = state.player.x - npc.x;
        const dy = state.player.y - npc.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        npc.animTimer += dt;
        if (npc.animTimer > 1) {
            npc.animTimer = 0;
            npc.frame = (npc.frame + 1) % 4;
        }

        const shopMenu = document.getElementById('shop-menu');
        const prompt = document.getElementById('interaction-prompt');

        if (dist < 2.5) {
            if (state.gameState === 'PLAYING') {
                if (prompt) prompt.classList.remove('hidden');

                if (state.keys['KeyE']) {
                    console.log("Interaction: Key E pressed. Opening shop...");
                    if (shopMenu) {
                        shopMenu.classList.remove('hidden');
                        updateShopUI();
                        console.log("Interaction: Shop menu class 'hidden' removed and UI updated.");
                    } else {
                        console.error("Interaction: Shop menu element not found!");
                    }
                    if (prompt) prompt.classList.add('hidden');
                    document.exitPointerLock();
                    state.gameState = 'SHOP';
                    console.log("Interaction: Game state set to SHOP.");
                    state.keys['KeyE'] = false;
                }
            }
        } else {
            if (prompt) prompt.classList.add('hidden');

            if (shopMenu && !shopMenu.classList.contains('hidden')) {
                shopMenu.classList.add('hidden');
                if (state.gameState === 'SHOP') state.gameState = 'PLAYING';
                if (document.pointerLockElement !== canvas) {
                    canvas.requestPointerLock();
                }
            }
        }
    });
}

function updateItemPickups(dt) {
    for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        const dx = state.player.x - item.x;
        const dy = state.player.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (item.type === 'arenaTrigger' && !item.activated && dist < 1.5) {
            item.activated = true;
            activateArenaRoom(item.roomIdx);
            continue;
        }

        if (dist < 0.5) {
            if (item.type === 'ammoShotgun') {
                state.player.ammo[1] += 4;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('fx_ammo_shotgun');
            } else if (item.type === 'ammoMachinegun') {
                state.player.ammo[2] += 20;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('fx_ammo_machinegun');
            } else if (item.type === 'ammoCannon') {
                state.player.ammo[4] += 3;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('fx_ammo_cannon');
            } else if (item.type === 'heavymachinegunPickup') {
                state.player.weapons[5].unlocked = true;
                state.player.ammo[5] = 1000;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('heavymachinegun_pickup');
                switchWeapon(5);
            } else if (item.type === 'addLife') {
                state.player.health = Math.min(100, state.player.health + 20);
                state.items.splice(i, 1);
                updateHUD();
            } else if (item.type === 'coin_small_pile') {
                state.player.coins += 15;
                state.player.totalCoinsEarned += 15;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('fx_crystal');
            } else if (item.type === 'coin_big_pile') {
                state.player.coins += 30;
                state.player.totalCoinsEarned += 30;
                state.items.splice(i, 1);
                updateHUD();
                audioManager.play('fx_crystal');
            } else if (item.type === 'totemRed') {
                state.player.inventory.red = true;
                state.items.splice(i, 1);
                console.log('Got Red Totem');
                audioManager.play('fx_crystal');
            } else if (item.type === 'totemGreen') {
                state.player.inventory.green = true;
                state.items.splice(i, 1);
                console.log('Got Green Totem');
                audioManager.play('fx_crystal');
            } else if (item.type === 'totemBlue') {
                state.player.inventory.blue = true;
                state.items.splice(i, 1);
                console.log('Got Blue Totem');
                audioManager.play('fx_crystal');
            } else if (item.isGoal) {
                if (state.player.inventory.red && state.player.inventory.green && state.player.inventory.blue) {
                    if (item.type !== 'totemFull') {
                        item.type = 'totemFull';
                        console.log('All Totems Placed! Level Complete...');
                        audioManager.play('fx_totem_end');

                        // Calculate secondary objectives completed
                        const completedKillRooms = (state.killRoomCandidates || []).filter(kr => kr.completed).length;
                        const completedTotemGuardians = (state.totemGuardians || []).filter(tg => tg.activated && tg.enemies.every(e => e.hp <= 0)).length;
                        const completedSecretWalls = (state.secretWalls || []).filter(sw => sw.discovered).length;
                        const totalSecondaryObjectives = completedKillRooms + completedTotemGuardians + completedSecretWalls;

                        const bonusCoins = 50 + 25 * totalSecondaryObjectives;
                        state.player.coins += bonusCoins;
                        state.player.totalCoinsEarned += bonusCoins;

                        // Heal player +25 HP (cap at 100)
                        state.player.health = Math.min(100, state.player.health + 25);

                        // Store rewards info for the UI
                        state.lastLevelRewards = {
                            objectives: totalSecondaryObjectives,
                            coins: bonusCoins
                        };

                        updateHUD();

                        let countdown = 3;
                        const notif = document.getElementById('level-notification');
                        notif.style.opacity = 1;
                        notif.innerText = `TELETRANSPORT IN ${countdown}...`;

                        const interval = setInterval(() => {
                            countdown--;
                            if (countdown > 0) {
                                notif.innerText = `TELETRANSPORT IN ${countdown}...`;
                            } else {
                                clearInterval(interval);
                                notif.style.opacity = 0;
                                state.gameState = 'MENU';
                                const uiLayer = document.getElementById('ui-layer');
                                if (uiLayer) uiLayer.classList.add('hidden');
                                const mobileOverlay = document.getElementById('mobile-controls');
                                if (mobileOverlay) mobileOverlay.classList.add('hidden');
                                if (!state.mobileMode) document.exitPointerLock();
                                document.getElementById('menus').classList.remove('hidden');
                                document.getElementById('level-complete-screen').classList.remove('hidden');

                                document.getElementById('level-kills').innerText = state.player.kills;
                                const time = Math.floor((Date.now() - state.levelStartTime) / 1000);
                                const mins = Math.floor(time / 60).toString().padStart(2, '0');
                                const secs = (time % 60).toString().padStart(2, '0');
                                document.getElementById('level-time').innerText = `${mins}:${secs}`;

                                // Update level complete rewards UI
                                const rewards = state.lastLevelRewards || { objectives: 0, coins: 50 };
                                const objCompEl = document.getElementById('level-objectives-completed');
                                if (objCompEl) objCompEl.innerText = `Objectives Completed: ${rewards.objectives}`;

                                const bonusCoinsEl = document.getElementById('level-bonus-coins');
                                if (bonusCoinsEl) bonusCoinsEl.innerText = `Bonus Coins: +${rewards.coins} 🪙`;

                                const bonusHealthEl = document.getElementById('level-bonus-health');
                                if (bonusHealthEl) bonusHealthEl.innerText = `Health Healed: +25 HP ❤️`;
                            }
                        }, 1000);
                    }
                }
            }
        }
    }
}

function updateWeaponAnimation(dt) {
    if (state.player.animState === 'FIRING') {
        state.player.animTimer += dt * 3.0; // Restore baseline V0.5.1 speed (reverses slowing effect of removing duplicated code)
        const weapon = state.player.weapons[state.player.weaponIndex];
        if (state.player.animTimer > weapon.animSpeed) {
            state.player.animTimer = 0;
            state.player.animFrame++;
            if (state.player.animFrame >= 4) {
                state.player.animState = 'IDLE';
                state.player.animFrame = 0;
            }
            updateHUD();
        }
    } else if (state.player.animState === 'SWITCHING_DOWN') {
        state.player.animTimer += dt * 3.0; // Restore baseline V0.5.1 switching speed
        if (state.player.animTimer > 0.2) {
            state.player.weaponIndex = state.player.nextWeaponIndex;
            state.player.animState = 'SWITCHING_UP';
            state.player.animTimer = 0;
            updateHUD();

            const weaponEl = document.getElementById('weapon-sprite');
            weaponEl.style.transition = 'transform 0.2s ease-out';
            weaponEl.style.transform = 'translateY(0)';
        }
    } else if (state.player.animState === 'SWITCHING_UP') {
        state.player.animTimer += dt * 3.0; // Restore baseline V0.5.1 switching speed
        if (state.player.animTimer > 0.2) {
            state.player.animState = 'IDLE';
            const weaponEl = document.getElementById('weapon-sprite');
            weaponEl.style.transition = 'none';
        }
    } else {
        const weapon = state.player.weapons[state.player.weaponIndex];
        if (weapon.name === 'SONAR') {
            updateHUD();
        }
    }
}

function updateDecalsAndMarkers(dt) {
    for (let i = state.decals.length - 1; i >= 0; i--) {
        state.decals[i].time -= dt;
        if (state.decals[i].time <= 0) state.decals.splice(i, 1);
    }
    if (state.decals.length > 50) {
        state.decals.splice(0, state.decals.length - 50);
    }
    for (let i = state.hitMarkers.length - 1; i >= 0; i--) {
        state.hitMarkers[i].time -= dt;
        if (state.hitMarkers[i].time <= 0) state.hitMarkers.splice(i, 1);
    }
}

function updateProjectiles(dt) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];
        const moveDist = p.speed * dt;
        const newX = p.x + Math.cos(p.dir) * moveDist;
        const newY = p.y + Math.sin(p.dir) * moveDist;

        if (p.type === 'energyBall') {
            const dx = state.player.x - newX;
            const dy = state.player.y - newY;
            if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
                damagePlayer(p.damage);

                const force = 10.0;
                state.player.vx += Math.cos(p.dir) * force;
                state.player.vy += Math.sin(p.dir) * force;

                p.active = false;
                state.projectiles.splice(i, 1);
                continue;
            }

            // Check hit against other enemies (excluding brains to prevent self-collision)
            let hitEnemy = false;
            for (let e of state.enemies) {
                if (e.type === 'brain') continue; // Energy balls pass through other brains
                if (e.state === 'DOWN' || e.state === 'FLOOR' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2' || e.state === 'DOWN_SHOTGUN' || e.state === 'FLOOR_SHOTGUN' || e.state === 'HIT_SHOTGUN' || e.state === 'HIT_FIRE' || e.state.includes('V2')) continue;

                const edx = newX - e.x;
                const edy = newY - e.y;
                if (Math.sqrt(edx * edx + edy * edy) < 0.5) {
                    e.hp -= p.damage;

                    const force = 8.0;
                    if (!e.vx) e.vx = 0;
                    if (!e.vy) e.vy = 0;
                    e.vx += Math.cos(p.dir) * force;
                    e.vy += Math.sin(p.dir) * force;

                    if (e.hp <= 0) {
                        e.state = 'DOWN';
                        e.deathTimer = (e.type === 'soldier') ? 0.5 : 1.0;
                        if (e.isKillRoomEnemy) {
                            e.isKillRoomEnemy = false;
                            if (state.killRoom && state.killRoom.active) {
                                state.killRoom.timer = 0;
                            }
                        }
                        // Play death sound
                        if (e.type === 'monster') {
                            const idx = Math.floor(Math.random() * 3);
                            audioManager.play3D(`monster_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
                        } else if (e.type === 'geco') {
                            if (ASSETS.audio.geco.death.length > 0) {
                                const idx = Math.floor(Math.random() * ASSETS.audio.geco.death.length);
                                audioManager.play3D(`geco_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
                            }
                        } else {
                            const idx = Math.floor(Math.random() * 2);
                            audioManager.play3D(`zombie_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
                        }
                    } else {
                        e.state = 'HIT';
                        e.hitTimer = 0.2;

                        // Play hit sound
                        if (e.type === 'monster') {
                            const idx = Math.floor(Math.random() * 5);
                            audioManager.play3D(`monster_hit_${idx}`, e.x, e.y, state.player.x, state.player.y);
                        } else if (e.type === 'geco') {
                            if (ASSETS.audio.geco.hit && ASSETS.audio.geco.hit.length > 0) {
                                const idx = Math.floor(Math.random() * ASSETS.audio.geco.hit.length);
                                audioManager.play3D(`geco_hit_${idx}`, e.x, e.y, state.player.x, state.player.y);
                            }
                        } else {
                            const idx = Math.floor(Math.random() * 6);
                            audioManager.play3D(`zombie_hit_${idx}`, e.x, e.y, state.player.x, state.player.y);
                        }
                    }
                    hitEnemy = true;
                    break;
                }
            }

            if (hitEnemy) {
                state.explosions.push({
                    x: newX, y: newY,
                    frame: 0, timer: 0,
                    type: 'wall'
                });
                p.active = false;
                state.projectiles.splice(i, 1);
                continue;
            }
        }

        if (p.type === 'gecoInkBall') {
            const dx = state.player.x - newX;
            const dy = state.player.y - newY;
            if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
                damagePlayer(p.damage, 'geco');
                state.player.inkBlindnessTimer = 5.0;

                const force = 8.0;
                state.player.vx += Math.cos(p.dir) * force;
                state.player.vy += Math.sin(p.dir) * force;

                p.active = false;
                state.projectiles.splice(i, 1);
                continue;
            }
        }

        if (state.map.data[Math.floor(newY) * state.map.width + Math.floor(newX)] > 0) {
            // --- Step back to find exact wall surface contact point ---
            // Binary-search between p.x/p.y (last safe position) and newX/newY (inside wall)
            let hitX = p.x;
            let hitY = p.y;
            {
                let lo = 0.0, hi = 1.0;
                for (let iter = 0; iter < 8; iter++) {
                    const mid = (lo + hi) * 0.5;
                    const mx = p.x + (newX - p.x) * mid;
                    const my = p.y + (newY - p.y) * mid;
                    if (state.map.data[Math.floor(my) * state.map.width + Math.floor(mx)] > 0) {
                        hi = mid;
                    } else {
                        lo = mid;
                        hitX = mx;
                        hitY = my;
                    }
                }
            }

            // Determine which wall face was hit (side=0 → X-face, side=1 → Y-face)
            const wallMapX = Math.floor(newX);
            const wallMapY = Math.floor(newY);
            const prevMapX = Math.floor(hitX);
            const prevMapY = Math.floor(hitY);
            let side = 0;
            let wallX = 0;
            if (prevMapX !== wallMapX) {
                // Hit an X-aligned face: texture coord is the fractional Y
                side = 0;
                wallX = hitY - Math.floor(hitY);
            } else {
                // Hit a Y-aligned face: texture coord is the fractional X
                side = 1;
                wallX = hitX - Math.floor(hitX);
            }

            // Check destructible wall hit
            const cellVal = state.map.data[wallMapY * state.map.width + wallMapX];
            if (cellVal === CONFIG.destructibleWallTexIndex) {
                if (p.type === 'fireball') {
                    state.map.data[wallMapY * state.map.width + wallMapX] = 0;
                    audioManager.play3D('cannon_fire_0', wallMapX + 0.5, wallMapY + 0.5, state.player.x, state.player.y);
                    for (let j = 0; j < 15; j++) {
                        const pAngle = Math.random() * Math.PI * 2;
                        const spd = 2.0 + Math.random() * 4.0;
                        state.particles.push({
                            wX: wallMapX + 0.5, wY: wallMapY + 0.5,
                            x: 0, y: 0,
                            vx: Math.cos(pAngle) * spd,
                            vy: Math.sin(pAngle) * spd - 1.0,
                            life: CONFIG.bloodParticleLife * (0.8 + Math.random() * 0.6),
                            maxLife: CONFIG.bloodParticleLife,
                            size: 1 + Math.random() * 3,
                            color: 'rgb(80, 80, 80)'
                        });
                    }
                    console.log(`CRACKED WALL DESTROYED by Cannon at ${wallMapX}, ${wallMapY}`);
                }
            }

            state.explosions.push({
                x: hitX, y: hitY,
                frame: 0, timer: 0,
                type: 'wall'
            });

            state.decals.push({
                mapX: wallMapX, mapY: wallMapY, side: side,
                wallX: wallX,
                texIndex: -1,
                isFireball: true,
                time: 30.0
            });

            // --- Cannon splash damage (radius = 2.5, passes through walls) ---
            if (p.type === 'fireball') {
                const splashRadius = 2.5;
                for (let se of state.enemies) {
                    if (se.state === 'DOWN' || se.state === 'FLOOR' || se.state === 'FLOOR_FIRE_1' || se.state === 'FLOOR_FIRE_2' || se.state === 'DOWN_SHOTGUN' || se.state === 'FLOOR_SHOTGUN' || se.state === 'HIT_SHOTGUN' || se.state === 'HIT_FIRE' || se.state.includes('V2')) continue;
                    const sdx = hitX - se.x;
                    const sdy = hitY - se.y;
                    const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                    if (sdist < splashRadius) {
                        const falloff = 1.0 - sdist / splashRadius;
                        se.hp -= Math.round(p.damage * falloff);
                        if (!se.vx) se.vx = 0;
                        if (!se.vy) se.vy = 0;
                        if (sdist > 0) {
                            se.vx += (-sdx / sdist) * 8.0 * falloff;
                            se.vy += (-sdy / sdist) * 8.0 * falloff;
                        }
                        if (se.hp <= 0) {
                            se.state = 'HIT_FIRE';
                            se.frame = 0;
                            se.animTimer = 0;
                            state.player.kills++;
                        } else {
                            se.state = 'HIT';
                            se.hitTimer = 0.2;
                        }
                    }
                }
            }

            p.active = false;
            state.projectiles.splice(i, 1);
            continue;
        }

        let hitEnemy = false;
        if (p.type !== 'energyBall' && p.type !== 'gecoInkBall') {
            for (let e of state.enemies) {
                if (e.state === 'DOWN' || e.state === 'FLOOR' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2' || e.state === 'DOWN_SHOTGUN' || e.state === 'FLOOR_SHOTGUN' || e.state === 'HIT_SHOTGUN' || e.state === 'HIT_FIRE' || e.state.includes('V2')) continue;
                const dx = newX - e.x;
                const dy = newY - e.y;
                if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
                    e.hp -= p.damage;

                    const force = 12.0;
                    const kx = Math.cos(p.dir);
                    const ky = Math.sin(p.dir);

                    if (!e.vx) e.vx = 0;
                    if (!e.vy) e.vy = 0;

                    e.vx += kx * force;
                    e.vy += ky * force;

                    // --- Cannon splash damage on direct enemy hit ---
                    if (p.type === 'fireball') {
                        const splashRadius = 2.5;
                        for (let se of state.enemies) {
                            if (se === e) continue; // Already damaged directly
                            if (se.state === 'DOWN' || se.state === 'FLOOR' || se.state === 'FLOOR_FIRE_1' || se.state === 'FLOOR_FIRE_2' || se.state === 'DOWN_SHOTGUN' || se.state === 'FLOOR_SHOTGUN' || se.state === 'HIT_SHOTGUN' || se.state === 'HIT_FIRE' || se.state.includes('V2')) continue;
                            const sdx = newX - se.x;
                            const sdy = newY - se.y;
                            const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                            if (sdist < splashRadius) {
                                const falloff = 1.0 - sdist / splashRadius;
                                se.hp -= Math.round(p.damage * falloff);
                                if (!se.vx) se.vx = 0;
                                if (!se.vy) se.vy = 0;
                                if (sdist > 0) {
                                    se.vx += (-sdx / sdist) * 8.0 * falloff;
                                    se.vy += (-sdy / sdist) * 8.0 * falloff;
                                }
                                if (se.hp <= 0) {
                                    se.state = 'HIT_FIRE';
                                    se.frame = 0;
                                    se.animTimer = 0;
                                    if (se.isKillRoomEnemy) {
                                        se.isKillRoomEnemy = false;
                                        if (state.killRoom && state.killRoom.active) {
                                            state.killRoom.timer = 0;
                                        }
                                    }
                                    state.player.kills++;
                                } else {
                                    se.state = 'HIT';
                                    se.hitTimer = 0.2;
                                }
                            }
                        }
                        // Spawn explosion at impact point
                        state.explosions.push({ x: newX, y: newY, frame: 0, timer: 0, type: 'wall' });
                    }

                    if (e.hp <= 0) {
                        e.state = 'HIT_FIRE';
                        e.frame = 0;
                        e.animTimer = 0;
                        if (e.isKillRoomEnemy) {
                            e.isKillRoomEnemy = false;
                            if (state.killRoom && state.killRoom.active) {
                                state.killRoom.timer = 0;
                            }
                        }
                        state.player.kills++;
                        if (e.type === 'brain') {
                            if (ASSETS.audio.brain.hitFire.length > 0) {
                                const idx = Math.floor(Math.random() * ASSETS.audio.brain.hitFire.length);
                                audioManager.play3D(`brain_hit_fire_${idx}`, e.x, e.y, state.player.x, state.player.y);
                            }
                        } else if (e.type === 'geco') {
                            if (ASSETS.audio.geco.hitFire && ASSETS.audio.geco.hitFire.length > 0) {
                                const idx = Math.floor(Math.random() * ASSETS.audio.geco.hitFire.length);
                                audioManager.play3D(`geco_hit_fire_${idx}`, e.x, e.y, state.player.x, state.player.y);
                            }
                        }
                    } else {
                        e.state = 'HIT';
                        e.hitTimer = 0.2;
                    }
                    p.active = false;
                    state.projectiles.splice(i, 1);
                    hitEnemy = true;
                    break;
                }
            }
        }

        if (!hitEnemy) {
            p.x = newX;
            p.y = newY;
            p.animTimer += dt;
            if (p.animTimer > 0.1) {
                p.animTimer = 0;
                p.frame = (p.frame + 1) % 4;
            }
        }
    }
}

function updateExplosions(dt) {
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        const ex = state.explosions[i];
        ex.timer += dt;
        if (ex.timer > 0.1) {
            ex.timer = 0;
            ex.frame++;
            if (ex.frame >= 3) {
                state.explosions.splice(i, 1);
                updateHUD();
            }
        }
    }
}

function updateInkBlindness(dt) {
    if (state.player.inkBlindnessTimer > 0) {
        state.player.inkBlindnessTimer -= dt;
        const overlay = document.getElementById('ink-overlay');
        if (overlay) {
            if (state.player.inkBlindnessTimer > 2.0) {
                overlay.style.opacity = 1;
            } else {
                overlay.style.opacity = state.player.inkBlindnessTimer / 2.0;
            }
        }
    } else {
        const overlay = document.getElementById('ink-overlay');
        if (overlay) overlay.style.opacity = 0;
    }
}

function updateComboSystem(dt) {
    if (state.player.comboTimer > 0) {
        state.player.comboTimer -= dt;
        if (state.player.comboTimer <= 0) {
            state.player.comboCount = 0;
            state.player.comboMultiplier = 1;
            state.player.comboTimer = 0;
            const comboEl = document.getElementById('combo-display');
            if (comboEl) comboEl.style.opacity = 0;
        }
    }
}


function updateScreenShake(dt) {
    if (state.player.screenShakeIntensity > 0) {
        state.player.screenShakeIntensity -= CONFIG.screenShakeDecay * dt;
        if (state.player.screenShakeIntensity < 0) state.player.screenShakeIntensity = 0;
    }
}

function updateCrosshair(dt) {
    if (state.player.crosshairSpread > 0) {
        state.player.crosshairSpread -= dt * 3;
        if (state.player.crosshairSpread < 0) state.player.crosshairSpread = 0;
    }
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        const spread = 10 + state.player.crosshairSpread * 20;
        crosshair.style.width = spread + 'px';
        crosshair.style.height = spread + 'px';
    }
}

function updateKillRooms(dt) {
    if (state.killRoomCandidates) {
        for (const kr of state.killRoomCandidates) {
            if (kr.activated || kr.completed) continue;

            const px = state.player.x;
            const py = state.player.y;
            // Trigger kill room only when player gets closer to the middle of the room (at least 2 tiles inside)
            if (px >= kr.x + 2 && px <= kr.x + kr.w - 2 && py >= kr.y + 2 && py <= kr.y + kr.h - 2) {
                kr.activated = true;
                const indicator = state.items.find(item => item.type === 'killRoomIndicator' && item.killRoomIdx === kr.roomIdx);
                if (indicator) indicator.activated = true;
                state.killRoom.active = true;
                state.killRoom.wave = 1;
                state.killRoom.maxWaves = CONFIG.killRoomWavesBase + Math.floor(state.level / 3) * CONFIG.killRoomWavesPerLevel;
                state.killRoom.isArena = false;
                state.killRoom.roomIndex = state.killRoomCandidates.indexOf(kr);
                state.killRoom.timer = 0; // Reset survival timer

                const roomTilesSet = new Set(kr.tiles.map(t => `${t.x},${t.y}`));
                state.killRoom.sealedWalls = [];

                for (const tile of kr.tiles) {
                    const neighbors = [
                        { x: tile.x + 1, y: tile.y },
                        { x: tile.x - 1, y: tile.y },
                        { x: tile.x, y: tile.y + 1 },
                        { x: tile.x, y: tile.y - 1 }
                    ];
                    for (const n of neighbors) {
                        const key = `${n.x},${n.y}`;
                        if (!roomTilesSet.has(key)) {
                            const idx = n.y * state.map.width + n.x;
                            if (state.map.data[idx] === 0) {
                                state.map.data[idx] = 13;
                                state.killRoom.sealedWalls.push({ x: n.x, y: n.y });
                            }
                        }
                    }
                }

                // Push player inside the room if they are on a sealed wall or outside
                const pTileX = Math.floor(state.player.x);
                const pTileY = Math.floor(state.player.y);
                const onSealedWall = state.killRoom.sealedWalls.some(w => w.x === pTileX && w.y === pTileY);
                const insideRoom = roomTilesSet.has(`${pTileX},${pTileY}`);
                if (onSealedWall || !insideRoom) {
                    console.log("Player stuck or outside normal Kill Room on activation! Teleporting to center.");
                    state.player.x = kr.x + kr.w / 2;
                    state.player.y = kr.y + kr.h / 2;
                }

                // Push enemies inside the room to prevent getting stuck in sealed walls
                state.enemies.forEach(e => {
                    const ex = Math.floor(e.x);
                    const ey = Math.floor(e.y);
                    if (state.killRoom.sealedWalls.some(w => w.x === ex && w.y === ey)) {
                        e.x = kr.x + 2.0 + Math.random() * (kr.w - 4.0);
                        e.y = kr.y + 2.0 + Math.random() * (kr.h - 4.0);
                        console.log(`Nudged enemy ${e.type} inside the Kill Room.`);
                    }
                });

                const waveSize = 5 + state.level * 2;
                state.killRoom.enemiesRemaining = waveSize;

                for (let e = 0; e < waveSize; e++) {
                    const types = ['soldier', 'monster', 'monsterB2'];
                    if (state.level >= 3) types.push('soldierB', 'geco');
                    const type = types[Math.floor(Math.random() * types.length)];
                    const hp = type === 'monster' || type === 'monsterB2' ? 50 : 30;

                    state.enemies.push({
                        id: Math.random(),
                        x: kr.x + 1.2 + Math.random() * (kr.w - 2.4),
                        y: kr.y + 1.2 + Math.random() * (kr.h - 2.4),
                        type: type,
                        hp: hp + state.level * 5,
                        vx: 0, vy: 0,
                        state: 'IDLE',
                        frame: 0,
                        animTimer: 0,
                        isKillRoomEnemy: true
                    });
                }

                console.log(`KILL ROOM ACTIVATED! Wave ${state.killRoom.wave}/${state.killRoom.maxWaves}`);
                const notif = document.getElementById('level-notification');
                if (notif) {
                    notif.innerText = `⚔ KILL ROOM - WAVE ${state.killRoom.wave} ⚔`;
                    notif.style.opacity = 1;
                    setTimeout(() => { if (notif) notif.style.opacity = 0; }, 2000);
                }
            }
        }
    }

    if (state.killRoom.active) {
        if (state.killRoom.timer === undefined) state.killRoom.timer = 0;
        state.killRoom.timer += dt;

        // Count only active (alive) kill room enemies
        const killRoomEnemies = state.enemies.filter(e => e.isKillRoomEnemy && e.hp > 0);
        state.killRoom.enemiesRemaining = killRoomEnemies.length;

        // Safety fallback: unlock doors if 45 seconds (20 seconds for Arena) pass without a kill (or since wave start)
        const safetyTimeout = state.killRoom.isArena ? 20.0 : 45.0;
        if (state.killRoom.timer >= safetyTimeout) {
            console.log(`SAFETY UNLOCK: ${safetyTimeout} seconds passed without progress. Unlocking doors.`);

            // Decouple remaining enemies so they don't block progression
            state.enemies.forEach(e => {
                if (e.isKillRoomEnemy) e.isKillRoomEnemy = false;
            });

            state.killRoom.active = false;
            if (!state.killRoom.isArena) {
                const candidate = state.killRoomCandidates.find(k => k.activated && !k.completed);
                if (candidate) {
                    candidate.completed = true;
                    const indicator = state.items.find(item => item.type === 'killRoomIndicator' && item.killRoomIdx === candidate.roomIdx);
                    if (indicator) indicator.completed = true;
                }
            } else {
                // Spawn rewards for Arena so player doesn't lose them due to a bug
                const krIdx = state.killRoom.roomIndex;
                const kr = state.rooms[krIdx];
                if (kr) {
                    const cx = kr.x + kr.w / 2;
                    const cy = kr.y + kr.h / 2;
                    state.items.push({ x: cx - 1.0, y: cy + 1.5, type: 'addLife' });
                    state.items.push({ x: cx + 1.0, y: cy + 1.5, type: 'addLife' });
                    state.items.push({ x: cx - 0.5, y: cy + 2.5, type: 'ammoCannon' });
                    state.items.push({ x: cx + 0.5, y: cy + 2.5, type: 'ammoCannon' });
                    state.items.push({ x: cx - 1.5, y: cy + 2.5, type: 'ammoMachinegun' });
                    state.items.push({ x: cx + 1.5, y: cy + 2.5, type: 'ammoShotgun' });

                    // Spawn 3 small piles and 2 big piles
                    state.items.push({ x: cx - 1.0, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx + 1.0, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx - 0.5, y: cy + 1.0, type: 'coin_big_pile' });
                    state.items.push({ x: cx + 0.5, y: cy + 1.0, type: 'coin_big_pile' });
                    const rewardCoins = 100 + state.level * 20;
                    state.player.coins += rewardCoins;
                    state.player.totalCoinsEarned += rewardCoins;
                    state.player.health = Math.min(100, state.player.health + 50);
                }
            }

            if (state.killRoom.sealedWalls) {
                state.killRoom.sealedWalls.forEach(wall => {
                    state.map.data[wall.y * state.map.width + wall.x] = 0;
                });
                state.killRoom.sealedWalls = [];
            }

            const notif = document.getElementById('level-notification');
            if (notif) {
                notif.innerText = `🔓 DOORS UNLOCKED (SAFETY TIMEOUT) 🔓`;
                notif.style.opacity = 1;
                setTimeout(() => { if (notif) notif.style.opacity = 0; }, 3000);
            }
            return;
        }

        if (state.killRoom.enemiesRemaining <= 0) {
            if (state.killRoom.wave < state.killRoom.maxWaves) {
                state.killRoom.wave++;
                state.killRoom.timer = 0; // Reset timer for new wave
                const waveSize = 5 + state.level * 2 + state.killRoom.wave * 2;
                state.killRoom.enemiesRemaining = waveSize;

                const kr = state.killRoom.isArena ? state.rooms[state.killRoom.roomIndex] : state.killRoomCandidates.find(k => k.activated && !k.completed);
                if (kr) {
                    for (let e = 0; e < waveSize; e++) {
                        const types = state.killRoom.isArena ? ['geco', 'brain', 'monsterB2'] : ['soldier', 'monster', 'monsterB2', 'soldierB'];
                        if (state.killRoom.wave >= 2) types.push('brain');
                        const type = types[Math.floor(Math.random() * types.length)];
                        const hp = type === 'brain' ? 120 : (type.includes('monster') ? 60 : 40);

                        state.enemies.push({
                            id: Math.random(),
                            x: kr.x + 1.2 + Math.random() * (kr.w - 2.4),
                            y: kr.y + 1.2 + Math.random() * (kr.h - 2.4),
                            type: type,
                            hp: hp + state.level * 6,
                            vx: 0, vy: 0,
                            state: 'IDLE',
                            frame: 0,
                            animTimer: 0,
                            isKillRoomEnemy: true
                        });
                    }

                    console.log(`${state.killRoom.isArena ? 'ARENA' : 'KILL ROOM'} WAVE ${state.killRoom.wave}/${state.killRoom.maxWaves}`);
                    const notif = document.getElementById('level-notification');
                    if (notif) {
                        notif.innerText = `⚔ ${state.killRoom.isArena ? 'ARENA' : 'WAVE'} ${state.killRoom.wave}/${state.killRoom.maxWaves} ⚔`;
                        notif.style.opacity = 1;
                        setTimeout(() => { if (notif) notif.style.opacity = 0; }, 2000);
                    }
                }
            } else {
                state.killRoom.active = false;
                const krIdx = state.killRoom.roomIndex;
                const kr = state.rooms[krIdx];
                if (!state.killRoom.isArena) {
                    const candidate = state.killRoomCandidates.find(k => k.activated && !k.completed);
                    if (candidate) {
                        candidate.completed = true;
                        const indicator = state.items.find(item => item.type === 'killRoomIndicator' && item.killRoomIdx === candidate.roomIdx);
                        if (indicator) indicator.completed = true;
                    }
                }

                if (state.killRoom.sealedWalls) {
                    state.killRoom.sealedWalls.forEach(wall => {
                        state.map.data[wall.y * state.map.width + wall.x] = 0;
                    });
                    state.killRoom.sealedWalls = [];
                }

                if (state.killRoom.isArena) {
                    // Spawn premium loot at the center of the arena!
                    const cx = kr.x + kr.w / 2;
                    const cy = kr.y + kr.h / 2;

                    // Spawn high rewards (ammo and life cache)
                    state.items.push({ x: cx - 1.0, y: cy + 1.5, type: 'addLife' });
                    state.items.push({ x: cx + 1.0, y: cy + 1.5, type: 'addLife' });
                    state.items.push({ x: cx - 0.5, y: cy + 2.5, type: 'ammoCannon' });
                    state.items.push({ x: cx + 0.5, y: cy + 2.5, type: 'ammoCannon' });
                    state.items.push({ x: cx - 1.5, y: cy + 2.5, type: 'ammoMachinegun' });
                    state.items.push({ x: cx + 1.5, y: cy + 2.5, type: 'ammoShotgun' });

                    // Spawn 3 small piles and 2 big piles
                    state.items.push({ x: cx - 1.0, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx + 1.0, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx, y: cy + 0.5, type: 'coin_small_pile' });
                    state.items.push({ x: cx - 0.5, y: cy + 1.0, type: 'coin_big_pile' });
                    state.items.push({ x: cx + 0.5, y: cy + 1.0, type: 'coin_big_pile' });

                    const rewardCoins = 100 + state.level * 20;
                    state.player.coins += rewardCoins;
                    state.player.totalCoinsEarned += rewardCoins;
                    state.player.health = Math.min(100, state.player.health + 50);

                    console.log("VOLUNTARY ARENA COMPLETED! Loot spawned.");
                    const notif = document.getElementById('level-notification');
                    if (notif) {
                        notif.innerText = `🏆 ARENA COMPLETED! +${rewardCoins} 🪙 🏆`;
                        notif.style.opacity = 1;
                        setTimeout(() => { if (notif) notif.style.opacity = 0; }, 3000);
                    }
                } else {
                    const rewardCoins = 30 + state.level * 10;
                    state.player.coins += rewardCoins;
                    state.player.totalCoinsEarned += rewardCoins;
                    state.player.health = Math.min(100, state.player.health + 30);

                    console.log(`KILL ROOM COMPLETED! +${rewardCoins} coins, +30 health`);
                    const notif = document.getElementById('level-notification');
                    if (notif) {
                        notif.innerText = `✓ KILL ROOM CLEAR! +${rewardCoins} 🪙`;
                        notif.style.opacity = 1;
                        setTimeout(() => { if (notif) notif.style.opacity = 0; }, 3000);
                    }
                }
                updateHUD();
            }
        }
    }
}

function activateArenaRoom(roomIdx) {
    const r = state.rooms[roomIdx];
    if (!r) return;

    // Set up Arena in killRoom state
    state.killRoom.active = true;
    state.killRoom.isArena = true;
    state.killRoom.roomIndex = roomIdx;
    state.killRoom.wave = 1;
    state.killRoom.maxWaves = 3;
    state.killRoom.sealedWalls = [];
    state.killRoom.timer = 0; // Reset survival timer

    // Seal the room
    const roomTilesSet = new Set(r.tiles.map(t => `${t.x},${t.y}`));
    for (const tile of r.tiles) {
        const neighbors = [
            { x: tile.x + 1, y: tile.y },
            { x: tile.x - 1, y: tile.y },
            { x: tile.x, y: tile.y + 1 },
            { x: tile.x, y: tile.y - 1 }
        ];
        for (const n of neighbors) {
            const key = `${n.x},${n.y}`;
            if (!roomTilesSet.has(key)) {
                const idx = n.y * state.map.width + n.x;
                if (state.map.data[idx] === 0) {
                    state.map.data[idx] = 13; // Seal wall texture
                    state.killRoom.sealedWalls.push({ x: n.x, y: n.y });
                }
            }
        }
    }

    // Push player inside the room if they are on a sealed wall or outside
    const pTileX = Math.floor(state.player.x);
    const pTileY = Math.floor(state.player.y);
    const onSealedWall = state.killRoom.sealedWalls.some(w => w.x === pTileX && w.y === pTileY);
    const insideRoom = roomTilesSet.has(`${pTileX},${pTileY}`);
    if (onSealedWall || !insideRoom) {
        console.log("Player stuck or outside Arena Room on activation! Teleporting inside.");
        state.player.x = r.x + r.w / 2;
        state.player.y = r.y + r.h / 2 - 1.0; // Place them 1 tile north of center (in front of the pillar)
    }

    // Push enemies inside the room to prevent getting stuck in sealed walls
    state.enemies.forEach(e => {
        const ex = Math.floor(e.x);
        const ey = Math.floor(e.y);
        if (state.killRoom.sealedWalls.some(w => w.x === ex && w.y === ey)) {
            e.x = r.x + 2.0 + Math.random() * (r.w - 4.0);
            e.y = r.y + 2.0 + Math.random() * (r.h - 4.0);
            console.log(`Nudged enemy ${e.type} inside the Arena room.`);
        }
    });

    // Spawn first wave
    const waveSize = 6 + state.level * 2;
    state.killRoom.enemiesRemaining = waveSize;

    for (let e = 0; e < waveSize; e++) {
        const types = ['monster', 'monsterB2', 'geco'];
        if (state.level >= 2) types.push('brain');
        const type = types[Math.floor(Math.random() * types.length)];
        const hp = type === 'brain' ? 120 : (type.includes('monster') ? 60 : 40);

        state.enemies.push({
            id: Math.random(),
            x: r.x + 1.2 + Math.random() * (r.w - 2.4),
            y: r.y + 1.2 + Math.random() * (r.h - 2.4),
            type: type,
            hp: hp + state.level * 6,
            vx: 0, vy: 0,
            state: 'IDLE',
            frame: 0,
            animTimer: 0,
            isKillRoomEnemy: true
        });
    }

    console.log(`VOLUNTARY ARENA ACTIVATED! Wave 1/3`);
    audioManager.play('fx_totem_end'); // Play alarm sound
    const notif = document.getElementById('level-notification');
    if (notif) {
        notif.innerText = `⚔ VOLUNTARY ARENA - WAVE 1/3 ⚔`;
        notif.style.opacity = 1;
        setTimeout(() => { if (notif) notif.style.opacity = 0; }, 2500);
    }
}

function updateChainAggro(dt) {
    state.enemies.forEach(e => {
        if (e.state === 'IDLE' || e.state === 'STAND_BY') return;
        if (e.state === 'FLOOR' || e.state === 'DOWN' || e.state.includes('FIRE') || e.state.includes('SHOTGUN') || e.state.includes('V2')) return;

        state.enemies.forEach(other => {
            if (other === e) return;
            if (other.state !== 'IDLE' && other.state !== 'STAND_BY') return;

            const dx = other.x - e.x;
            const dy = other.y - e.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < CONFIG.chainAggroRadius) {
                other.state = 'IDLE';
                other.aggroTimer = 5.0;
                // Mark for visual alert "!" (reduced from 1.2 to 0.9 seconds, which is 3/4 of original)
                other.alertTimer = 0.3;
                other.justAlerted = true;
                other.hasDetectedPlayer = true;
            }
        });
    });

    // Decay alert timers
    state.enemies.forEach(e => {
        if (e.alertTimer && e.alertTimer > 0) {
            e.alertTimer -= dt;
            if (e.alertTimer <= 0) {
                e.alertTimer = 0;
                e.justAlerted = false;
            }
        }
    });
}

function updateTotemGuardians(dt) {
    if (state.totemGuardians) {
        state.totemGuardians.forEach(tg => {
            if (tg.activated) return;

            const totem = state.items[tg.totemIndex];
            if (!totem || !state.items.includes(totem)) {
                tg.activated = true;
                return;
            }

            const dx = state.player.x - totem.x;
            const dy = state.player.y - totem.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 5.0) {
                tg.activated = true;
                console.log("TOTEM GUARDIANS WAKE UP!");

                tg.enemies.forEach(e => {
                    if (e.state === 'STAND_BY' || e.state === 'IDLE') {
                        e.state = 'IDLE';
                        e.aggroTimer = 10.0;
                    }
                });

                if (ASSETS.audio.brain.attack.length > 0) {
                    audioManager.play('brain_attack_0');
                }
            }
        });
    }
}
function updateDynamicFog(dt) {
    let targetFogStart = 4.0;
    let targetFogEnd = 14.0;

    let currentRoom = null;
    if (state.rooms && state.rooms.length > 0) {
        const px = state.player.x;
        const py = state.player.y;
        for (let r of state.rooms) {
            if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) {
                currentRoom = r;
                break;
            }
        }
    }

    if (currentRoom && currentRoom.zone) {
        targetFogStart = currentRoom.zone.fogStart || 4.0;
        targetFogEnd = currentRoom.zone.fogEnd || 14.0;
    }

    // Smoothly interpolate fog values
    const lerpSpeed = dt * 1.5;
    state.fogStart += (targetFogStart - state.fogStart) * lerpSpeed;
    state.fogEnd += (targetFogEnd - state.fogEnd) * lerpSpeed;
}

function updateGates(dt) {
    if (!state.gates) return;
    for (let i = state.gates.length - 1; i >= 0; i--) {
        const gate = state.gates[i];
        if (gate.opened) continue;

        const keeper = state.enemies.find(e => e.id === gate.gatekeeperId);
        if (!keeper || keeper.hp <= 0) {
            // Open the gate by carving away the wall cell
            const idx = gate.y * state.map.width + gate.x;
            state.map.data[idx] = 0;
            gate.opened = true;
            console.log(`Gatekeeper defeated! Gate unlocked at ${gate.x}, ${gate.y}`);

            // Play unlock sound
            audioManager.play('fx_totem_end');

            const notif = document.getElementById('level-notification');
            if (notif) {
                notif.innerText = `🔓 PATHWAY UNLOCKED 🔓`;
                notif.style.opacity = 1;
                setTimeout(() => { if (notif) notif.style.opacity = 0; }, 2000);
            }
        }
    }
}

function update(dt) {
    updatePlayerMovement(dt);
    updateWeaponLogic(dt);
    updateEnemies(dt);
    updateNPCs(dt);
    updateItemPickups(dt);
    updateWeaponAnimation(dt);
    updateDecalsAndMarkers(dt);
    updateProjectiles(dt);
    updateExplosions(dt);
    updateParticles(dt);
    updateInkBlindness(dt);
    updateComboSystem(dt);
    updateScreenShake(dt);
    updateCrosshair(dt);
    updateKillRooms(dt);
    updateChainAggro(dt);
    updateTotemGuardians(dt);
    updateGates(dt);
    updateDynamicFog(dt);
    updateBossWave(dt);
    updateWeaponSway(dt);
    updateHUD();
}

// ===== WEAPON SWAY =====
let swayTimer = 0;
function updateWeaponSway(dt) {
    const vx = state.player.vx;
    const vy = state.player.vy;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > 0.2) {
        swayTimer += dt * 6.5 * Math.min(speed / 3.0, 1.5);
    } else {
        // Slow idle drift
        swayTimer += dt * 0.8;
    }
    const swayX = Math.sin(swayTimer) * speed * 2.5;
    const swayY = Math.abs(Math.sin(swayTimer * 2)) * speed * 1.5;
    const weaponEl = document.getElementById('weapon-sprite');
    if (weaponEl && state.player.animState === 'IDLE') {
        weaponEl.style.marginLeft = `${-200 + swayX}px`;
        weaponEl.style.marginBottom = `${-swayY}px`;
    }
}

// ===== BLOOD PARTICLES =====
function updateParticles(dt) {
    if (!state.particles) return;
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life -= dt;
        if (p.life <= 0) {
            state.particles.splice(i, 1);
            continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 3.0 * dt; // Gravity
    }
}

export function spawnBloodParticles(worldX, worldY, dirAngle) {
    if (!state.particles) state.particles = [];
    const count = CONFIG.bloodParticleCount;
    for (let i = 0; i < count; i++) {
        const angle = dirAngle + (Math.random() - 0.5) * 1.4;
        const spd = CONFIG.bloodParticleSpeed * (0.4 + Math.random() * 0.8);
        state.particles.push({
            worldX, worldY,
            x: 0, y: 0, // Screen coords, computed in render
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2.0,
            life: CONFIG.bloodParticleLife * (0.5 + Math.random() * 0.8),
            maxLife: CONFIG.bloodParticleLife,
            size: 2 + Math.random() * 3,
            wX: worldX,
            wY: worldY
        });
    }
}

// ===== BOSS WAVE SYSTEM =====
function updateBossWave(dt) {
    if (!state.bossWave || !state.bossWave.active) return;

    const bw = state.bossWave;

    // Count alive boss wave enemies
    const alive = state.enemies.filter(e => e.isBossWaveEnemy && e.hp > 0).length;
    bw.enemiesAlive = alive;

    if (alive > 0) return; // Still fighting

    // Wave cleared
    if (bw.currentWave < bw.totalWaves) {
        bw.currentWave++;
        spawnBossWave(bw);
        const notif = document.getElementById('boss-wave-notification');
        if (notif) {
            notif.innerHTML = `⚔ WAVE ${bw.currentWave}/${bw.totalWaves} ⚔`;
            notif.style.display = 'block';
            setTimeout(() => { if (notif) notif.style.display = 'none'; }, 2500);
        }
    } else {
        // All waves done — teleport!
        bw.active = false;
        const notif = document.getElementById('boss-wave-notification');
        if (notif) notif.style.display = 'none';
        finalizeLevelComplete();
    }
}

function spawnBossWave(bw) {
    const count = CONFIG.bossWaveBaseSize + state.level * CONFIG.bossWaveLevelScale;
    const waveTypes = [
        ['soldier', 'soldierB', 'monster'],
        ['monster', 'monsterB2', 'soldierB', 'geco'],
        ['monsterB2', 'geco', 'brain']
    ];
    const typePool = waveTypes[Math.min(bw.currentWave - 1, waveTypes.length - 1)];

    for (let i = 0; i < count; i++) {
        const type = typePool[Math.floor(Math.random() * typePool.length)];
        const hp = type === 'brain' ? 120 + state.level * 8
            : type.includes('monster') ? 60 + state.level * 6
                : 40 + state.level * 4;
        // Spawn near totem room center
        const sx = bw.spawnX + (Math.random() - 0.5) * 6;
        const sy = bw.spawnY + (Math.random() - 0.5) * 6;
        state.enemies.push({
            id: Math.random(),
            x: sx, y: sy,
            type, hp,
            vx: 0, vy: 0,
            state: 'IDLE',
            frame: 0,
            animTimer: 0,
            isBossWaveEnemy: true
        });
    }
    console.log(`Boss wave ${bw.currentWave}/${bw.totalWaves} spawned (${count} enemies)`);
}

function finalizeLevelComplete() {
    // Called after all boss waves clear — show level complete screen
    audioManager.play('fx_totem_end');

    const completedKillRooms = (state.killRoomCandidates || []).filter(kr => kr.completed).length;
    const completedTotemGuardians = (state.totemGuardians || []).filter(tg => tg.activated && tg.enemies.every(e => e.hp <= 0)).length;
    const completedSecretWalls = (state.secretWalls || []).filter(sw => sw.discovered).length;
    const totalSecondaryObjectives = completedKillRooms + completedTotemGuardians + completedSecretWalls;

    const bonusCoins = 50 + 25 * totalSecondaryObjectives;
    state.player.coins += bonusCoins;
    state.player.totalCoinsEarned += bonusCoins;
    state.player.health = Math.min(100, state.player.health + 25);
    state.lastLevelRewards = { objectives: totalSecondaryObjectives, coins: bonusCoins };

    updateHUD();

    let countdown = 3;
    const notif = document.getElementById('level-notification');
    if (notif) {
        notif.style.opacity = 1;
        notif.innerText = `TELETRANSPORT IN ${countdown}...`;
    }
    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            if (notif) notif.innerText = `TELETRANSPORT IN ${countdown}...`;
        } else {
            clearInterval(interval);
            if (notif) notif.style.opacity = 0;

            state.gameState = 'MENU';
            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) uiLayer.classList.add('hidden');
            const mobileOverlay = document.getElementById('mobile-controls');
            if (mobileOverlay) mobileOverlay.classList.add('hidden');
            if (!state.mobileMode) document.exitPointerLock();
            document.getElementById('menus').classList.remove('hidden');
            document.getElementById('level-complete-screen').classList.remove('hidden');

            document.getElementById('level-kills').innerText = state.player.kills;
            const time = Math.floor((Date.now() - state.levelStartTime) / 1000);
            const mins = Math.floor(time / 60).toString().padStart(2, '0');
            const secs = (time % 60).toString().padStart(2, '0');
            document.getElementById('level-time').innerText = `${mins}:${secs}`;

            const rewards = state.lastLevelRewards || { objectives: 0, coins: 50 };
            const objCompEl = document.getElementById('level-objectives-completed');
            if (objCompEl) objCompEl.innerText = `Objectives Completed: ${rewards.objectives}`;
            const bonusCoinsEl = document.getElementById('level-bonus-coins');
            if (bonusCoinsEl) bonusCoinsEl.innerText = `Bonus Coins: +${rewards.coins} 🪙`;
            const bonusHealthEl = document.getElementById('level-bonus-health');
            if (bonusHealthEl) bonusHealthEl.innerText = `Health Healed: +25 HP ❤️`;
        }
    }, 1000);
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    init();
});




function renderLaserFunc(ctx) {
    if (state.player.laserState === 'FIRING') {
        const w = ctx.canvas.width;
        const h = ctx.canvas.height;
        const cx = w / 2;
        const cy = h / 2;

        // Beam from bottom center
        const bottomX = w / 2;
        const bottomY = h;

        // Draw Core Beam (White/Cyan)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        const drawBeam = (width, color, blur) => {
            ctx.beginPath();
            ctx.moveTo(bottomX, bottomY);
            ctx.lineTo(cx, cy - 20);
            ctx.lineWidth = width;
            ctx.strokeStyle = color;
            ctx.shadowBlur = blur;
            ctx.shadowColor = color;
            ctx.lineCap = 'round';
            ctx.stroke();
        };

        // Outer Glow
        drawBeam(15, 'rgba(0, 50, 255, 0.4)', 20);
        // Inner Core
        drawBeam(8, 'rgba(0, 200, 255, 0.8)', 10);
        // Center Hotspot
        drawBeam(3, 'rgba(255, 255, 255, 1.0)', 5);

        // Muzzle Flash at bottom
        const grad = ctx.createRadialGradient(bottomX, bottomY, 0, bottomX, bottomY, 100);
        grad.addColorStop(0, 'rgba(200, 240, 255, 0.8)');
        grad.addColorStop(1, 'rgba(0, 0, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(bottomX - 100, bottomY - 100, 200, 100);

        ctx.restore();
    }
}

export { shoot } from './player.js';
