import { state } from './state.js';
import { ASSETS, CONFIG } from './config.js';
import { castRay } from './raycaster.js';
import { audioManager } from './audio.js';
import { spawnBloodParticles } from './particles.js';

// HUD DOM Cache
let elHealthDisplay = null;
let elHealthBar = null;
let elAmmoDisplay = null;
let elCoinDisplay = null;
let elScoreDisplay = null;
let elHeatBox = null;
let elHeatBar = null;
let elWeaponSprite = null;
let elShopMenu = null;

// HUD Dirty State variables
let lastHealth = -1;
let lastCoins = -1;
let lastScore = -1;
let lastAmmoStr = '';
let lastHeatVal = -1;
let lastOverheated = null;
let lastHasHeat = null;

export function updateHUD() {
    if (!elHealthDisplay) elHealthDisplay = document.getElementById('health-display');
    if (!elHealthBar) elHealthBar = document.getElementById('health-bar');
    if (!elAmmoDisplay) elAmmoDisplay = document.getElementById('ammo-display');
    if (!elCoinDisplay) elCoinDisplay = document.getElementById('coin-display');
    if (!elScoreDisplay) elScoreDisplay = document.getElementById('score-display');
    if (!elHeatBox) elHeatBox = document.getElementById('heat-box');
    if (!elHeatBar) elHeatBar = document.getElementById('heat-bar');
    if (!elWeaponSprite) elWeaponSprite = document.getElementById('weapon-sprite');
    if (!elShopMenu) elShopMenu = document.getElementById('shop-menu');

    // 1. Health Display & Bar
    const hp = Math.max(0, Math.floor(state.player.health));
    if (hp !== lastHealth) {
        if (elHealthDisplay) elHealthDisplay.innerText = hp;
        if (elHealthBar) {
            const hpPercent = Math.max(0, Math.min(100, hp));
            elHealthBar.style.width = `${hpPercent}%`;
            if (hpPercent > 50) {
                elHealthBar.style.backgroundColor = '#0f0';
            } else if (hpPercent > 25) {
                elHealthBar.style.backgroundColor = '#ffaa00';
            } else {
                elHealthBar.style.backgroundColor = '#f00';
            }
        }
        lastHealth = hp;
    }

    // 2. Ammo Display
    const currentWeapon = state.player.weapons[state.player.weaponIndex];
    const ammoCount = state.player.ammo[currentWeapon.ammoType];
    const durPercent = currentWeapon.name === 'CHAINGUN' ? Math.max(0, Math.ceil((state.player.chaingunDurability || 0) / 10)) : -1;
    
    const ammoStr = currentWeapon.name === 'CHAINGUN' 
        ? `${ammoCount} | DUR: ${durPercent}%` 
        : (ammoCount === Infinity ? 'INF' : ammoCount);

    if (ammoStr !== lastAmmoStr) {
        if (elAmmoDisplay) elAmmoDisplay.innerText = ammoStr;
        lastAmmoStr = ammoStr;
    }

    // 3. Coin Display
    if (state.player.coins !== lastCoins) {
        if (elCoinDisplay) elCoinDisplay.innerText = state.player.coins;
        lastCoins = state.player.coins;
    }

    // 4. Score Display
    if (state.player.score !== lastScore) {
        if (elScoreDisplay) elScoreDisplay.innerText = state.player.score;
        lastScore = state.player.score;
    }

    // 5. Heat Bar Box
    let heatVal = 0;
    let maxHeat = 1.0;
    let overheated = false;
    let hasHeat = false;

    if (currentWeapon.name === 'CHAINGUN') {
        heatVal = state.player.machineGunHeat;
        maxHeat = 5.0;
        overheated = state.player.machineGunOverheated;
        hasHeat = true;
    } else if (currentWeapon.name === 'HEAVYMACHINEGUN') {
        heatVal = state.player.heavyMachineGunHeat;
        maxHeat = 5.0;
        overheated = state.player.heavyMachineGunOverheated;
        hasHeat = true;
    } else if (currentWeapon.name === 'AUTOSHOTGUN') {
        heatVal = state.player.autoShotgunHeat;
        maxHeat = 6.0;
        overheated = state.player.autoShotgunOverheated;
        hasHeat = true;
    }

    if (hasHeat !== lastHasHeat || heatVal !== lastHeatVal || overheated !== lastOverheated) {
        if (elHeatBox && elHeatBar) {
            if (hasHeat) {
                elHeatBox.classList.remove('hidden');
                const heatPercent = Math.max(0, Math.min(100, (heatVal / maxHeat) * 100));
                elHeatBar.style.width = `${heatPercent}%`;
                if (overheated) {
                    elHeatBar.classList.add('overheated');
                } else {
                    elHeatBar.classList.remove('overheated');
                }
            } else {
                elHeatBox.classList.add('hidden');
            }
        }
        lastHasHeat = hasHeat;
        lastHeatVal = heatVal;
        lastOverheated = overheated;
    }

    // 6. Weapon Sprite
    const weaponEl = elWeaponSprite;
    if (weaponEl) {
        if (currentWeapon.name === 'CHAINGUN' && state.player.chaingunDurability <= 0) {
            const brokenSprite = ASSETS.sprites.machinegunBroken;
            if (brokenSprite && weaponEl.src !== window.location.origin + '/' + brokenSprite) {
                weaponEl.src = brokenSprite;
            }
            
            if (elShopMenu && !elShopMenu.classList.contains('hidden')) {
                updateShopUI();
            }
            return;
        }

        if (state.player.animState === 'FIRING') {
            if (currentWeapon.name === 'CHAINGUN' && state.player.machineGunHeat > 4.0 && ASSETS.sprites.machinegunHotFrames) {
                const hotFrameIndex = state.player.animFrame % 2;
                const framePath = ASSETS.sprites.machinegunHotFrames[hotFrameIndex];
                if (weaponEl.src !== window.location.origin + '/' + framePath) {
                    weaponEl.src = framePath;
                }
            } else if (currentWeapon.name === 'HEAVYMACHINEGUN' && state.player.heavyMachineGunHeat > 4.0 && ASSETS.sprites.heavymachinegunHotFrames) {
                const hotFrameIndex = state.player.animFrame % 2;
                const framePath = ASSETS.sprites.heavymachinegunHotFrames[hotFrameIndex];
                if (weaponEl.src !== window.location.origin + '/' + framePath) {
                    weaponEl.src = framePath;
                }
            } else if (currentWeapon.name === 'AUTOSHOTGUN' && state.player.autoShotgunHeat > 5.0 && ASSETS.sprites.autoShotgunHotFrames && ASSETS.sprites.autoShotgunHotFrames[state.player.animFrame]) {
                const framePath = ASSETS.sprites.autoShotgunHotFrames[state.player.animFrame];
                if (weaponEl.src !== window.location.origin + '/' + framePath) {
                    weaponEl.src = framePath;
                }
            } else if (ASSETS.sprites[currentWeapon.frames] && ASSETS.sprites[currentWeapon.frames][state.player.animFrame]) {
                const framePath = ASSETS.sprites[currentWeapon.frames][state.player.animFrame];
                if (weaponEl.src !== window.location.origin + '/' + framePath) {
                    weaponEl.src = framePath;
                }
            }
        } else {
            // Overheat checks
            if (currentWeapon.name === 'CHAINGUN' && state.player.machineGunOverheated) {
                const cooldownSprite = ASSETS.sprites.machinegunCooldown;
                if (cooldownSprite && weaponEl.src !== window.location.origin + '/' + cooldownSprite) {
                    weaponEl.src = cooldownSprite;
                }
                return;
            } else if (currentWeapon.name === 'HEAVYMACHINEGUN' && state.player.heavyMachineGunOverheated) {
                const cooldownSprite = ASSETS.sprites.heavymachinegunCooldown;
                if (cooldownSprite && weaponEl.src !== window.location.origin + '/' + cooldownSprite) {
                    weaponEl.src = cooldownSprite;
                }
                return;
            } else if (currentWeapon.name === 'AUTOSHOTGUN' && state.player.autoShotgunOverheated) {
                const cooldownSprite = ASSETS.sprites.autoShotgunHotFrames ? ASSETS.sprites.autoShotgunHotFrames[0] : null;
                if (cooldownSprite && weaponEl.src !== window.location.origin + '/' + cooldownSprite) {
                    weaponEl.src = cooldownSprite;
                }
                return;
            } else if (currentWeapon.name === 'LASER') {
                let frameIndex = 0;
                if (state.player.laserState === 'CHARGING') frameIndex = 1;
                else if (state.player.laserState === 'FIRING') frameIndex = 2;
                else if (state.player.laserState === 'COOLDOWN') frameIndex = 3;

                if (ASSETS.sprites.laserFrames && ASSETS.sprites.laserFrames[frameIndex]) {
                    const framePath = ASSETS.sprites.laserFrames[frameIndex];
                    if (weaponEl.src !== window.location.origin + '/' + framePath) {
                        weaponEl.src = framePath;
                    }
                }
                return;
            }

            // Check ammo
            let ammoCost = currentWeapon.name === 'SHOTGUN' ? 2 : 1;
            const hasAmmo = state.player.ammo[currentWeapon.ammoType] >= ammoCost || currentWeapon.ammoType === 0 || currentWeapon.ammoType === 3;

            if (!hasAmmo) {
                let noAmmoKey = null;
                if (currentWeapon.name === 'SHOTGUN') noAmmoKey = 'shotgunNoAmmo';
                else if (currentWeapon.name === 'CHAINGUN') noAmmoKey = 'machinegunNoAmmo';
                else if (currentWeapon.name === 'HEAVYMACHINEGUN') noAmmoKey = 'heavymachinegunNoAmmo';
                else if (currentWeapon.name === 'AUTOSHOTGUN') noAmmoKey = 'autoShotgunNoAmmo';
                else if (currentWeapon.name === 'CANNON') noAmmoKey = 'cannonNoAmmo';

                if (noAmmoKey && ASSETS.sprites[noAmmoKey]) {
                    const framePath = ASSETS.sprites[noAmmoKey];
                    if (weaponEl.src !== window.location.origin + '/' + framePath) {
                        weaponEl.src = framePath;
                    }
                } else {
                    if (ASSETS.sprites[currentWeapon.frames] && ASSETS.sprites[currentWeapon.frames][0]) {
                        const framePath = ASSETS.sprites[currentWeapon.frames][0];
                        if (weaponEl.src !== window.location.origin + '/' + framePath) {
                            weaponEl.src = framePath;
                        }
                    }
                }
            } else {
                if (currentWeapon.name === 'SONAR') {
                    const mode = state.player.sonarMode;
                    let target = null;

                    if (mode === 'totem') {
                        target = state.items.find(i => i.isGoal);
                    } else {
                        const typeName = 'totem' + mode.charAt(0).toUpperCase() + mode.slice(1);
                        target = state.items.find(i => i.type === typeName);
                    }

                    let dirIndex = 1;

                    if (target) {
                        const dx = target.x - state.player.x;
                        const dy = target.y - state.player.y;
                        const targetAngle = Math.atan2(dy, dx);

                        let diff = targetAngle - state.player.dir;
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;

                        if (diff < -0.2) dirIndex = 0;
                        else if (diff > 0.2) dirIndex = 2;
                        else dirIndex = 1;
                    }

                    const spriteKey = 'sonar' + mode.charAt(0).toUpperCase() + mode.slice(1);
                    if (ASSETS.sprites[spriteKey] && ASSETS.sprites[spriteKey][dirIndex]) {
                        const framePath = ASSETS.sprites[spriteKey][dirIndex];
                        if (weaponEl.src !== window.location.origin + '/' + framePath) {
                            weaponEl.src = framePath;
                        }
                    }

                    const now = performance.now();
                    if (!state.player.lastSonarPing) state.player.lastSonarPing = 0;
                    const interval = dirIndex === 1 ? 500 : 1000;

                    if (now - state.player.lastSonarPing > interval) {
                        audioManager.stop('sonar_center');
                        audioManager.stop('sonar_side');

                        if (dirIndex === 1) {
                            audioManager.play('sonar_center');
                        } else {
                            audioManager.play('sonar_side');
                        }
                        state.player.lastSonarPing = now;
                    }
                } else {
                    audioManager.stop('sonar_center');
                    audioManager.stop('sonar_side');

                    if (currentWeapon.frames && ASSETS.sprites[currentWeapon.frames] && ASSETS.sprites[currentWeapon.frames][0]) {
                        const framePath = ASSETS.sprites[currentWeapon.frames][0];
                        if (weaponEl.src !== window.location.origin + '/' + framePath) {
                            weaponEl.src = framePath;
                        }
                    } else if (currentWeapon.sprite && ASSETS.sprites[currentWeapon.sprite]) {
                        const framePath = ASSETS.sprites[currentWeapon.sprite];
                        if (weaponEl.src !== window.location.origin + '/' + framePath) {
                            weaponEl.src = framePath;
                        }
                    }
                }
            }
        }
    }

    // 7. Shop Menu
    if (elShopMenu && !elShopMenu.classList.contains('hidden')) {
        updateShopUI();
    }
}

