/**
 * mobile.js — Controles táctiles para RayCaster V3
 * D-pad, zona cámara+disparo, barra de armas, botones HUD, editor de layout
 */

import { state } from './state.js';
import { audioManager } from './audio.js';

// ─── Referencias al juego (seteadas en init) ──────────────────────────────────
let _shoot = null;
let _togglePause = null;
let _switchWeaponFn = null;

// ─── Constantes de layout por defecto ────────────────────────────────────────
const DEFAULT_LAYOUT = {
    dpad:       { x: 20,   y: null, bottom: 20, right: null },  // bottom-left
    weaponBar:  { x: null, y: 80,   bottom: null, right: 12 },  // right side, below map btn
    menuBtn:    { x: 12,   y: 12,   bottom: null, right: null }, // top-left
    mapBtn:     { x: null, y: 12,   bottom: null, right: 12 },  // top-right
};

// ─── Estado táctil de la zona de cámara ───────────────────────────────────────
let lookTouch = null;       // { id, startX, startY, lastX, lastY }
let lookSwipeFired = false; // evita disparos/sprint repetidos por swipe
const SWIPE_THRESHOLD = 40; // px mínimos para activar acción vertical

// ─── Sprint virtual (mobile) ──────────────────────────────────────────────────
let mobileSprintActive = false;

// ─── D-pad state ─────────────────────────────────────────────────────────────
const dpadKeys = {
    up:    'KeyW',
    down:  'KeyS',
    left:  'KeyA',
    right: 'KeyD',
};

// ─── Drag-and-drop editor ─────────────────────────────────────────────────────
let editMode = false;
let dragTarget = null;
let dragOffsetX = 0, dragOffsetY = 0;

// ─── Inicialización principal ─────────────────────────────────────────────────
export function initMobileControls(shoot, togglePause, switchWeapon) {
    _shoot = shoot;
    _togglePause = togglePause;
    _switchWeaponFn = switchWeapon;

    loadLayout();
    applyLayout();
    bindDpad();
    bindLookZone();
    bindMenuBtn();
    bindMapBtn();
    bindWeaponBar();
    bindEditControls();

    console.log('[Mobile] Controls initialized');
}

// ─── Layout: cargar / guardar / aplicar ──────────────────────────────────────
function loadLayout() {
    const saved = localStorage.getItem('mobileControlsLayout');
    if (saved) {
        try {
            state.mobileControlsLayout = JSON.parse(saved);
        } catch(e) {
            state.mobileControlsLayout = deepClone(DEFAULT_LAYOUT);
        }
    } else {
        state.mobileControlsLayout = deepClone(DEFAULT_LAYOUT);
    }
}

function saveLayout() {
    localStorage.setItem('mobileControlsLayout', JSON.stringify(state.mobileControlsLayout));
}

function applyLayout() {
    const layout = state.mobileControlsLayout;
    applyPos('mobile-dpad',       layout.dpad);
    applyPos('mobile-weapon-bar', layout.weaponBar);
    applyPos('mobile-menu-btn',   layout.menuBtn);
    applyPos('mobile-map-btn',    layout.mapBtn);
}

function applyPos(id, pos) {
    const el = document.getElementById(id);
    if (!el || !pos) return;

    el.style.left   = pos.x      != null ? `${pos.x}px`      : '';
    el.style.right  = pos.right  != null ? `${pos.right}px`  : '';
    el.style.top    = pos.y      != null ? `${pos.y}px`       : '';
    el.style.bottom = pos.bottom != null ? `${pos.bottom}px` : '';
}

// ─── D-pad ────────────────────────────────────────────────────────────────────
function bindDpad() {
    const directions = ['up', 'down', 'left', 'right'];
    directions.forEach(dir => {
        const btn = document.getElementById(`dpad-${dir}`);
        if (!btn) return;

        const keyCode = dpadKeys[dir];

        btn.addEventListener('touchstart', e => {
            e.preventDefault();
            state.keys[keyCode] = true;
        }, { passive: false });

        btn.addEventListener('touchend', e => {
            e.preventDefault();
            state.keys[keyCode] = false;
        }, { passive: false });

        btn.addEventListener('touchcancel', e => {
            e.preventDefault();
            state.keys[keyCode] = false;
        }, { passive: false });
    });
}

