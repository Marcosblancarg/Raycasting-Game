import { state } from './state.js';
import { CONFIG, ASSETS } from './config.js';
import { initAssets } from './assets.js';
import { initInput } from './input.js';
import { generateLevel } from './map.js';
import { updateHUD, switchWeapon, damagePlayer, shoot } from './player.js';
import { render } from './raycaster.js';
import { audioManager } from './audio.js';
import { initMobileControls, refreshMobileUI, updateWeaponBar } from './mobile.js';

let width, height;
let canvas, ctx;

console.log("GAME: Script loaded. Waiting for init...");

export function init() {
    console.log("GAME: Init function called.");

    // Expose for debugging
    window.state = state;
    window.ASSETS = ASSETS;
    window.audioManager = audioManager;

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
    initInput(canvas, startGame, shoot, togglePause, nextLevel);

    // Initialize mobile controls (always — activated on demand)
    initMobileControls(shoot, togglePause, switchWeapon);

    // Audio Controls
    document.getElementById('music-volume').addEventListener('input', (e) => {
        audioManager.setMusicVolume(parseFloat(e.target.value));
    });
    document.getElementById('sfx-volume').addEventListener('input', (e) => {
        audioManager.setSfxVolume(parseFloat(e.target.value));
    });

    requestAnimationFrame(loop);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * CONFIG.resolution;
    canvas.height = height * CONFIG.resolution;
    ctx.imageSmoothingEnabled = false;
}

export function startGame() {
    // Reset Game State
    state.level = 1;
    state.player.health = 100;
    state.player.ammo = { 0: Infinity, 1: 20, 2: 50, 3: Infinity, 4: 10 };
    state.player.inventory = { red: false, green: false, blue: false };
    state.player.kills = 0;
    state.levelStartTime = Date.now();

    state.gameState = 'PLAYING';
    document.getElementById('menus').classList.add('hidden');
    document.getElementById('start-menu').classList.add('hidden');
    document.getElementById('history-screen').classList.add('hidden');
    document.getElementById('level-complete-screen').classList.add('hidden');
    document.getElementById('death-menu').classList.add('hidden');

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
    generateLevel(1);

    // Start Music
    audioManager.init();
    audioManager.playMusic('bg_music_1');
}

export function nextLevel() {
    state.level++;
    state.gameState = 'PLAYING';
    state.levelStartTime = Date.now();
    state.player.kills = 0;
    state.player.inventory = { red: false, green: false, blue: false };

    // Reset Level State
    state.enemies = [];
    state.items = [];
    state.projectiles = [];
    state.explosions = [];
    state.decals = [];
    state.hitMarkers = [];

    // Generate New Map
    generateLevel(state.level);

    // Hide Menus
    document.getElementById('menus').classList.add('hidden');
    document.getElementById('level-complete-screen').classList.add('hidden');

    // Pointer lock only in desktop mode
    if (!state.mobileMode) {
        canvas.requestPointerLock();
    } else {
        updateWeaponBar(); // refresh weapon icons after level transition
    }
}

export function togglePause() {
    if (state.gameState === 'PLAYING') {
        state.gameState = 'PAUSED';
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
        document.getElementById('pause-menu').classList.add('hidden');
        if (!state.mobileMode) canvas.requestPointerLock();
    }
}

// --- GAME LOOP ---
function loop(timestamp) {
    const dt = Math.min((timestamp - state.lastTime) / 1000, 0.1);
    state.lastTime = timestamp;

    if (state.gameState === 'PLAYING') {
        update(dt);
        render(canvas, ctx);
    }

    requestAnimationFrame(loop);
}