export function damagePlayer(amount, source) {
    state.player.health -= amount;
    
    // Proportional screen shake on damage
    state.player.screenShakeIntensity = Math.max(state.player.screenShakeIntensity, amount * 0.8);

    updateHUD();

    // Player Knockback Effect
    // (Handled in game_core.js for directional accuracy)

    if (source === 'geco') {
        const ink = document.getElementById('ink-overlay');
        if (ink) {
            ink.style.opacity = 1;
            state.player.inkBlindnessTimer = 10.0; // Set timer high
            state.player.inkClearCount = 0; // Reset mechanics
        }
        state.player.vx += (Math.random() - 0.5) * 10.0;
        state.player.vy += (Math.random() - 0.5) * 10.0;
    } else {
        const overlay = document.getElementById('damage-overlay');
        if (overlay) {
            overlay.style.opacity = 0.5;
            setTimeout(() => overlay.style.opacity = 0, 200);
        }
    }

    if (state.player.health <= 0) {
        state.gameState = 'DEAD';
        state.player.inkBlindnessTimer = 0; // Reset ink timer
        const ink = document.getElementById('ink-overlay');
        if (ink) {
            ink.style.opacity = 0; // Clear ink visually
        }
        document.getElementById('menus').classList.remove('hidden');
        document.getElementById('start-menu').classList.add('hidden');

        // Hide HUD and Mobile Controls
        const uiLayer = document.getElementById('ui-layer');
        if (uiLayer) uiLayer.classList.add('hidden');
        const mobileOverlay = document.getElementById('mobile-controls');
        if (mobileOverlay) mobileOverlay.classList.add('hidden');

        // Show Death Screen with Score
        const deathMenu = document.getElementById('death-menu');
        deathMenu.classList.remove('hidden');
        const finalScoreEl = document.getElementById('final-score');
        if (finalScoreEl) finalScoreEl.innerText = state.player.score;

        // Populate Death Recap Stats
        const deathLvlEl = document.getElementById('death-level');
        if (deathLvlEl) deathLvlEl.innerText = state.level;

        const deathCoinsEl = document.getElementById('death-coins');
        if (deathCoinsEl) deathCoinsEl.innerText = `${state.player.totalCoinsEarned || 0} 🪙`;

        const deathKillsEl = document.getElementById('death-kills');
        if (deathKillsEl) deathKillsEl.innerText = state.player.totalKills || 0;

        // Survive duration
        const timeMs = Date.now() - (state.player.gameStartTime || Date.now());
        const timeSecs = Math.floor(timeMs / 1000);
        const mins = Math.floor(timeSecs / 60).toString().padStart(2, '0');
        const secs = (timeSecs % 60).toString().padStart(2, '0');
        const deathTimeEl = document.getElementById('death-time');
        if (deathTimeEl) deathTimeEl.innerText = `${mins}:${secs}`;

        // Enemy breakdown
        const types = ['soldier', 'soldierB', 'monster', 'monsterB2', 'geco', 'brain'];
        types.forEach(t => {
            const el = document.getElementById(`death-kills-${t}`);
            if (el) el.innerText = state.player.killsByType[t] || 0;
        });

        document.exitPointerLock();
        showHighscoresMenu();
    }
}

