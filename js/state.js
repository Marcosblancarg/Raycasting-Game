console.log("STATE: Module loading...");
export const state = {
    gameState: 'MENU',
    lastTime: 0,
    showMinimap: false,
    showMap: false,
    level: 1,

    // --- MOBILE MODE ---
    mobileMode: false,
    mobileControlsLayout: null, // Loaded from localStorage or default on init
    levelStartTime: 0,
    player: {
        x: 0, y: 0, dir: 0,
        vx: 0, vy: 0, // Velocity
        health: 100,
        weaponIndex: 0,
        lastWeaponIndex: 0,
        ammo: { 0: Infinity, 1: 16, 2: 200, 3: Infinity, 4: 20, 5: 0 },
        weapons: [
            { name: 'PISTOL', damage: 15, cooldown: 400, sprite: 'pistol', frames: 'pistolFrames', animSpeed: 0.35, ammoType: 0, spread: 0.05, maxAmmo: Infinity, unlocked: true },
            { name: 'SHOTGUN', damage: 10, count: 20, cooldown: 1000, sprite: 'shotgun', frames: 'shotgunFrames', animSpeed: 0.80, ammoType: 1, spread: 0.8, maxAmmo: 16, unlocked: false, price: 45 },
            { name: 'CHAINGUN', damage: 10, cooldown: 100, sprite: 'machinegun', frames: 'machinegunFrames', animSpeed: 0.10, ammoType: 2, spread: 0.1, maxAmmo: 200, unlocked: false, price: 65 },
            { name: 'CANNON', damage: 100, cooldown: 1000, sprite: 'cannon', frames: 'cannonFrames', animSpeed: 0.8, ammoType: 4, spread: 0, projectileSpeed: 15.0, maxAmmo: 20, unlocked: false, price: 100 },
            { name: 'SONAR', damage: 0, cooldown: 500, sprite: 'sonarTotem', frames: null, animSpeed: 0, ammoType: 3, spread: 0, maxAmmo: Infinity, unlocked: true },
            { name: 'HEAVYMACHINEGUN', damage: 20, cooldown: 50, sprite: 'heavymachinegun', frames: 'heavymachinegunFrames', animSpeed: 0.05, ammoType: 5, spread: 0.1, maxAmmo: 1000, unlocked: false, price: 0 },
            { name: 'LASER', damage: 9999, cooldown: 500, sprite: 'laser', frames: 'laserFrames', animSpeed: 0, ammoType: 0, spread: 0, maxAmmo: Infinity, unlocked: true }, // Infinite ammo, cooldown managed manually
            { name: 'AUTOSHOTGUN', damage: 10, count: 12, cooldown: 200, sprite: 'shotgun', frames: 'autoShotgunFrames', animSpeed: 0.5, ammoType: 1, spread: 0.35, maxAmmo: 200, unlocked: false, price: 1000 }
        ],
        coins: 0,
        lastShot: 0,
        bobbing: 0,
        animState: 'IDLE',
        animFrame: 0,
        animTimer: 0,
        kills: 0,
        score: 0,
        inventory: { red: false, green: false, blue: false },
        sonarMode: 'totem',
        machineGunHeat: 0,
        machineGunOverheated: false,
        chaingunDurability: 1000,
        machineGunCooldownTimer: 0,
        heavyMachineGunHeat: 0,
        heavyMachineGunOverheated: false,
        heavyMachineGunCooldownTimer: 0,
        autoShotgunHeat: 0,
        autoShotgunOverheated: false,
        inkBlindnessTimer: 0,
        inkClearCount: 0,
        laserState: 'IDLE', // IDLE, CHARGING, FIRING, COOLDOWN
        laserTimer: 0,

        // --- NEW: Combo System ---
        comboCount: 0,
        comboMultiplier: 1,
        comboTimer: 0, // Seconds since last kill

        // --- NEW: Dash/Dodge ---
        dashCooldown: 0, // Seconds remaining until dash is available
        dashActive: false,
        dashTimer: 0,
        dashDirX: 0,
        dashDirY: 0,
        lastTapA: 0, // Timestamp of last A key press for double-tap detection
        lastTapD: 0, // Timestamp of last D key press

        // --- NEW: Screen Shake ---
        screenShakeIntensity: 0,
        screenShakeTimer: 0,

        // --- NEW: Kill stats for death recap ---
        totalKills: 0,
        killsByType: { soldier: 0, soldierB: 0, monster: 0, monsterB2: 0, brain: 0, geco: 0 },
        totalCoinsEarned: 0,
        weaponsUnlocked: 0,
        gameStartTime: 0,

        // --- NEW: Crosshair ---
        crosshairSpread: 0, // Current visual spread (0 = tight, 1 = wide)

        // --- STAMINA SYSTEM ---
        stamina: 100,
        staminaCooldown: 0, // Seconds before stamina can regenerate after depleting
        staminaDepleted: false,

        // --- LAST DAMAGE TIME (for passive regen / directional indicator) ---
        lastDamageTime: 0,
    },
    map: null,
    rooms: [],
    enemies: [],
    npcs: [],
    items: [],
    projectiles: [],
    explosions: [],
    decals: [],
    particles: [], // Blood/impact particles
    hitMarkers: [],
    gates: [],
    fogStart: 4.0,
    fogEnd: 14.0,
    textures: {},
    sprites: {},
    keys: {},
    mouseLeft: false,

    // --- NEW: Kill Room state ---
    killRoom: {
        active: false,
        roomIndex: -1,
        wave: 0,
        maxWaves: 3,
        enemiesRemaining: 0,
        sealedWalls: [], // Positions of walls placed to seal room
        rewards: { coins: 0, health: 0 }
    },

    // --- NEW: Secret Walls ---
    secretWalls: [], // { x, y, discovered: false }

    // --- NEW: Totem Guardians ---
    totemGuardians: [], // { totemIndex, enemies: [], activated: false }
};

// Pre-allocate projectile pool of 64 objects to avoid GC pressure
const PROJECTILE_POOL_SIZE = 64;
state.projectilePool = Array.from({ length: PROJECTILE_POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    dir: 0,
    type: '',
    speed: 0,
    damage: 0,
    frame: 0,
    animTimer: 0
}));

// Helper to spawn projectile from pool
state.spawnProjectile = function(x, y, dir, type, speed, damage) {
    const p = state.projectilePool.find(item => !item.active);
    if (!p) {
        console.warn("Projectile pool exhausted!");
        return null;
    }
    p.active = true;
    p.x = x;
    p.y = y;
    p.dir = dir;
    p.type = type;
    p.speed = speed;
    p.damage = damage;
    p.frame = 0;
    p.animTimer = 0;
    state.projectiles.push(p);
    return p;
};

// Helper to clear projectiles and reset pool active flags
state.clearProjectiles = function() {
    state.projectiles = [];
    if (state.projectilePool) {
        state.projectilePool.forEach(p => p.active = false);
    }
};
