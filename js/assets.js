import { ASSETS } from './config.js';
import { state } from './state.js';
import { audioManager } from './audio.js';

export function getTextureData(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, c.width, c.height).data;
}

// Helper to load images
const loadImg = (src, key) => {
    const img = new Image();
    img.onload = () => {
        if (key) state.textureData[key] = getTextureData(img);
    };
    img.onerror = () => console.error(`Failed to load: ${src}`);
    img.src = src;
    return img;
};

const WALL_STYLES_CONFIG = [
    // Level 1
    { level: 1, dir: 'assets/enviroment/Wall_Textures/Level1', prefix: 'wall_metal_texture', min: 0, max: 7 },
    // Level 2
    { level: 2, dir: 'assets/enviroment/Wall_Textures/level2', prefix: 'wall_brick_texture', min: 1, max: 8 },
    { level: 2, dir: 'assets/enviroment/Wall_Textures/level2', prefix: 'wall_stone_texture', min: 1, max: 8 },
    // Level 3
    { level: 3, dir: 'assets/enviroment/Wall_Textures/Level3', prefix: 'wall_blackStone_texture', min: 0, max: 3 },
    { level: 3, dir: 'assets/enviroment/Wall_Textures/Level3', prefix: 'wall_blakcStone_texture', min: 0, max: 12 },
    // Level 4
    { level: 4, dir: 'assets/enviroment/Wall_Textures/Level4', prefix: 'wall_BlackBrick2_texture', min: 0, max: 14 },
    // Level 5
    { level: 5, dir: 'assets/enviroment/Wall_Textures/Level5', prefix: 'wall_hospitall_texture', min: 0, max: 16 },
    // Level 6
    { level: 6, dir: 'assets/enviroment/Wall_Textures/Level6', prefix: 'wall_brick_texture', min: 0, max: 7 },
    { level: 6, dir: 'assets/enviroment/Wall_Textures/Level6', prefix: 'wall_stone_texture', min: 0, max: 11 }
];