export function shoot() {
    // Allow shooting even if animation is playing (e.g. rapid fire), purely limited by cooldown
    if (state.player.animState === 'SWITCHING_DOWN' || state.player.animState === 'SWITCHING_UP') return;

    const weapon = state.player.weapons[state.player.weaponIndex];

    const now = performance.now();
    if (now - state.player.lastShot < weapon.cooldown) return;

    // Check Ammo
    let ammoCost = 1;
    if (weapon.name === 'SHOTGUN') ammoCost = 2;

    if (state.player.ammo[weapon.ammoType] < ammoCost && weapon.ammoType !== 0) {
        // Play No Ammo Sound
        audioManager.play('no_ammo');
        return;
    }

    // Check Chaingun Durability
    if (weapon.name === 'CHAINGUN' && state.player.chaingunDurability <= 0) {
        audioManager.play('no_ammo');
        return;
    }

    state.player.lastShot = now;

    // Increase crosshair spread on firing
    state.player.crosshairSpread = Math.min(1.0, state.player.crosshairSpread + 0.35);

    if (weapon.name === 'SONAR') {
        // Cycle Mode
        const modes = ['red', 'green', 'blue', 'totem'];
        let available = modes.filter(m => m === 'totem' || !state.player.inventory[m]);
        if (available.length === 0) available = ['totem']; // Fallback

        let currentIdx = available.indexOf(state.player.sonarMode);
        if (currentIdx === -1) currentIdx = 0;

        const nextIdx = (currentIdx + 1) % available.length;
        state.player.sonarMode = available[nextIdx];

        console.log('Sonar Mode:', state.player.sonarMode);
        updateHUD();
        return; // No shooting
    }

    // Play Weapon Sound
    if (weapon.name === 'PISTOL') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play(`pistol_fire_${idx}`);
    } else if (weapon.name === 'SHOTGUN') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play(`shotgun_fire_${idx}`);
    } else if (weapon.name === 'CHAINGUN') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play(`machinegun_fire_${idx}`);
    } else if (weapon.name === 'HEAVYMACHINEGUN') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play(`heavymachinegun_fire_${idx}`);
    } else if (weapon.name === 'CANNON') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play(`cannon_fire_${idx}`);
    } else if (weapon.name === 'AUTOSHOTGUN') {
        const idx = Math.floor(Math.random() * 4) + 1; // 1 to 4
        audioManager.play(`autoshotgun_fire_${idx}`); // e.g. autoshotgun_fire_1
    }

    if (weapon.ammoType !== 0) {
        state.player.ammo[weapon.ammoType] -= ammoCost;
    }

    if (weapon.name === 'CHAINGUN') {
        const heat = state.player.machineGunHeat;
        const wear = 1.0 + (heat / 5.0) * 1.5;
        state.player.chaingunDurability = Math.max(0, state.player.chaingunDurability - wear);
        if (state.player.chaingunDurability <= 0) {
            audioManager.play('no_ammo');
            console.log("CHAINGUN BROKE!");
        }
    }

    updateHUD();

    // Start Animation
    state.player.animState = 'FIRING';
    state.player.animFrame = 0;
    state.player.animTimer = 0;
    updateHUD();

    if (weapon.name === 'CANNON') {
        state.player.screenShakeIntensity = Math.max(state.player.screenShakeIntensity, 3.0);
        setTimeout(() => {
            if (state.gameState === 'PLAYING') {
                state.spawnProjectile(
                    state.player.x,
                    state.player.y,
                    state.player.dir,
                    'fireball',
                    8.0,
                    weapon.damage
                );
            }
        }, 500);
        return; // No raycast for cannon
    }

    if (weapon.name === 'LASER') {
        // Laser Logic: Trigger Charging if Idle
        if (state.player.laserState === 'IDLE') {
            state.player.laserState = 'CHARGING';
            state.player.laserTimer = 0;
            // Play Sound Immediate on Click
            audioManager.play('laser_fire');
        }
        return; // Raycast handled in game_core.js during FIRING state
    }

    // Raycast shoot
    const count = weapon.count || 1;
    for (let i = 0; i < count; i++) {
        const spread = (Math.random() - 0.5) * weapon.spread;
        const angle = state.player.dir + spread;
        const hit = castRay(Math.cos(angle), Math.sin(angle));

        // Collect all potential enemy hits along this ray
        let hits = [];

        state.enemies.forEach(e => {
            if (e.state === 'DOWN' || e.state === 'FLOOR' || e.state === 'HIT_FIRE' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2' || e.state === 'DOWN_SHOTGUN' || e.state === 'FLOOR_SHOTGUN' || e.state === 'HIT_SHOTGUN' || e.state.includes('V2')) return;

            const dx = e.x - state.player.x;
            const dy = e.y - state.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Ray vector
            const rx = Math.cos(angle);
            const ry = Math.sin(angle);

            // Project vector to enemy onto ray
            const proj = dx * rx + dy * ry;

            // Correct wall distance to Euclidean for comparison
            // hit.dist is perpendicular distance (fisheye corrected), we need real distance
            const wallDistEuclidean = hit.dist / Math.cos(angle - state.player.dir);

            // Check if enemy is in front and before the wall
            if (proj > 0 && proj < wallDistEuclidean) {
                // Perpendicular distance from ray to enemy center
                const perpDist = Math.abs(dx * -ry + dy * rx);
                const enemyRadius = 0.35; // Hitbox radius

                if (perpDist < enemyRadius) {
                    hits.push({ enemy: e, dist: dist, perpDist: perpDist });
                }
            }
        });

        // Sort hits by distance (closest first)
        hits.sort((a, b) => a.dist - b.dist);

        let wallHit = true; // Assume wall hit unless blocked by non-penetrating weapon hit

        if (hits.length > 0) {
            if (weapon.name === 'SHOTGUN') {
                // Penetrate ALL enemies
                hits.forEach(h => {
                    const e = h.enemy;
                    let damage = weapon.damage;

                    // Distance Falloff for Shotgun
                    // Close (1-3): High damage
                    // Far (4-5+): Low damage
                    if (h.dist < 2.0) {
                        damage *= 3.0; // 3x damage at point blank
                    } else if (h.dist < 4.0) {
                        damage *= 1.0; // Normal damage
                    } else {
                        damage *= 0.2; // Very low damage at range
                    }

                    applyDamage(e, damage, weapon.name, h.dist, h.perpDist, angle);
                });
                // Shotgun rays also hit the wall eventually (visuals)
            } else {
                // Standard Weapons: Hit ONLY the first enemy
                const h = hits[0];
                let damage = weapon.damage;
                if (weapon.name === 'CHAINGUN' && state.player.machineGunHeat > 4.0) {
                    damage += 3;
                }
                if (weapon.name === 'HEAVYMACHINEGUN' && state.player.heavyMachineGunHeat > 4.0) {
                    damage += 6; // Double the boost?
                }
                applyDamage(h.enemy, damage, weapon.name, h.dist, h.perpDist, angle);
                wallHit = false; // Blocked by enemy, don't draw wall decal
            }
        }

        if (wallHit) {
            state.decals.push({
                mapX: hit.mapX,
                mapY: hit.mapY,
                side: hit.side,
                wallX: hit.wallX,
                texIndex: Math.floor(Math.random() * 4),
                time: 15.0,
                zOffset: (Math.random() - 0.5) * 0.5 // Vertical spread
            });
        }
    }

    // Recoil/Animation
    const weaponEl = document.getElementById('weapon-sprite');
    weaponEl.style.transform = `translateY(20px) scale(1.1)`;
    setTimeout(() => weaponEl.style.transform = 'none', 100);
}