function update(dt) {
    // Player Movement
    let move = 0, strafe = 0;
    if (state.keys['KeyW']) move += 1;
    if (state.keys['KeyS']) move -= 1;
    if (state.keys['KeyA']) strafe -= 1;
    if (state.keys['KeyD']) strafe += 1;
    if (state.keys['ArrowUp']) move += 1;
    if (state.keys['ArrowDown']) move -= 1;
    if (state.keys['ArrowLeft']) state.player.dir -= CONFIG.rotSpeed * dt;
    if (state.keys['ArrowRight']) state.player.dir += CONFIG.rotSpeed * dt;

    if (move !== 0 || strafe !== 0) {
        // Sprint Logic
        const ms = (state.keys['ShiftLeft'] ? CONFIG.moveSpeed * 2.0 : CONFIG.moveSpeed) * dt;

        const cos = Math.cos(state.player.dir);
        const sin = Math.sin(state.player.dir);
        const nx = state.player.x + (cos * move - sin * strafe) * ms;
        const ny = state.player.y + (sin * move + cos * strafe) * ms;

        if (state.map.data[Math.floor(ny) * state.map.width + Math.floor(nx)] === 0) {
            state.player.x = nx;
            state.player.y = ny;
        } else if (state.map.data[Math.floor(state.player.y) * state.map.width + Math.floor(nx)] === 0) {
            state.player.x = nx;
        } else if (state.map.data[Math.floor(ny) * state.map.width + Math.floor(state.player.x)] === 0) {
            state.player.y = ny;
        }
        state.player.bobbing += dt * 10;
    }

    // Update Visited Map (Fog of War)
    const px = Math.floor(state.player.x);
    const py = Math.floor(state.player.y);
    const viewRadius = 8;
    for (let y = py - viewRadius; y <= py + viewRadius; y++) {
        for (let x = px - viewRadius; x <= px + viewRadius; x++) {
            if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
                // Raycast check could be better, but radius is simple and effective
                state.map.visited[y * state.map.width + x] = 1;
            }
        }
    }

    // Weapon Switching
    if (state.keys['Digit1']) switchWeapon(0);
    if (state.keys['Digit2']) switchWeapon(1);
    if (state.keys['Digit3']) switchWeapon(2);
    if (state.keys['KeyR']) switchWeapon(3);
    if (state.keys['Digit5']) switchWeapon(4);

    // Enemies
    state.enemies.forEach(e => {
        // State Machine
        if (e.state === 'FLOOR') return; // Dead and buried

        if (e.state === 'DOWN') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) {
                e.state = 'FLOOR';
            }
            return; // Don't move or attack
        }

        if (e.state === 'HIT') {
            e.hitTimer -= dt;
            if (e.hitTimer <= 0) {
                e.state = 'IDLE'; // Recover
            }
            return; // Stunned
        }

        if (e.state === 'HIT_FIRE') {
            e.animTimer += dt;
            if (e.animTimer > 0.1) {
                e.animTimer = 0;
                e.frame++;
                if (e.frame >= 3) {
                    e.state = 'FLOOR_FIRE_1';
                    e.deathTimer = 1.0;
                }
            }
            return;
        }

        if (e.state === 'FLOOR_FIRE_1') {
            e.deathTimer -= dt;
            if (e.deathTimer <= 0) {
                e.state = 'FLOOR_FIRE_2';
            }
            return;
        }

        if (e.state === 'FLOOR_FIRE_2') return;

        // Normal Behavior (IDLE/CHASE)
        const dx = state.player.x - e.x;
        const dy = state.player.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 8) { // Aggro range
            // Animation
            e.animTimer += dt;
            if (e.animTimer > 0.2) {
                e.animTimer = 0;
                e.frame = (e.frame + 1) % 3;
            }

            // Move towards player
            if (dist > 1.0) {
                const speed = (e.type === 'monster' ? 4.0 : 1.5) * dt;

                // Try X movement
                const nx = e.x + (dx / dist) * speed;
                if (state.map.data[Math.floor(e.y) * state.map.width + Math.floor(nx)] === 0) {
                    e.x = nx;
                }

                // Try Y movement
                const ny = e.y + (dy / dist) * speed;
                if (state.map.data[Math.floor(ny) * state.map.width + Math.floor(e.x)] === 0) {
                    e.y = ny;
                }
            } else {
                // Attack
                if (Math.random() < dt * 2) {
                    damagePlayer(5 + Math.floor(Math.random() * 5));

                    // Play Attack Sound
                    if (e.type === 'monster') {
                        if (ASSETS.audio.monster.attack.length > 0) {
                            const idx = Math.floor(Math.random() * ASSETS.audio.monster.attack.length);
                            audioManager.play3D(`monster_attack_${idx}`, e.x, e.y, state.player.x, state.player.y);
                        }
                    } else {
                        // Zombie plays DTC sound on attack (Simple & Direct)
                        // Or use attack if available
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
        }

        // --- AUDIO LOGIC ---
        if (!e.sbTimer) e.sbTimer = Math.random() * 2 + 1;
        e.sbTimer -= dt;

        if (e.type === 'zombie') {
            // ZOMBIE LOGIC
            // If chasing (dist < 10), force rapid loop
            if (dist < 10) {
                // If timer is too high (was idle), cut it to play immediately
                if (e.sbTimer > 2.1) e.sbTimer = 0;

                if (e.sbTimer <= 0) {
                    const idx = Math.floor(Math.random() * 7); // 0-6
                    // High volume (3.0) and range (30)
                    audioManager.play3D(`zombie_dtc_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 3.0);
                    // Reset timer to 2.0s for constant loop
                    e.sbTimer = 2.0;
                }
            } else {
                // Idle behavior
                if (e.sbTimer <= 0) {
                    const idx = Math.floor(Math.random() * 7);
                    audioManager.play3D(`zombie_dtc_${idx}`, e.x, e.y, state.player.x, state.player.y, 30, 1.5);
                    e.sbTimer = Math.random() * 4 + 3;
                }
            }
        } else if (e.type === 'monster') {
            // MONSTER LOGIC
            if (e.sbTimer <= 0) {
                if (dist > 8) {
                    const idx = Math.floor(Math.random() * 4);
                    audioManager.play3D(`monster_sb_${idx}`, e.x, e.y, state.player.x, state.player.y);
                }
                e.sbTimer = Math.random() * 4 + 3;
            }
        }
    });
    // Item Pickup & Totem Logic
    for (let i = state.items.length - 1; i >= 0; i--) {
        const item = state.items[i];
        const dx = state.player.x - item.x;
        const dy = state.player.y - item.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 0.5) {
            if (item.type === 'ammoShotgun') {
                const weapon = state.player.weapons.find(w => w.name === 'SHOTGUN');
                if (state.player.ammo[1] < weapon.maxAmmo) {
                    state.player.ammo[1] = Math.min(weapon.maxAmmo, state.player.ammo[1] + 4);
                    state.items.splice(i, 1);
                    updateHUD();
                }
            } else if (item.type === 'ammoMachinegun') {
                const weapon = state.player.weapons.find(w => w.name === 'CHAINGUN');
                if (state.player.ammo[2] < weapon.maxAmmo) {
                    state.player.ammo[2] = Math.min(weapon.maxAmmo, state.player.ammo[2] + 20);
                    state.items.splice(i, 1);
                    updateHUD();
                }
            } else if (item.type === 'addLife') {
                state.player.health = Math.min(100, state.player.health + 20);
                state.items.splice(i, 1);
                updateHUD();
            } else if (item.type === 'totemRed') {
                state.player.inventory.red = true;
                state.items.splice(i, 1);
                console.log('Got Red Totem');
            } else if (item.type === 'totemGreen') {
                state.player.inventory.green = true;
                state.items.splice(i, 1);
                console.log('Got Green Totem');
            } else if (item.type === 'totemBlue') {
                state.player.inventory.blue = true;
                state.items.splice(i, 1);
                console.log('Got Blue Totem');
            } else if (item.isGoal) {
                if (state.player.inventory.red && state.player.inventory.green && state.player.inventory.blue) {
                    if (item.type !== 'totemFull') {
                        item.type = 'totemFull';
                        console.log('All Totems Placed! Level Complete...');

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

                                // Show Level Complete Screen
                                state.gameState = 'MENU';
                                document.exitPointerLock();
                                document.getElementById('menus').classList.remove('hidden');
                                document.getElementById('level-complete-screen').classList.remove('hidden');

                                // Stats
                                document.getElementById('level-kills').innerText = state.player.kills;
                                const time = Math.floor((Date.now() - state.levelStartTime) / 1000);
                                const mins = Math.floor(time / 60).toString().padStart(2, '0');
                                const secs = (time % 60).toString().padStart(2, '0');
                                document.getElementById('level-time').innerText = `${mins}:${secs}`;
                            }
                        }, 1000);
                    }
                }
            }
        }
    }

    // Weapon Animation
    if (state.player.animState === 'FIRING') {
        state.player.animTimer += dt;
        const weapon = state.player.weapons[state.player.weaponIndex];
        if (state.player.animTimer > weapon.animSpeed) {
            state.player.animTimer = 0;
            state.player.animFrame++;
            const maxFrames = ASSETS.sprites[weapon.frames].length;
            console.log('AnimFrame:', state.player.animFrame, 'MaxFrames:', maxFrames);
            if (weapon.name === 'SHOTGUN') console.log('Shotgun Frames:', ASSETS.sprites[weapon.frames]);
            if (state.player.animFrame >= maxFrames) {
                state.player.animState = 'IDLE';
                state.player.animFrame = 0;
            }
            updateHUD();
        }
    } else if (state.player.animState === 'SWITCHING_DOWN') {
        state.player.animTimer += dt;
        if (state.player.animTimer > 0.2) { // Wait for down animation
            state.player.weaponIndex = state.player.nextWeaponIndex;
            state.player.animState = 'SWITCHING_UP';
            state.player.animTimer = 0;
            updateHUD(); // Update sprite to new weapon

            const weaponEl = document.getElementById('weapon-sprite');
            weaponEl.style.transition = 'transform 0.2s ease-out';
            weaponEl.style.transform = 'translateY(0)';
        }
    } else if (state.player.animState === 'SWITCHING_UP') {
        state.player.animTimer += dt;
        if (state.player.animTimer > 0.2) { // Wait for up animation
            state.player.animState = 'IDLE';
            const weaponEl = document.getElementById('weapon-sprite');
            weaponEl.style.transition = 'none'; // Reset transition for shooting recoil
        }
    } else {
        // Real-time update for Sonar
        const weapon = state.player.weapons[state.player.weaponIndex];
        if (weapon.name === 'SONAR') {
            updateHUD();
        }
    }

    // Cleanup Decals & Markers
    for (let i = state.decals.length - 1; i >= 0; i--) {
        state.decals[i].time -= dt;
        if (state.decals[i].time <= 0) state.decals.splice(i, 1);
    }
    for (let i = state.hitMarkers.length - 1; i >= 0; i--) {
        state.hitMarkers[i].time -= dt;
        if (state.hitMarkers[i].time <= 0) state.hitMarkers.splice(i, 1);
    }

    // Projectiles
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const p = state.projectiles[i];
        const moveDist = p.speed * dt;
        const newX = p.x + Math.cos(p.dir) * moveDist;
        const newY = p.y + Math.sin(p.dir) * moveDist;

        // Wall Collision
        if (state.map.data[Math.floor(newY) * state.map.width + Math.floor(newX)] > 0) {
            // Hit Wall
            state.explosions.push({
                x: newX, y: newY,
                frame: 0, timer: 0,
                type: 'wall'
            });
            // Add Decal
            // Calculate side for decal (rough approx)
            const mapX = Math.floor(newX);
            const mapY = Math.floor(newY);
            // Simple side check based on previous pos
            let side = 0; // 0: NS, 1: EW
            if (Math.floor(p.x) !== mapX) side = 1; // Crossed X boundary

            // We need wallX for decal rendering
            // Let's approximate wallX
            let wallX = 0;
            if (side === 0) wallX = newX - Math.floor(newX);
            else wallX = newY - Math.floor(newY);

            state.decals.push({
                mapX: mapX, mapY: mapY, side: side,
                wallX: wallX,
                texIndex: -1, // Special flag for fireball decal? Or just use a new property
                isFireball: true,
                time: 30.0
            });

            state.projectiles.splice(i, 1);
            continue;
        }

        // Enemy Collision
        let hitEnemy = false;
        for (let e of state.enemies) {
            if (e.state === 'DOWN' || e.state === 'FLOOR' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2') continue;
            const dx = newX - e.x;
            const dy = newY - e.y;
            if (Math.sqrt(dx * dx + dy * dy) < 0.5) {
                // Hit Enemy
                e.hp -= p.damage;
                if (e.hp <= 0) {
                    e.state = 'HIT_FIRE';
                    e.frame = 0;
                    e.animTimer = 0;
                    state.player.kills++;
                    // Sound?
                } else {
                    // Just normal hit if not dead? Or fireball always kills/stuns?
                    // Let's make it standard hit if not dead, but high damage likely kills.
                    e.state = 'HIT';
                    e.hitTimer = 0.2;
                }
                state.projectiles.splice(i, 1);
                hitEnemy = true;
                break;
            }
        }

        if (!hitEnemy) {
            p.x = newX;
            p.y = newY;
            // Animation
            p.animTimer += dt;
            if (p.animTimer > 0.1) {
                p.animTimer = 0;
                p.frame = (p.frame + 1) % 4;
            }
        }
    }

    // Explosions
    for (let i = state.explosions.length - 1; i >= 0; i--) {
        const ex = state.explosions[i];
        ex.timer += dt;
        if (ex.timer > 0.1) {
            ex.timer = 0;
            ex.frame++;
            if (ex.frame >= 3) {
                state.explosions.splice(i, 1);
            }
        }
    }
}

// Start the game
window.addEventListener('DOMContentLoaded', () => {
    init();
});

// Export shoot for input.js
export { shoot } from './player.js';


