import { state } from './state.js';
import { updateHUD, switchWeapon, toggleSonar } from './player.js';
import { audioManager } from './audio.js';
import { CONFIG } from './config.js';

let inputBuffer = '';

function cycleWeapon(dir) {
    if (state.player.animState !== 'IDLE') return;

    const weapons = state.player.weapons;
    let idx = state.player.weaponIndex;

    for (let i = 0; i < weapons.length; i++) {
        idx = (idx + dir + weapons.length) % weapons.length;
        if (weapons[idx].unlocked) {
            switchWeapon(idx);
            break;
        }
    }
}

export function initInput(canvas, startGame, shoot, togglePause, nextLevel) {
    window.addEventListener('wheel', e => {
        if (state.gameState === 'PLAYING') {
            const dir = e.deltaY > 0 ? 1 : -1;
            cycleWeapon(dir);
        }
    });

    window.addEventListener('keydown', e => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
            if (e.code === 'Escape') document.activeElement.blur();
            return;
        }
        state.keys[e.code] = true;
        if (e.code === 'Escape') togglePause();

        // Cheat Detection
        if (state.gameState === 'PLAYING') {
            inputBuffer += e.key.toLowerCase();
            if (inputBuffer.length > 10) {
                inputBuffer = inputBuffer.slice(-10);
            }
            if (inputBuffer.endsWith('lvsac')) {
                state.player.coins += 200;
                updateHUD();
                audioManager.play('fx_crystal');
                console.log('CHEAT ACTIVATED: 200 Coins Added');
                inputBuffer = ''; // Reset buffer
            }
            // Cheat: Level Skip
            if (inputBuffer.endsWith('544958')) {
                console.log('CHEAT ACTIVATED: Level Skip');
                audioManager.play('fx_totem_end');
                inputBuffer = '';
                nextLevel();
            }
            // Cheat: Unlock Heavy Machine Gun
            if (inputBuffer.endsWith('abrojo')) {
                console.log('CHEAT ACTIVATED: HEAVY MACHINE GUN');
                state.player.weapons[5].unlocked = true;
                state.player.ammo[5] = 1000;
                updateHUD();
                audioManager.play('heavymachinegun_pickup');
                switchWeapon(5);
                inputBuffer = '';
            }
            // Ink Clearing (Press E)
            if (e.code === 'KeyE') {
                if (state.player.inkBlindnessTimer > 0) {
                    state.player.inkClearCount++;
                    console.log(`Clearing ink... ${state.player.inkClearCount}/7`);
                    if (state.player.inkClearCount >= 7) {
                        state.player.inkBlindnessTimer = 0;
                        state.player.inkClearCount = 0;
                        const ink = document.getElementById('ink-overlay');
                        if (ink) ink.style.opacity = 0;
                        console.log("Ink Cleared!");
                        audioManager.play('fx_ink_wipe');
                    }
                }
            }

            if (e.code === 'KeyQ') {
                toggleSonar();
            }

            if (e.code === 'KeyM') {
                state.showMap = !state.showMap;
                audioManager.play('fx_crystal');
                console.log(`MAP TOGGLED: ${state.showMap}`);
            }

            // Cheat: Unlock Laser (Inventor)
            if (inputBuffer.endsWith('inventor')) {
                console.log('CHEAT ACTIVATED: LASER UNLOCKED');
                state.player.weapons[6].unlocked = true; // Laser index
                updateHUD();
                audioManager.play('fx_totem_end'); // Or laser firing sound? totem_end is distinct.
                switchWeapon(6);
                inputBuffer = '';
            }
        }
    });
    window.addEventListener('keyup', e => state.keys[e.code] = false);

    const btnStart = document.getElementById('btn-start');
    const btnStartMobile = document.getElementById('btn-start-mobile');
    const introVideo = document.getElementById('intro-video');

    // Helper to launch history/intro screen
    const launchIntro = () => {
        const startMenu = document.getElementById('start-menu');
        if (startMenu) startMenu.classList.add('hidden');
        const historyScreen = document.getElementById('history-screen');
        if (historyScreen) {
            historyScreen.classList.remove('hidden');
            
            // Set dynamic skip hint text based on mode
            const skipHint = document.getElementById('skip-hint');
            if (skipHint) {
                if (state.mobileMode) {
                    skipHint.innerText = 'TAP TO SKIP';
                } else {
                    skipHint.innerText = 'Press SPACE to Skip';
                }
            }

            if (introVideo) {
                introVideo.currentTime = 0;
                introVideo.play().catch(e => console.error("Video play failed:", e));
                introVideo.focus();
            }
        }
    };

    if (btnStart) {
        btnStart.addEventListener('click', () => {
            state.mobileMode = false;
            launchIntro();
        });
    } else {
        console.error("CRITICAL: btn-start not found!");
    }

    if (btnStartMobile) {
        btnStartMobile.addEventListener('click', () => {
            state.mobileMode = true;
            launchIntro();
        });
    }

    const historyScreen = document.getElementById('history-screen');
    const skipIntro = () => {
        if (introVideo) {
            introVideo.pause();
            introVideo.currentTime = 0;
        }
        if (historyScreen) historyScreen.classList.add('hidden');
        // Remove listener to prevent multiple triggers
        window.removeEventListener('keydown', skipListener);
        startGame();
    };

    const skipListener = (e) => {
        if (historyScreen && !historyScreen.classList.contains('hidden')) {
            if (e.code === 'Space') {
                skipIntro();
            }
        }
    };
    window.addEventListener('keydown', skipListener);

    if (introVideo) {
        introVideo.addEventListener('ended', skipIntro);
    }

    // Skip on click OR touch (important for mobile)
    if (historyScreen) {
        historyScreen.addEventListener('click', () => {
            if (!historyScreen.classList.contains('hidden')) skipIntro();
        });
        historyScreen.addEventListener('touchstart', (e) => {
            if (!historyScreen.classList.contains('hidden')) {
                e.preventDefault();
                skipIntro();
            }
        }, { passive: false });
    }

    const levelCompleteScreen = document.getElementById('level-complete-screen');
    if (levelCompleteScreen) {
        levelCompleteScreen.addEventListener('click', nextLevel);
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) btnRestart.addEventListener('click', startGame);

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) btnResume.addEventListener('click', togglePause);

    canvas.addEventListener('mousedown', (e) => {
        if (state.gameState === 'PLAYING') {
            if (!state.mobileMode && document.pointerLockElement !== canvas) {
                try {
                    canvas.requestPointerLock();
                } catch (err) {
                    console.warn("Pointer lock failed:", err);
                }
            }
            if (e.button === 0) state.mouseLeft = true;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) state.mouseLeft = false;
    });

    document.addEventListener('mousemove', e => {
        if (!state.mobileMode && document.pointerLockElement === canvas && state.gameState === 'PLAYING') {
            state.player.dir += e.movementX * 0.002;
        }
    });
}