// ─── Zona de cámara + disparo/sprint ─────────────────────────────────────────
function bindLookZone() {
    const zone = document.getElementById('mobile-look-zone');
    if (!zone) return;

    zone.addEventListener('touchstart', e => {
        e.preventDefault();
        if (state.gameState !== 'PLAYING') return;
        if (lookTouch !== null) return; // solo 1 toque en la zona de cámara

        const t = e.changedTouches[0];
        lookTouch = {
            id: t.identifier,
            startX: t.clientX,
            startY: t.clientY,
            lastX:  t.clientX,
            lastY:  t.clientY,
        };
        lookSwipeFired = false;
        mobileSprintActive = false;
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!lookTouch || state.gameState !== 'PLAYING') return;

        // Encontrar el toque correcto
        let t = null;
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === lookTouch.id) {
                t = e.changedTouches[i];
                break;
            }
        }
        if (!t) return;

        const dx = t.clientX - lookTouch.lastX;
        const dy = t.clientY - lookTouch.startY; // relativo al inicio para swipe

        // Rotación de cámara (horizontal)
        state.player.dir += dx * 0.005;

        lookTouch.lastX = t.clientX;
        lookTouch.lastY = t.clientY;

        // --- Swipe vertical para acciones ---
        if (!lookSwipeFired) {
            if (dy < -SWIPE_THRESHOLD) {
                // Deslizar arriba → DISPARAR
                if (_shoot) _shoot();
                lookSwipeFired = true;
            } else if (dy > SWIPE_THRESHOLD) {
                // Deslizar abajo → SPRINT (activar mientras el dedo sigue abajo)
                mobileSprintActive = true;
                state.keys['ShiftLeft'] = true;
                lookSwipeFired = true;
            }
        }
    }, { passive: false });

    zone.addEventListener('touchend', e => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === lookTouch?.id) {
                lookTouch = null;
                lookSwipeFired = false;
                if (mobileSprintActive) {
                    mobileSprintActive = false;
                    state.keys['ShiftLeft'] = false;
                }
                break;
            }
        }
    }, { passive: false });

    zone.addEventListener('touchcancel', e => {
        lookTouch = null;
        lookSwipeFired = false;
        mobileSprintActive = false;
        state.keys['ShiftLeft'] = false;
    }, { passive: false });
}

// ─── Botón menú ───────────────────────────────────────────────────────────────
function bindMenuBtn() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        if (_togglePause) _togglePause();
    }, { passive: false });
}

// ─── Botón mapa ───────────────────────────────────────────────────────────────
function bindMapBtn() {
    const btn = document.getElementById('mobile-map-btn');
    if (!btn) return;
    btn.addEventListener('touchstart', e => {
        e.preventDefault();
        state.showMap = !state.showMap;
        audioManager.play('fx_crystal');
    }, { passive: false });
}

// ─── Barra de armas ───────────────────────────────────────────────────────────
export function updateWeaponBar() {
    const bar = document.getElementById('mobile-weapon-bar');
    if (!bar) return;

    bar.innerHTML = '';
    const weapons = state.player.weapons;

    weapons.forEach((w, idx) => {
        if (!w.unlocked) return;

        const btn = document.createElement('button');
        btn.className = 'mobile-weapon-btn' + (idx === state.player.weaponIndex ? ' active' : '');
        btn.dataset.weaponIndex = idx;
        btn.setAttribute('id', `mobile-weapon-${idx}`);

        // Ícono: nombre corto
        btn.innerHTML = getWeaponIcon(w.name);

        btn.addEventListener('touchstart', ev => {
            ev.preventDefault();
            if (_switchWeaponFn) _switchWeaponFn(idx);
        }, { passive: false });

        bar.appendChild(btn);
    });
}

function bindWeaponBar() {
    updateWeaponBar();
}

function getWeaponIcon(name) {
    const icons = {
        'PISTOL':       '🔫',
        'SHOTGUN':      '💥',
        'CHAINGUN':     '⚙️',
        'CANNON':       '💣',
        'SONAR':        '📡',
        'HEAVYMACHINEGUN': '🔥',
        'LASER':        '⚡',
        'AUTOSHOTGUN':  '🌪️',
    };
    return icons[name] || '🔫';
}

// ─── Editor de posición de controles (drag & drop) ───────────────────────────
function bindEditControls() {
    // Botón "Edit Controls" en pausa
    const btnEdit = document.getElementById('mobile-edit-controls-btn');
    if (btnEdit) {
        btnEdit.addEventListener('click', enterEditMode);
        btnEdit.addEventListener('touchstart', e => {
            e.preventDefault();
            enterEditMode();
        }, { passive: false });
    }

    // Botón "Done" (se crea al entrar a edit mode)
}