export function loadLevelAssets(level) {
    console.log(`ASSETS: Loading textures for Level ${level}...`);

    let floorRoot, roofRoot;
    let floorFiles, ceilConfigs;

    const useLvl = ((level - 1) % 6) + 1;

    const DESTRUCTIBLE_WALL_INDEX_BY_LEVEL = {
        1: 7,   // Level 1: wall_metal_texture7
        2: 23,  // Level 2: wall_stone_texture8
        3: 40,  // Level 3: wall_blakcStone_texture12
        4: 55,  // Level 4: wall_BlackBrick2_texture14
        5: 72,  // Level 5: wall_hospitall_texture16
        6: 92   // Level 6: wall_stone_texture11
    };
    state.currentDestructibleWallTexIdx = DESTRUCTIBLE_WALL_INDEX_BY_LEVEL[useLvl] || 7;

    if (useLvl === 2) {
        // LEVEL 2 CONFIGURATION
        floorRoot = `assets/enviroment/Floor_textures/Level2`;
        roofRoot = `assets/enviroment/Roof_textures/Level2`;

        floorFiles = [
            'floor_carpet_texture.png', 'floor_cobble_texture.png', 'floor_metal_texture.png',
            'floor_tile_texture.png', 'floor_tile_texture_v2.png', 'floor_wood_texture_v2.png'
        ];

        ceilConfigs = [
            { name: 'ceil_rock_texture.png', dir: roofRoot },
            { name: 'ceil_stone1_texture.png', dir: roofRoot },
            { name: 'ceil_stone2_texture.png', dir: roofRoot },
            { name: 'ceil_wood_texture.png', dir: roofRoot },
            { name: 'celi_wood_texture.png', dir: roofRoot }
        ];

    } else if (useLvl === 3) {
        // LEVEL 3 CONFIGURATION
        floorRoot = `assets/enviroment/Floor_textures/Level3`;
        roofRoot = `assets/enviroment/Roof_textures/Level3`;

        floorFiles = [
            'floor_stone1_texture.png', 'floor_stone2_texture.png', 'floor_stone3_texture.png',
            'floor_stone4_texture.png', 'floor_stone5_texture.png'
        ];

        ceilConfigs = [
            { name: 'celi_light_texture.png', dir: roofRoot },
            { name: 'celi_wood1_texture.png', dir: roofRoot },
            { name: 'celi_wood2_texture.png', dir: roofRoot },
            { name: 'celi_wood3_texture.png', dir: roofRoot },
            { name: 'celi_wood4_texture.png', dir: roofRoot }
        ];

    } else if (useLvl === 4) {
        // LEVEL 4 CONFIGURATION
        floorRoot = `assets/enviroment/Floor_textures/Level4`;
        roofRoot = `assets/enviroment/Roof_textures/Level4`;

        floorFiles = [
            'floor_stone1_texture.png', 'floor_stone2_texture.png', 'floor_stone3_texture.png',
            'floor_stone4_texture.png'
        ];

        ceilConfigs = [
            { name: 'celi_wood1_texture.png', dir: roofRoot },
            { name: 'celi_wood2_texture.png', dir: roofRoot },
            { name: 'celi_wood3_texture.png', dir: roofRoot },
            { name: 'celi_wood4_texture.png', dir: roofRoot },
            { name: 'celi_wood5_texture.png', dir: roofRoot }
        ];

    } else if (useLvl === 5) {
        // LEVEL 5 CONFIGURATION (Hospital Theme)
        floorRoot = `assets/enviroment/Floor_textures/Level5`;
        roofRoot = `assets/enviroment/Roof_textures/Level5`;

        floorFiles = [
            'floor_tile1_texture.png', 'floor_tile2_texture.png', 'floor_tile3_texture.png',
            'floor_tile4_texture.png', 'floor_wood_texture.png'
        ];

        ceilConfigs = [
            { name: 'celi_texture1.png', dir: roofRoot },
            { name: 'celi_texture2.png', dir: roofRoot },
            { name: 'celi_texture3.png', dir: roofRoot },
            { name: 'celi_texture4.png', dir: roofRoot },
            { name: 'celi_wood3_texture.png', dir: roofRoot }
        ];

    } else if (useLvl === 6) {
        // LEVEL 6 CONFIGURATION (Brick/Stone - Fallback Floor)
        floorRoot = `assets/enviroment/Floor_textures/Level5`; // Using Level 5 floors as Level 6 folder is empty
        roofRoot = `assets/enviroment/Roof_textures/Level6`;

        // Reusing Level 5 floor files
        floorFiles = [
            'floor_tile1_texture.png', 'floor_tile2_texture.png', 'floor_tile3_texture.png',
            'floor_tile4_texture.png', 'floor_wood_texture.png'
        ];

        ceilConfigs = [
            { name: 'celi_tiles1_texture.png', dir: roofRoot },
            { name: 'celi_wood1_texture.png', dir: roofRoot },
            { name: 'celi_wood2_texture.png', dir: roofRoot },
            { name: 'celi_wood3_texture.png', dir: roofRoot }
        ];

    } else {
        // LEVEL 1 (Default) CONFIGURATION
        floorRoot = `assets/enviroment/Floor_textures/Level1`;
        roofRoot = `assets/enviroment/Roof_textures/Level1`;

        floorFiles = [
            'floor_metal2_texture.png', 'floor_metal_texture.png', 'floor_rock1_texture.png',
            'floor_rock2_texture.png', 'floor_stone_texture.png'
        ];

        ceilConfigs = [
            { name: 'celi_light_texture.png', dir: roofRoot },
            { name: 'celi_metal_texture.png', dir: roofRoot },
            { name: 'celi_tile1_texture.png', dir: roofRoot },
            { name: 'celi_tile2_texture.png', dir: roofRoot },
            { name: 'celi_wood1_texture.png', dir: roofRoot }
        ];
    }

    // Load Floors
    state.textures.floors = floorFiles.map((file, i) => loadImg(`${floorRoot}/${file}`, `floor_${i}`));

    // Load Ceilings
    state.textures.ceils = ceilConfigs.map((cfg, i) => loadImg(`${cfg.dir}/${cfg.name}`, `ceil_${i}`));

    // Update references
    state.textures.floor = state.textures.floors[0];
    state.textures.ceil = state.textures.ceils[0];
}