function triggerHitmarker(isHeadshot) {
    const standardEl = document.getElementById('hitmarker-standard');
    const headshotEl = document.getElementById('hitmarker-headshot');
    if (!standardEl || !headshotEl) return;

    standardEl.classList.remove('active');
    headshotEl.classList.remove('active');

    const activeEl = isHeadshot ? headshotEl : standardEl;
    // Force reflow to restart animation
    void activeEl.offsetWidth;
    activeEl.classList.add('active');

    if (isHeadshot) {
        audioManager.playHeadshotDing();
    }
}

function applyDamage(e, damage, weaponName, dist, perpDist, angle) {
    // Roll simulated vertical hit offset (0.0 to 1.0) on the target hitbox
    const verticalHit = Math.random();
    const isBulletWeapon = ['PISTOL', 'CHAINGUN', 'HEAVYMACHINEGUN', 'SHOTGUN', 'AUTOSHOTGUN'].includes(weaponName);
    const isHeadshot = isBulletWeapon && verticalHit >= 0.7;

    const dmgMultiplier = isHeadshot ? 2.0 : 1.0;
    const finalDmg = Math.round((e.isClimbing ? damage * 0.5 : damage) * dmgMultiplier);
    
    e.hp -= finalDmg;
    e.lastHitWasHeadshot = isHeadshot;

    // Spawn blood particles at enemy position
    spawnBloodParticles(e.x, e.y, angle + Math.PI);

    triggerHitmarker(isHeadshot);

    // Enemy Knockback
    // Calculate direction from player to enemy (normalized)
    // We already passed 'angle' which is the ray angle. We can use that.
    const kx = Math.cos(angle);
    const ky = Math.sin(angle);

    // Init velocity if not present
    if (!e.vx) e.vx = 0;
    if (!e.vy) e.vy = 0;

    let knockbackForce = 2.0; // Default small push

    if (weaponName === 'SHOTGUN') {
        if (dist < 3.0) knockbackForce = 5.0; // Reduced from 15.0
        else knockbackForce = 2.5; // Reduced from 8.0
    } else if (weaponName === 'CANNON') {
        knockbackForce = 10.0; // High impact
    } else if (weaponName === 'CHAINGUN') {
        knockbackForce = 2.0; // Small rapid pushes
    }

    e.vx += kx * knockbackForce;
    e.vy += ky * knockbackForce;

    if (e.hp <= 0) {
        if (e.state === 'HIT_FIRE' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2') return;

        if (e.isKillRoomEnemy) {
            e.isKillRoomEnemy = false;
            if (state.killRoom && state.killRoom.active) {
                state.killRoom.timer = 0;
            }
        }

        // Shotgun Close Range Kill Logic
        if (weaponName === 'SHOTGUN' && dist < 2.0) {
            e.state = 'HIT_SHOTGUN';
            e.hitTimer = 0.2; // Short hit frame before down
            e.deathTimer = (e.type === 'soldier') ? 0.5 : 1;
        } else {
            if (e.type === 'brain' && Math.random() < 0.5) {
                e.state = 'HIT_DEATH_V2';
                e.hitTimer = 0.2;
                e.deathTimer = 0.8;
            } else {
                e.state = 'DOWN';
                e.deathTimer = (e.type === 'soldier') ? 0.5 : 1; // 1 second before turning to floor
            }
        }

        state.player.kills++;
        state.player.totalKills++;

        // Track kills by type
        if (state.player.killsByType[e.type] !== undefined) {
            state.player.killsByType[e.type]++;
        }

        // --- COMBO SYSTEM ---
        state.player.comboCount++;
        state.player.comboTimer = CONFIG.comboDecayTime;
        state.player.comboMultiplier = Math.min(CONFIG.comboMaxMultiplier, 1 + Math.floor(state.player.comboCount / 3));

        // Update combo HUD
        const comboEl = document.getElementById('combo-display');
        if (comboEl) {
            if (state.player.comboMultiplier > 1) {
                comboEl.innerText = `x${state.player.comboMultiplier}`;
                comboEl.style.opacity = 1;
                comboEl.classList.add('combo-pop');
                setTimeout(() => comboEl.classList.remove('combo-pop'), 200);
            }
        }

        // Update Score (with combo multiplier and level multiplier)
        let scoreAwarded = 0;
        if (e.type === 'soldier') scoreAwarded = 100;
        else if (e.type === 'soldierB') scoreAwarded = 175;
        else if (e.type === 'monster' || e.type === 'monsterB2') scoreAwarded = 150;
        else if (e.type === 'geco') scoreAwarded = 200;
        else if (e.type === 'brain') scoreAwarded = 300;

        scoreAwarded *= state.player.comboMultiplier;

        // Award Headshot score bonus
        let headshotBonus = 0;
        if (e.lastHitWasHeadshot) {
            headshotBonus = 50 * state.player.comboMultiplier;
            scoreAwarded += headshotBonus;
        }

        const levelMultiplier = 1 + (state.level - 1) * 0.25;
        scoreAwarded = Math.round(scoreAwarded * levelMultiplier);

        state.player.score += scoreAwarded;

        // Award Coins
        let coinsAwarded = 0;
        if (e.type === 'soldier' || e.type === 'soldierB' || e.type === 'monster' || e.type === 'monsterB2') coinsAwarded = 2;
        else if (e.type === 'geco') coinsAwarded = 5;
        else if (e.type === 'brain') coinsAwarded = 15;

        state.player.coins += coinsAwarded;
        state.player.totalCoinsEarned += coinsAwarded;

        // --- ENEMY DROPS ---
        const dropConfig = CONFIG.dropChances[e.type];
        if (dropConfig && Math.random() < dropConfig.chance) {
            state.items.push({
                x: e.x,
                y: e.y,
                type: dropConfig.type
            });
        }

        // --- SCREEN SHAKE ON KILL ---
        state.player.screenShakeIntensity = Math.max(state.player.screenShakeIntensity, 3.0);

        updateHUD();
        if (e.lastHitWasHeadshot) {
            console.log(`HEADSHOT! Kill x${state.player.comboMultiplier}! +${scoreAwarded} score (includes +${headshotBonus} bonus), +${coinsAwarded} coins.`);
        } else {
            console.log(`Kill x${state.player.comboMultiplier}! +${scoreAwarded} score, +${coinsAwarded} coins.`);
        }

        // Play Death Sound
        if (e.type === 'monster') {
            const idx = Math.floor(Math.random() * 3);
            audioManager.play3D(`monster_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
        } else if (e.type === 'brain') {
            if (ASSETS.audio.brain.death.length > 0) {
                const idx = Math.floor(Math.random() * ASSETS.audio.brain.death.length);
                audioManager.play3D(`brain_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
            }
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
        e.hitTimer = 0.2; // Short hit flash

        // Play Hit Sound
        if (e.type === 'monster') {
            const idx = Math.floor(Math.random() * 5);
            audioManager.play3D(`monster_hit_${idx}`, e.x, e.y, state.player.x, state.player.y);
        } else if (e.type === 'brain') {
            if (ASSETS.audio.brain.hit && ASSETS.audio.brain.hit.length > 0) {
                const idx = Math.floor(Math.random() * ASSETS.audio.brain.hit.length);
                // Boost volume for brain hit
                audioManager.play3D(`brain_hit_${idx}`, e.x, e.y, state.player.x, state.player.y, 20, 2.0);
            }
        } else if (e.type === 'geco') {
            if (ASSETS.audio.geco.hit && ASSETS.audio.geco.hit.length > 0) {
                const idx = Math.floor(Math.random() * ASSETS.audio.geco.hit.length);
                // Boost volume for geco hit
                audioManager.play3D(`geco_hit_${idx}`, e.x, e.y, state.player.x, state.player.y, 20, 2.0);
            }
        } else {
            const idx = Math.floor(Math.random() * 6);
            audioManager.play3D(`zombie_hit_${idx}`, e.x, e.y, state.player.x, state.player.y);
        }
    }

    // Hit Marker
    const rx = Math.cos(angle);
    const ry = Math.sin(angle);
    const enemyRadius = 0.35;
    // Recalculate side for marker based on perpDist logic (simplified)
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const signedDist = dx * -ry + dy * rx;
    const side = signedDist > 0 ? 1 : -1;

    const ox = (perpDist / enemyRadius) * 0.3 * side;
    state.hitMarkers.push({ enemyId: e.id, ox: ox, oy: (Math.random() - 0.5) * 0.5, time: 0.5 });
}

export function killEnemyWithLaser(e, dist) {
    if (e.hp <= 0 && (e.state.includes('FLOOR') || e.state.includes('DOWN') || e.state.includes('V2'))) return; // Already dead

    e.hp = -999;
    if (e.isKillRoomEnemy) {
        e.isKillRoomEnemy = false;
        if (state.killRoom && state.killRoom.active) {
            state.killRoom.timer = 0;
        }
    }
    // Laser Touch = Instant Death with special animation

    // Set State
    // We need to map enemy type to specific hit_laser state if needed, or just use a generic logic if they all share naming convention
    // But we defined specific sprites in config.js.
    // Let's assume the state machine will handle the rendering if we set a specific state name.

    e.state = 'HIT_LASER_DEATH';
    e.hitTimer = 0.5; // Show the blue skeleton/laser hit frame for 0.5s
    e.deathTimer = 0; // Immediate transition to floor handled after hitTimer?
    // Actually user said: "reproduce el hit_laser del enemigo en cuestion, que reemplaza el primer frame de la animacion de fire_ball, luego sigue la animacion normal de Fire ball"
    // Wait. "replaces the first frame of the fire_ball animation, then follows the normal Fire ball animation"
    // So it acts like a Fire Kill, but the first frame is different.

    e.state = 'HIT_LASER';
    e.hitTimer = 2.0; // Wait, Fire ball death (HIT_FIRE) usually lasts 0.4s (4 frames?). 
    // Let's look at existing HIT_FIRE logic in game_core.js
    // "if (e.state === 'HIT_FIRE') ... if (e.animTimer > 0.4) ... e.frame++"
    // So HIT_FIRE iterates through frames.

    // Logic:
    // We want to reuse the Fire Death sequence, but swap the first frame or use a unique state that mimics it.
    // Simplest approach: Use 'HIT_LASER' state.
    // In game_core, we will handle 'HIT_LASER' similar to 'HIT_FIRE', but using the laser kill texture for the first frame.

    state.player.kills++;

    // Calculate Score
    let scoreAwarded = 0;
    if (e.type === 'soldier') scoreAwarded = 100;
    else if (e.type === 'soldierB') scoreAwarded = 175;
    else if (e.type === 'monster' || e.type === 'monsterB2') scoreAwarded = 150;
    else if (e.type === 'geco') scoreAwarded = 200;
    else if (e.type === 'brain') scoreAwarded = 300;
    state.player.score += scoreAwarded;

    // Coins
    let coinsAwarded = 0;
    if (e.type === 'soldier' || e.type === 'soldierB' || e.type === 'monster' || e.type === 'monsterB2') coinsAwarded = 2;
    else if (e.type === 'geco') coinsAwarded = 5;
    else if (e.type === 'brain') coinsAwarded = 15;
    state.player.coins += coinsAwarded;
    state.player.totalCoinsEarned += coinsAwarded;

    updateHUD();
    console.log("Laser Kill!");

    // Play Sound (Fire death or generic?)
    // User didn't specify death sound, just that it destroys them. 
    // We'll reuse the death sounds from applyDamage logic or fire logic.
    // For now, let's play the standard death sound for feedback.
    if (e.type === 'monster') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play3D(`monster_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
    } else if (e.type === 'brain') {
        const idx = Math.floor(Math.random() * 2); // Fallback if no array length check
        audioManager.play3D(`brain_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
    } else if (e.type === 'geco') {
        const idx = Math.floor(Math.random() * 3);
        audioManager.play3D(`geco_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
    } else {
        const idx = Math.floor(Math.random() * 2);
        audioManager.play3D(`zombie_death_${idx}`, e.x, e.y, state.player.x, state.player.y);
    }
}

export function switchWeapon(idx) {
    if (state.player.animState !== 'IDLE') return;
    if (state.player.weaponIndex === idx) return;

    // Check if weapon is unlocked
    if (!state.player.weapons[idx].unlocked) {
        console.log(`Weapon ${state.player.weapons[idx].name} is locked.`);
        return;
    }

    // Allow switching even if empty (to show no ammo sprite)
    // Start Switch Animation (Down)
    state.player.animState = 'SWITCHING_DOWN';
    state.player.nextWeaponIndex = idx;
    state.player.animTimer = 0;

    // Visual effect handled in updateHUD via CSS transform
    const weaponEl = document.getElementById('weapon-sprite');
    weaponEl.style.transition = 'transform 0.2s ease-in';
    weaponEl.style.transform = 'translateY(100%)';
}

export function shootLaserFrame() {
    // Continuous Raycast for Laser Beam
    const weapon = state.player.weapons[6]; // Laser
    const beamCount = 3;
    const beamSpread = 0.02;

    for (let b = 0; b < beamCount; b++) {
        const offset = (b - 1) * beamSpread;
        const angle = state.player.dir + offset;

        const hit = castRay(Math.cos(angle), Math.sin(angle));

        // Check if laser hits a cracked wall
        const cellVal = state.map.data[hit.mapY * state.map.width + hit.mapX];
        if (cellVal === CONFIG.destructibleWallTexIndex) {
            state.map.data[hit.mapY * state.map.width + hit.mapX] = 0;
            audioManager.play3D('cannon_fire_0', hit.mapX + 0.5, hit.mapY + 0.5, state.player.x, state.player.y);
            state.explosions.push({
                x: hit.mapX + 0.5, y: hit.mapY + 0.5,
                frame: 0, timer: 0,
                type: 'wall'
            });
            for (let j = 0; j < 15; j++) {
                const pAngle = Math.random() * Math.PI * 2;
                const spd = 2.0 + Math.random() * 4.0;
                state.particles.push({
                    wX: hit.mapX + 0.5, wY: hit.mapY + 0.5,
                    x: 0, y: 0,
                    vx: Math.cos(pAngle) * spd,
                    vy: Math.sin(pAngle) * spd - 1.0,
                    life: CONFIG.bloodParticleLife * (0.8 + Math.random() * 0.6),
                    maxLife: CONFIG.bloodParticleLife,
                    size: 1 + Math.random() * 3,
                    color: 'rgb(80, 80, 80)'
                });
            }
            console.log(`DESTRUCTIBLE WALL BLOWN UP by Laser at ${hit.mapX}, ${hit.mapY}`);
        }

        // Enemy Check logic (Simplified from shoot)
        state.enemies.forEach(e => {
            if (e.hp <= 0 && (e.state.includes('FLOOR') || e.state.includes('DOWN') || e.state.includes('HIT_FIRE') || e.state.includes('V2'))) return;

            const dx = e.x - state.player.x;
            const dy = e.y - state.player.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Ray vector
            const rx = Math.cos(angle);
            const ry = Math.sin(angle);

            // Project vector to enemy onto ray
            const proj = dx * rx + dy * ry;

            const wallDistEuclidean = hit.dist / Math.cos(angle - state.player.dir);

            if (proj > 0 && proj < wallDistEuclidean) {
                const perpDist = Math.abs(dx * -ry + dy * rx);
                const enemyRadius = 0.5; // Slightly larger for laser to feel generous

                if (perpDist < enemyRadius) {
                    killEnemyWithLaser(e, dist);
                }
            }
        });
    }
}

export function buyWeapon(weaponName) {
    if (weaponName === 'AUTOSHOTGUN' && state.level < 3) {
        console.log("Autoshotgun unlocks at Level 3");
        // Play error sound?
        return false;
    }

    const weapon = state.player.weapons.find(w => w.name === weaponName);
    if (!weapon) return false;
    
    const isBrokenChaingun = (weaponName === 'CHAINGUN' && weapon.unlocked && state.player.chaingunDurability <= 0);
    if (weapon.unlocked && !isBrokenChaingun) return true; // Already unlocked

    if (state.player.coins >= weapon.price) {
        state.player.coins -= weapon.price;
        if (isBrokenChaingun) {
            state.player.chaingunDurability = 1000;
            console.log(`Repaired/Replaced CHAINGUN for ${weapon.price} coins.`);
        } else {
            weapon.unlocked = true;
            if (weaponName === 'CHAINGUN') {
                state.player.chaingunDurability = 1000;
            }
            console.log(`Bought ${weaponName} for ${weapon.price} coins.`);
        }
        updateHUD();
        audioManager.play('fx_crystal'); // Reuse crystal sound for now
        return true;
    } else {
        console.log(`Not enough coins for ${weaponName}. Need ${weapon.price}, have ${state.player.coins}`);
        return false;
    }
}

export function refillAmmo() {
    const cost = 30;
    if (state.player.coins >= cost) {
        state.player.coins -= cost;

        state.player.weapons.forEach(w => {
            if (w.name === 'HEAVYMACHINEGUN') return;
            if (w.maxAmmo && w.maxAmmo !== Infinity) {
                const current = state.player.ammo[w.ammoType];
                if (current < w.maxAmmo) {
                    state.player.ammo[w.ammoType] = w.maxAmmo;
                }
            }
        });

        updateHUD();
        console.log("Ammo Refilled");
        audioManager.play('fx_crystal');
        return true;
    } else {
        console.log("Not enough coins for ammo refill");
        return false;
    }
}

export function restoreHealth() {
    const cost = 25;
    if (state.player.health >= 100) {
        console.log("Health already full");
        return false;
    }

    if (state.player.coins >= cost) {
        state.player.coins -= cost;
        state.player.health = 100;
        updateHUD();
        console.log("Health Restored");
        audioManager.play('fx_crystal');
        return true;
    } else {
        console.log("Not enough coins for health restore");
        return false;
    }
}

window.buyWeapon = buyWeapon;
window.refillAmmo = refillAmmo;
window.restoreHealth = restoreHealth;

export function toggleSonar() {
    if (state.player.weaponIndex === 4) {
        // Currently holding Sonar, switch back to last weapon
        switchWeapon(state.player.lastWeaponIndex);
        console.log(`Toggled Sonar OFF. Switching to ${state.player.weapons[state.player.lastWeaponIndex].name}`);
    } else {
        // Not holding Sonar, save current and switch to Sonar
        state.player.lastWeaponIndex = state.player.weaponIndex;
        switchWeapon(4);
        console.log(`Toggled Sonar ON. Saved last weapon: ${state.player.weapons[state.player.lastWeaponIndex].name}`);
    }
}

export function updateShopUI() {
    const btnShotgun = document.querySelector('#shop-item-shotgun .buy-btn');
    const btnChaingun = document.querySelector('#shop-item-chaingun .buy-btn');
    const btnCannon = document.querySelector('#shop-item-cannon .buy-btn');
    const btnAutoShotgun = document.querySelector('#shop-item-autoshotgun .buy-btn');

    if (btnShotgun) {
        const wp = state.player.weapons.find(w => w.name === 'SHOTGUN');
        if (wp.unlocked) {
            btnShotgun.innerText = 'OWNED';
            btnShotgun.classList.add('owned');
        } else {
            btnShotgun.innerText = 'BUY';
            btnShotgun.classList.remove('owned');
        }
    }

    if (btnChaingun) {
        const wp = state.player.weapons.find(w => w.name === 'CHAINGUN');
        if (wp.unlocked) {
            if (state.player.chaingunDurability <= 0) {
                btnChaingun.innerText = 'REPAIR';
                btnChaingun.classList.remove('owned');
            } else {
                btnChaingun.innerText = 'OWNED';
                btnChaingun.classList.add('owned');
            }
        } else {
            btnChaingun.innerText = 'BUY';
            btnChaingun.classList.remove('owned');
        }
    }

    if (btnCannon) {
        const wp = state.player.weapons.find(w => w.name === 'CANNON');
        if (wp.unlocked) {
            btnCannon.innerText = 'OWNED';
            btnCannon.classList.add('owned');
        } else {
            btnCannon.innerText = 'BUY';
            btnCannon.classList.remove('owned');
        }
    }

    if (btnAutoShotgun) {
        const wp = state.player.weapons.find(w => w.name === 'AUTOSHOTGUN');
        if (state.level < 3) {
            btnAutoShotgun.innerText = 'LOCKED (LVL 3)';
            btnAutoShotgun.classList.add('locked');
            btnAutoShotgun.classList.remove('owned');
        } else if (wp.unlocked) {
            btnAutoShotgun.innerText = 'OWNED';
            btnAutoShotgun.classList.add('owned');
            btnAutoShotgun.classList.remove('locked');
        } else {
            btnAutoShotgun.innerText = 'BUY';
            btnAutoShotgun.classList.remove('owned', 'locked');
        }
    }
}

// ===== HIGHSCORE SYSTEM =====
let highscoreListenerInitialized = false;

function initHighscoresListeners() {
    if (highscoreListenerInitialized) return;
    const saveBtn = document.getElementById('btn-save-highscore');
    const nameInput = document.getElementById('highscore-name-input');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            submitHighscore();
        });
        highscoreListenerInitialized = true;
    }
    if (nameInput) {
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                submitHighscore();
            }
        });
    }
}

function submitHighscore() {
    const nameInput = document.getElementById('highscore-name-input');
    if (!nameInput) return;
    let name = nameInput.value.trim().toUpperCase();
    if (!name) return; // Do not save empty name
    
    // Save to local storage
    const score = state.player.score;
    const level = state.level;
    let highscores = getHighscores();
    highscores.push({ name, score, level, date: Date.now() });
    
    // Sort descending by score, then by level
    highscores.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.level - a.level;
    });
    
    // Keep top 5
    highscores = highscores.slice(0, 5);
    localStorage.setItem('raycaster_highscores', JSON.stringify(highscores));
    
    // Hide form and update table
    const formContainer = document.getElementById('highscore-form-container');
    if (formContainer) formContainer.style.display = 'none';
    
    renderHighscoresTable();
}

function getHighscores() {
    try {
        const stored = localStorage.getItem('raycaster_highscores');
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to read highscores from localStorage:", e);
        return [];
    }
}

export function showHighscoresMenu() {
    initHighscoresListeners();
    
    // Reset form display
    const formContainer = document.getElementById('highscore-form-container');
    if (formContainer) formContainer.style.display = 'block';
    
    const nameInput = document.getElementById('highscore-name-input');
    if (nameInput) {
        nameInput.value = '';
        nameInput.disabled = false;
    }
    
    renderHighscoresTable();
}

function renderHighscoresTable() {
    const tableBody = document.getElementById('highscore-table-body');
    if (!tableBody) return;
    
    const highscores = getHighscores();
    tableBody.innerHTML = '';
    
    for (let i = 0; i < 5; i++) {
        const entry = highscores[i];
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #333';
        
        const tdRank = document.createElement('td');
        tdRank.style.padding = '5px';
        tdRank.innerText = `${i + 1}`;
        
        const tdName = document.createElement('td');
        tdName.style.padding = '5px';
        tdName.innerText = entry ? entry.name : '---';
        
        const tdLevel = document.createElement('td');
        tdLevel.style.padding = '5px';
        tdLevel.style.textAlign = 'center';
        tdLevel.innerText = entry ? entry.level : '--';
        
        const tdScore = document.createElement('td');
        tdScore.style.padding = '5px';
        tdScore.style.textAlign = 'right';
        tdScore.style.color = 'yellow';
        tdScore.innerText = entry ? entry.score : '----';
        
        tr.appendChild(tdRank);
        tr.appendChild(tdName);
        tr.appendChild(tdLevel);
        tr.appendChild(tdScore);
        
        tableBody.appendChild(tr);
    }
}