export function enterEditMode() {
    editMode = true;

    // Cerrar pausa primero para ver los controles
    const pauseMenu = document.getElementById('pause-menu');
    if (pauseMenu) pauseMenu.classList.add('hidden');

    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) mobileControls.classList.add('editing');

    // Crear botón Done en el centro
    let doneBtn = document.getElementById('mobile-edit-done-btn');
    if (!doneBtn) {
        doneBtn = document.createElement('button');
        doneBtn.id = 'mobile-edit-done-btn';
        doneBtn.textContent = 'DONE ✓';
        doneBtn.className = 'mobile-edit-done';
        document.body.appendChild(doneBtn);
    }
    doneBtn.style.display = 'flex';

    doneBtn.addEventListener('click', exitEditMode, { once: true });
    doneBtn.addEventListener('touchstart', e => {
        e.preventDefault();
        exitEditMode();
    }, { passive: false, once: true });

    // Habilitar drag en cada control
    const draggables = ['mobile-dpad', 'mobile-weapon-bar', 'mobile-menu-btn', 'mobile-map-btn'];
    draggables.forEach(id => enableDrag(id));
}

function exitEditMode() {
    editMode = false;

    const mobileControls = document.getElementById('mobile-controls');
    if (mobileControls) mobileControls.classList.remove('editing');

    const doneBtn = document.getElementById('mobile-edit-done-btn');
    if (doneBtn) doneBtn.style.display = 'none';

    // Guardar posiciones actuales
    persistCurrentPositions();
    saveLayout();

    console.log('[Mobile] Layout saved:', state.mobileControlsLayout);
}

function enableDrag(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.add('draggable');

    // Touch events
    el.addEventListener('touchstart', onDragStart, { passive: false });
    el.addEventListener('touchmove',  onDragMove,  { passive: false });
    el.addEventListener('touchend',   onDragEnd,   { passive: false });

    // Mouse fallback (desktop testing)
    el.addEventListener('mousedown', onMouseDragStart);
}

function onDragStart(e) {
    if (!editMode) return;
    e.preventDefault();
    e.stopPropagation();

    dragTarget = e.currentTarget;
    const t = e.touches[0];
    const rect = dragTarget.getBoundingClientRect();
    dragOffsetX = t.clientX - rect.left;
    dragOffsetY = t.clientY - rect.top;

    dragTarget.classList.add('dragging');
    dragTarget.style.right  = '';
    dragTarget.style.bottom = '';
}

function onDragMove(e) {
    if (!editMode || !dragTarget) return;
    e.preventDefault();
    e.stopPropagation();

    const t = e.touches[0];
    const newX = t.clientX - dragOffsetX;
    const newY = t.clientY - dragOffsetY;

    // Clamp dentro de la pantalla
    const maxX = window.innerWidth  - dragTarget.offsetWidth;
    const maxY = window.innerHeight - dragTarget.offsetHeight;

    dragTarget.style.left = `${Math.max(0, Math.min(maxX, newX))}px`;
    dragTarget.style.top  = `${Math.max(0, Math.min(maxY, newY))}px`;
}

function onDragEnd(e) {
    if (!dragTarget) return;
    e.preventDefault();
    dragTarget.classList.remove('dragging');
    dragTarget = null;
}

// Mouse fallback for desktop testing
function onMouseDragStart(e) {
    if (!editMode) return;
    e.preventDefault();
    dragTarget = e.currentTarget;
    const rect = dragTarget.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    dragTarget.classList.add('dragging');
    dragTarget.style.right  = '';
    dragTarget.style.bottom = '';

    document.addEventListener('mousemove', onMouseDragMove);
    document.addEventListener('mouseup',   onMouseDragEnd, { once: true });
}

function onMouseDragMove(e) {
    if (!dragTarget) return;
    const newX = e.clientX - dragOffsetX;
    const newY = e.clientY - dragOffsetY;
    const maxX = window.innerWidth  - dragTarget.offsetWidth;
    const maxY = window.innerHeight - dragTarget.offsetHeight;
    dragTarget.style.left = `${Math.max(0, Math.min(maxX, newX))}px`;
    dragTarget.style.top  = `${Math.max(0, Math.min(maxY, newY))}px`;
}

function onMouseDragEnd() {
    if (dragTarget) {
        dragTarget.classList.remove('dragging');
        dragTarget = null;
    }
    document.removeEventListener('mousemove', onMouseDragMove);
}

function persistCurrentPositions() {
    const keys = {
        'mobile-dpad':       'dpad',
        'mobile-weapon-bar': 'weaponBar',
        'mobile-menu-btn':   'menuBtn',
        'mobile-map-btn':    'mapBtn',
    };

    Object.entries(keys).forEach(([id, layoutKey]) => {
        const el = document.getElementById(id);
        if (!el) return;
        state.mobileControlsLayout[layoutKey] = {
            x:      parseInt(el.style.left)   || 0,
            y:      parseInt(el.style.top)    || 0,
            right:  null,
            bottom: null,
        };
    });
}

// ─── Utilidades ───────────────────────────────────────────────────────────────
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

/**
 * Llamar desde game_main.js cuando se muestra/oculta el mobile controls overlay.
 * También actualiza la barra de armas para reflejar el estado actual.
 */
export function refreshMobileUI() {
    updateWeaponBar();
}