export function initAssets() {
    console.log("ASSETS: Starting initAssets...");
    try {
        // We need a place to store raw texture data for pixel manipulation
        state.textureData = {};

        // Load ALL wall textures at start and build style indices
        state.textures.walls = [];
        state.wallStyles = [];
        let wallIndex = 0;
        WALL_STYLES_CONFIG.forEach(cfg => {
            const count = cfg.max - cfg.min + 1;
            state.wallStyles.push({
                level: cfg.level,
                baseIdx: wallIndex,
                count: count
            });
            for (let i = cfg.min; i <= cfg.max; i++) {
                state.textures.walls.push(loadImg(`${cfg.dir}/${cfg.prefix}${i}.png`));
                wallIndex++;
            }
        });

        // Load Level 1 Textures by default
        loadLevelAssets(1);

        state.sprites.pistol = loadImg(ASSETS.sprites.pistol);
        state.sprites.shotgun = loadImg(ASSETS.sprites.shotgun);
        state.sprites.machinegun = loadImg(ASSETS.sprites.machinegun);

        state.sprites.pistolFrames = ASSETS.sprites.pistolFrames.map(src => loadImg(src));
        state.sprites.shotgunFrames = ASSETS.sprites.shotgunFrames.map(src => loadImg(src));
        state.sprites.shotgunNoAmmo = loadImg(ASSETS.sprites.shotgunNoAmmo);
        state.sprites.machinegunFrames = ASSETS.sprites.machinegunFrames.map(src => loadImg(src));
        state.sprites.machinegunNoAmmo = loadImg(ASSETS.sprites.machinegunNoAmmo);
        state.sprites.machinegunBroken = loadImg(ASSETS.sprites.machinegunBroken);

        state.sprites.autoShotgunFrames = ASSETS.sprites.autoShotgunFrames.map(src => loadImg(src));
        state.sprites.autoShotgunHotFrames = ASSETS.sprites.autoShotgunHotFrames.map(src => loadImg(src));
        state.sprites.autoShotgunNoAmmo = loadImg(ASSETS.sprites.autoShotgunNoAmmo);

        // Removed duplicate machinegunFrames line
        state.sprites.wallHoles = ASSETS.sprites.wallHoles.map(src => loadImg(src));

        console.log("ASSETS: Loading Cannon Frames...");
        if (!ASSETS.sprites.cannonFrames) console.error("ASSETS: cannonFrames undefined in config!");
        state.sprites.cannonFrames = ASSETS.sprites.cannonFrames.map(src => loadImg(src));
        state.sprites.cannonNoAmmo = loadImg(ASSETS.sprites.cannonNoAmmo);

        state.sprites.heavymachinegun = loadImg(ASSETS.sprites.heavymachinegun);
        state.sprites.heavymachinegunFrames = ASSETS.sprites.heavymachinegunFrames.map(src => loadImg(src));
        state.sprites.heavymachinegunHotFrames = ASSETS.sprites.heavymachinegunHotFrames.map(src => loadImg(src));
        state.sprites.heavymachinegunCooldown = loadImg(ASSETS.sprites.heavymachinegunCooldown);
        state.sprites.heavymachinegunPickup = loadImg(ASSETS.sprites.heavymachinegunPickup);
        state.sprites.heavymachinegunNoAmmo = loadImg(ASSETS.sprites.heavymachinegunNoAmmo);

        console.log("ASSETS: Loading Laser Frames...");
        state.sprites.laserFrames = ASSETS.sprites.laserFrames.map(src => loadImg(src));

        // Load Laser Hit Sprites
        state.sprites.monsterHitLaser = loadImg(ASSETS.sprites.monsterHitLaser);
        state.sprites.monsterB2HitLaser = loadImg(ASSETS.sprites.monsterB2HitLaser);
        state.sprites.brainHitLaser = loadImg(ASSETS.sprites.brainHitLaser);
        state.sprites.gecoHitLaser = loadImg(ASSETS.sprites.gecoHitLaser);
        state.sprites.soldierHitLaser = loadImg(ASSETS.sprites.soldierHitLaser);
        state.sprites.soldierBHitLaser = loadImg(ASSETS.sprites.soldierBHitLaser);

        console.log("ASSETS: Loading Fireball...");
        if (!ASSETS.sprites.fireball) console.error("ASSETS: fireball undefined in config!");
        state.sprites.fireball = ASSETS.sprites.fireball.map(src => loadImg(src));

        state.sprites.fireballExplosion = ASSETS.sprites.fireballExplosion.map(src => loadImg(src));
        state.sprites.fireballDecal = loadImg(ASSETS.sprites.fireballDecal);

        // Load Animated Sprites
        state.sprites.soldier = ASSETS.sprites.soldier.map(src => loadImg(src));
        state.sprites.soldier0 = loadImg(ASSETS.sprites.soldier0);
        state.sprites.soldierStand = loadImg(ASSETS.sprites.soldierStand);
        state.sprites.soldierAttack = loadImg(ASSETS.sprites.soldierAttack);
        state.sprites.soldierHit = loadImg(ASSETS.sprites.soldierHit);
        state.sprites.soldierHitFire = ASSETS.sprites.soldierHitFire.map(src => loadImg(src));
        state.sprites.soldierHitShotgun = loadImg(ASSETS.sprites.soldierHitShotgun);
        state.sprites.soldierDown = loadImg(ASSETS.sprites.soldierDown);
        state.sprites.soldierDownShotgun = loadImg(ASSETS.sprites.soldierDownShotgun);
        state.sprites.soldierFloor = loadImg(ASSETS.sprites.soldierFloor);
        state.sprites.soldierFloorShotgun = loadImg(ASSETS.sprites.soldierFloorShotgun);
        state.sprites.soldierFloorFire1 = loadImg(ASSETS.sprites.soldierFloorFire1);
        state.sprites.soldierFloorFire1 = loadImg(ASSETS.sprites.soldierFloorFire1);
        state.sprites.soldierFloorFire2 = loadImg(ASSETS.sprites.soldierFloorFire2);

        state.sprites.soldierB = ASSETS.sprites.soldierB.map(src => loadImg(src));
        state.sprites.soldierBHit = loadImg(ASSETS.sprites.soldierBHit);
        state.sprites.soldierBHitFire = ASSETS.sprites.soldierBHitFire.map(src => loadImg(src));
        state.sprites.soldierBHitShotgun = loadImg(ASSETS.sprites.soldierBHitShotgun);
        state.sprites.soldierBDown = loadImg(ASSETS.sprites.soldierBDown);
        state.sprites.soldierBDownShotgun = loadImg(ASSETS.sprites.soldierBDownShotgun);
        state.sprites.soldierBFloor = loadImg(ASSETS.sprites.soldierBFloor);
        state.sprites.soldierBFloorShotgun = loadImg(ASSETS.sprites.soldierBFloorShotgun);
        state.sprites.soldierBFloorFire1 = loadImg(ASSETS.sprites.soldierBFloorFire1);
        state.sprites.soldierBFloorFire2 = loadImg(ASSETS.sprites.soldierBFloorFire2);

        state.sprites.monster = ASSETS.sprites.monster.map(src => loadImg(src));
        state.sprites.monsterRun = ASSETS.sprites.monsterRun.map(src => loadImg(src));
        state.sprites.monsterHit = loadImg(ASSETS.sprites.monsterHit);
        state.sprites.monsterHitFire = ASSETS.sprites.monsterHitFire.map(src => loadImg(src));
        state.sprites.monsterHitShotgun = loadImg(ASSETS.sprites.monsterHitShotgun);
        state.sprites.monsterDown = loadImg(ASSETS.sprites.monsterDown);
        state.sprites.monsterDownShotgun = loadImg(ASSETS.sprites.monsterDownShotgun);
        state.sprites.monsterFloor = loadImg(ASSETS.sprites.monsterFloor);
        state.sprites.monsterFloorShotgun = loadImg(ASSETS.sprites.monsterFloorShotgun);
        state.sprites.monsterFloorFire1 = loadImg(ASSETS.sprites.monsterFloorFire1);
        state.sprites.monsterFloorFire2 = loadImg(ASSETS.sprites.monsterFloorFire2);

        state.sprites.monsterB2 = ASSETS.sprites.monsterB2.map(src => loadImg(src));
        state.sprites.monsterB2Run = ASSETS.sprites.monsterB2Run.map(src => loadImg(src));
        state.sprites.monsterB2Hit = loadImg(ASSETS.sprites.monsterB2Hit);
        state.sprites.monsterB2HitFire = ASSETS.sprites.monsterB2HitFire.map(src => loadImg(src));
        state.sprites.monsterB2HitShotgun = loadImg(ASSETS.sprites.monsterB2HitShotgun);
        state.sprites.monsterB2Down = loadImg(ASSETS.sprites.monsterB2Down);
        state.sprites.monsterB2DownShotgun = loadImg(ASSETS.sprites.monsterB2DownShotgun);
        state.sprites.monsterB2Floor = loadImg(ASSETS.sprites.monsterB2Floor);
        state.sprites.monsterB2FloorShotgun = loadImg(ASSETS.sprites.monsterB2FloorShotgun);
        state.sprites.monsterB2FloorFire1 = loadImg(ASSETS.sprites.monsterB2FloorFire1);
        state.sprites.monsterB2FloorFire2 = loadImg(ASSETS.sprites.monsterB2FloorFire2);

        state.sprites.brain = ASSETS.sprites.brain.map(src => loadImg(src));
        state.sprites.brainAttack = ASSETS.sprites.brainAttack.map(src => loadImg(src));
        state.sprites.brainHit = loadImg(ASSETS.sprites.brainHit);
        state.sprites.brainHitShotgun = loadImg(ASSETS.sprites.brainHitShotgun);
        state.sprites.brainDown = loadImg(ASSETS.sprites.brainDown);
        state.sprites.brainDownShotgun = loadImg(ASSETS.sprites.brainDownShotgun);
        state.sprites.brainFloor = loadImg(ASSETS.sprites.brainFloor);
        state.sprites.brainFloorShotgun = loadImg(ASSETS.sprites.brainFloorShotgun);
        state.sprites.brainHit2 = loadImg(ASSETS.sprites.brainHit2);
        state.sprites.brainDown2 = loadImg(ASSETS.sprites.brainDown2);
        state.sprites.brainFloor3 = loadImg(ASSETS.sprites.brainFloor3);
        state.sprites.brainHitFire = ASSETS.sprites.brainHitFire.map(src => loadImg(src));
        state.sprites.brainFloorFire1 = loadImg(ASSETS.sprites.brainFloorFire1);
        state.sprites.brainFloorFire2 = loadImg(ASSETS.sprites.brainFloorFire2);
        state.sprites.brainTeleport = ASSETS.sprites.brainTeleport.map(src => loadImg(src));

        state.sprites.geco = ASSETS.sprites.geco.map(src => loadImg(src));
        state.sprites.gecoAttack = ASSETS.sprites.gecoAttack.map(src => loadImg(src));
        state.sprites.gecoHit = loadImg(ASSETS.sprites.gecoHit);
        state.sprites.gecoHitShotgun = loadImg(ASSETS.sprites.gecoHitShotgun);
        state.sprites.gecoDown = loadImg(ASSETS.sprites.gecoDown);
        state.sprites.gecoDownShotgun = loadImg(ASSETS.sprites.gecoDownShotgun);
        state.sprites.gecoFloor = loadImg(ASSETS.sprites.gecoFloor);
        state.sprites.gecoFloorShotgun = loadImg(ASSETS.sprites.gecoFloorShotgun);
        state.sprites.gecoHitFire = ASSETS.sprites.gecoHitFire.map(src => loadImg(src));
        state.sprites.gecoFloorFire1 = loadImg(ASSETS.sprites.gecoFloorFire1);
        state.sprites.gecoFloorFire2 = loadImg(ASSETS.sprites.gecoFloorFire2);
        state.sprites.gecoInkBall = loadImg(ASSETS.sprites.gecoInkBall);
        state.sprites.gecoInkScreen = loadImg(ASSETS.sprites.gecoInkScreen);

        state.sprites.energyBall = loadImg(ASSETS.sprites.energyBall);

        console.log("ASSETS: Loading Gun Man sprites...", ASSETS.sprites.gunMan);
        state.sprites.gunMan = ASSETS.sprites.gunMan.map(src => loadImg(src));
        state.sprites.shopAutoShotgun = loadImg(ASSETS.sprites.shopAutoShotgun);

        // Load Ammo
        state.sprites.ammoShotgun = loadImg(ASSETS.sprites.ammoShotgun);
        state.sprites.ammoMachinegun = loadImg(ASSETS.sprites.ammoMachinegun);
        state.sprites.ammoCannon = loadImg(ASSETS.sprites.ammoCannon);
        state.sprites.addLife = loadImg(ASSETS.sprites.addLife);
        state.sprites.coin_big_pile = loadImg(ASSETS.sprites.coin_big_pile);
        state.sprites.coin_small_pile = loadImg(ASSETS.sprites.coin_small_pile);
        state.sprites.totemRed = loadImg(ASSETS.sprites.totemRed);
        state.sprites.totemGreen = loadImg(ASSETS.sprites.totemGreen);
        state.sprites.totemBlue = loadImg(ASSETS.sprites.totemBlue);
        state.sprites.totemEmpty = loadImg(ASSETS.sprites.totemEmpty);
        state.sprites.totemFull = loadImg(ASSETS.sprites.totemFull);
        state.sprites.arenaTriggerOff = loadImg(ASSETS.sprites.arenaTriggerOff);
        state.sprites.arenaTriggerOn = loadImg(ASSETS.sprites.arenaTriggerOn);
        state.sprites.kiligRoomActive = loadImg(ASSETS.sprites.kiligRoomActive);
        state.sprites.kiligRoomDone = loadImg(ASSETS.sprites.kiligRoomDone);

        // Load Sonar
        state.sprites.sonarRed = ASSETS.sprites.sonarRed.map(src => loadImg(src));
        state.sprites.sonarGreen = ASSETS.sprites.sonarGreen.map(src => loadImg(src));
        state.sprites.sonarBlue = ASSETS.sprites.sonarBlue.map(src => loadImg(src));
        state.sprites.sonarTotem = ASSETS.sprites.sonarTotem.map(src => loadImg(src));

        // Load Environment Sprites
        state.sprites.barrel = loadImg(ASSETS.sprites.barrel);
        state.sprites.lamp = loadImg(ASSETS.sprites.lamp);
        state.sprites.lamp2 = loadImg(ASSETS.sprites.lamp2);
        state.sprites.lamp3 = loadImg(ASSETS.sprites.lamp3);
        state.sprites.chair = loadImg(ASSETS.sprites.chair);
        state.sprites.chair2 = loadImg(ASSETS.sprites.chair2);
        state.sprites.hanger = loadImg(ASSETS.sprites.hanger);

        // Load Audio
        const loadAudio = (src, key) => {
            audioManager.load(key, src);
        };

        ASSETS.audio.monster.sb.forEach((src, i) => loadAudio(src, `monster_sb_${i}`));
        ASSETS.audio.monster.hit.forEach((src, i) => loadAudio(src, `monster_hit_${i}`));
        ASSETS.audio.monster.hit.forEach((src, i) => loadAudio(src, `monster_hit_${i}`));
        ASSETS.audio.monster.death.forEach((src, i) => loadAudio(src, `monster_death_${i}`));
        ASSETS.audio.monster.attack.forEach((src, i) => loadAudio(src, `monster_attack_${i}`));

        ASSETS.audio.zombie.dtc.forEach((src, i) => loadAudio(src, `zombie_dtc_${i}`));
        ASSETS.audio.zombie.hit.forEach((src, i) => loadAudio(src, `zombie_hit_${i}`));
        ASSETS.audio.zombie.hit.forEach((src, i) => loadAudio(src, `zombie_hit_${i}`));
        ASSETS.audio.zombie.death.forEach((src, i) => loadAudio(src, `zombie_death_${i}`));
        ASSETS.audio.zombie.attack.forEach((src, i) => loadAudio(src, `zombie_attack_${i}`));

        ASSETS.audio.brain.sb.forEach((src, i) => loadAudio(src, `brain_sb_${i}`));
        ASSETS.audio.brain.attack.forEach((src, i) => loadAudio(src, `brain_attack_${i}`));
        ASSETS.audio.brain.death.forEach((src, i) => loadAudio(src, `brain_death_${i}`));
        ASSETS.audio.brain.hitFire.forEach((src, i) => loadAudio(src, `brain_hit_fire_${i}`));
        if (ASSETS.audio.brain.hit) ASSETS.audio.brain.hit.forEach((src, i) => loadAudio(src, `brain_hit_${i}`));

        ASSETS.audio.geco.sb.forEach((src, i) => loadAudio(src, `geco_sb_${i}`));
        ASSETS.audio.geco.attack.forEach((src, i) => loadAudio(src, `geco_attack_${i}`));
        ASSETS.audio.geco.death.forEach((src, i) => loadAudio(src, `geco_death_${i}`));
        if (ASSETS.audio.geco.hit) ASSETS.audio.geco.hit.forEach((src, i) => loadAudio(src, `geco_hit_${i}`));

        // Load Weapon Sounds
        ASSETS.audio.weapons.pistol.forEach((src, i) => loadAudio(src, `pistol_fire_${i}`));
        ASSETS.audio.weapons.shotgun.forEach((src, i) => loadAudio(src, `shotgun_fire_${i}`));
        ASSETS.audio.weapons.autoshotgun.forEach((src, i) => loadAudio(src, `autoshotgun_fire_${i + 1}`)); // Autoshotgun uses 1-based indexing in config names, keeping consistent 0 or 1 based? Player.js uses +1
        ASSETS.audio.weapons.machinegun.forEach((src, i) => loadAudio(src, `machinegun_fire_${i}`));
        loadAudio(ASSETS.audio.weapons.sonar.center, 'sonar_center');
        loadAudio(ASSETS.audio.weapons.sonar.center, 'sonar_center');
        loadAudio(ASSETS.audio.weapons.sonar.side, 'sonar_side');

        console.log("ASSETS: Loading Cannon Audio...");
        if (!ASSETS.audio.weapons.cannon) console.error("ASSETS: cannon audio undefined in config!");
        ASSETS.audio.weapons.cannon.forEach((src, i) => loadAudio(src, `cannon_fire_${i}`));

        ASSETS.audio.weapons.heavymachinegun.forEach((src, i) => loadAudio(src, `heavymachinegun_fire_${i}`));
        loadAudio(ASSETS.audio.weapons.heavymachinegunPickup, 'heavymachinegun_pickup');

        loadAudio(ASSETS.audio.weapons.noAmmo, 'no_ammo');
        loadAudio(ASSETS.audio.weapons.laser, 'laser_fire');

        if (ASSETS.audio.music && Array.isArray(ASSETS.audio.music)) {
            ASSETS.audio.music.forEach((src, i) => loadAudio(src, `bg_music_${i + 1}`));
            state.musicCount = ASSETS.audio.music.length;
        } else {
            // Fallback for object logic or empty
            if (ASSETS.audio.music.bg1) loadAudio(ASSETS.audio.music.bg1, 'bg_music_1');
            state.musicCount = 1;
        }

        // Load FX Sounds
        loadAudio(ASSETS.audio.fx.ammoShotgun, 'fx_ammo_shotgun');
        loadAudio(ASSETS.audio.fx.ammoMachinegun, 'fx_ammo_machinegun');
        loadAudio(ASSETS.audio.fx.ammoCannon, 'fx_ammo_cannon');
        loadAudio(ASSETS.audio.fx.crystal, 'fx_crystal');
        loadAudio(ASSETS.audio.fx.totemEnd, 'fx_totem_end');
        loadAudio(ASSETS.audio.fx.inkWipe, 'fx_ink_wipe');

        console.log("ASSETS: initAssets completed successfully.");
    } catch (e) {
        console.error("ASSETS: Critical error in initAssets:", e);
    }
}
