export const ASSETS = {
    textures: {
        wallTextures: [
            'assets/Wall_Textures/wall_brick_texture1.png',
            'assets/Wall_Textures/wall_brick_texture2.png',
            'assets/Wall_Textures/wall_brick_texture3.png',
            'assets/Wall_Textures/wall_brick_texture4.png',
            'assets/Wall_Textures/wall_brick_texture5.png',
            'assets/Wall_Textures/wall_brick_texture6.png',
            'assets/Wall_Textures/wall_brick_texture7.png',
            'assets/Wall_Textures/wall_brick_texture8.png',
            'assets/Wall_Textures/wall_stone_texture1.png',
            'assets/Wall_Textures/wall_stone_texture2.png',
            'assets/Wall_Textures/wall_stone_texture3.png',
            'assets/Wall_Textures/wall_stone_texture4.png',
            'assets/Wall_Textures/wall_stone_texture5.png',
            'assets/Wall_Textures/wall_stone_texture6.png',
            'assets/Wall_Textures/wall_stone_texture7.png',
            'assets/Wall_Textures/wall_stone_texture8.png'
        ],
        floorTextures: [
            'assets/floor_wood_texture_v2.png',
            'assets/floor_tile_texture_v2.png',
            'assets/floor_metal_texture.png',
            'assets/floor_carpet_texture.png',
            'assets/floor_cobble_texture.png'
        ],
        ceilTextures: [
            'assets/ceil_stone_texture.png',
            'assets/ceil_wood_texture.png',
            'assets/floor_metal_texture.png', // Reusing metal floor
            'assets/floor_tile_texture_v2.png', // Reusing tile floor
            'assets/floor_wood_texture_v2.png'  // Reusing wood floor
        ]
    },
    sprites: {
        pistol: 'assets/Gun/weapon_pistol_F1.png',
        shotgun: 'assets/Gun/weapon_shotgun_F1.png',
        machinegun: 'assets/Gun/weapon_machinegun_F1.png',
        pistolFrames: ['assets/Gun/weapon_pistol_F1.png', 'assets/Gun/weapon_pistol_F2.png', 'assets/Gun/weapon_pistol_F3.png', 'assets/Gun/weapon_pistol_F4.png'],

        shotgunFrames: [
            'assets/Gun/weapon_shotgun_F1.png',
            'assets/Gun/weapon_shotgun_F2.png',
            'assets/Gun/weapon_shotgun_F3.png',
            'assets/Gun/weapon_shotgun_F4.png',
            'assets/Gun/weapon_shotgun_F5.png'
        ],
        shotgunNoAmmo: 'assets/Gun/shotgun_noammo.png',
        machinegunFrames: ['assets/Gun/weapon_machinegun_F1.png', 'assets/Gun/weapon_machinegun_F2.png', 'assets/Gun/weapon_machinegun_F3.png', 'assets/Gun/weapon_machinegun_F4.png'],
        machinegunNoAmmo: 'assets/Gun/machinegun_noammo.png',
        machinegunBroken: 'assets/Gun/machinegun_broken.png',
        wallHoles: ['assets/wall_hole1.png', 'assets/wall_hole2.png', 'assets/wall_hole3.png', 'assets/wall_hole4.png'],
        machinegunHotFrames: ['assets/Gun/weapon_machinegun_F2_HOT.png', 'assets/Gun/weapon_machinegun_F3_HOT.png'],
        machinegunCooldown: 'assets/Gun/weapon_machinegun_F1_HOT.png',
        cannonFrames: [
            'assets/Gun/weapon_cannon_F1.png',
            'assets/Gun/weapon_cannon_F2.png',
            'assets/Gun/weapon_cannon_F3.png',
            'assets/Gun/weapon_cannon_F4.png'
        ],
        autoShotgunFrames: [
            'assets/Gun/weapon_autoShotgun_F1.png',
            'assets/Gun/weapon_autoShotgun_F2.png',
            'assets/Gun/weapon_autoShotgun_F3.png'
        ],
        autoShotgunHotFrames: [
            'assets/Gun/weapon_autoShotgun_F1_HOT.png',
            'assets/Gun/weapon_autoShotgun_F2_HOT.png',
            'assets/Gun/weapon_autoShotgun_F3_HOT.png'
        ],
        cannonNoAmmo: 'assets/Gun/cannon_noammo.png',
        laserFrames: [
            'assets/Gun/weapon_laser_F1.png',
            'assets/Gun/weapon_laser_F2.png',
            'assets/Gun/weapon_laser_F3_ON.png', // Firing frame
            'assets/Gun/weapon_laser_F4.png'      // Cooldown frame
        ],
        fireball: [
            'assets/Gun/cannon_fire_ball/cannon_fire_ball1.png',
            'assets/Gun/cannon_fire_ball/cannon_fire_ball2.png',
            'assets/Gun/cannon_fire_ball/cannon_fire_ball3.png',
            'assets/Gun/cannon_fire_ball/cannon_fire_ball4.png'
        ],
        heavymachinegun: 'assets/Gun/weapon_heavymachinegun_F1.png',
        heavymachinegunFrames: ['assets/Gun/weapon_heavymachinegun_F1.png', 'assets/Gun/weapon_heavymachinegun_F2.png', 'assets/Gun/weapon_heavymachinegun_F3.png', 'assets/Gun/weapon_heavymachinegun_F4.png'],
        heavymachinegunHotFrames: ['assets/Gun/weapon_heavymachinegun_F2_HOT.png', 'assets/Gun/weapon_heavymachinegun_F3_HOT.png'],
        heavymachinegunCooldown: 'assets/Gun/weapon_heavymachinegun_F1_HOT.png',
        heavymachinegunPickup: 'assets/Gun/weapon_heavymachinegun_ItemPickup.png',
        heavymachinegunNoAmmo: 'assets/Gun/weapon_heavymachinegun_noammo.png',
        autoShotgunNoAmmo: 'assets/Gun/autoShotgun_noammo.png',
        fireballExplosion: [
            'assets/Gun/cannon_fire_ball/cannon_ball_hit1.png',
            'assets/Gun/cannon_fire_ball/cannon_ball_hit2.png',
            'assets/Gun/cannon_fire_ball/cannon_ball_hit3.png'
        ],
        fireballDecal: 'assets/Gun/cannon_fire_ball/cannon_ball_hit4.png',
        soldier: ['assets/enemy/Soldier_1.png', 'assets/enemy/Soldier_2.png'],
        soldier0: 'assets/enemy/Soldier_0.png',
        soldierStand: 'assets/enemy/Soldier_Stand.png',
        soldierAttack: 'assets/enemy/Soldier_Attac.png',
        soldierB: ['assets/enemy/Soldier_1B.png', 'assets/enemy/Soldier_2B.png', 'assets/enemy/Soldier_3B.png'],
        soldierHit: 'assets/enemy/Soldier_Hit.png',
        soldierBHit: 'assets/enemy/Soldier_B_Hit.png',
        soldierHitFire: ['assets/enemy/Soldier_Hit_fire_ball1.png', 'assets/enemy/Soldier_Hit_fire_ball2.png', 'assets/enemy/Soldier_Hit_fire_ball3.png'],
        soldierBHitFire: ['assets/enemy/Soldier_B_Hit_fire_ball1.png', 'assets/enemy/Soldier_B_Hit_fire_ball2.png', 'assets/enemy/Soldier_B_Hit_fire_ball3.png'],
        soldierHitShotgun: 'assets/enemy/Soldier_hit_shotgun.png',
        soldierBHitShotgun: 'assets/enemy/Soldier_B_hit_shotgun.png',
        soldierDown: 'assets/enemy/Soldier_down.png',
        soldierBDown: 'assets/enemy/Soldier_B_down.png',
        soldierDownShotgun: 'assets/enemy/Soldier_down_shotgun.png',
        soldierBDownShotgun: 'assets/enemy/Soldier_B_down_shotgun.png',
        soldierFloor: 'assets/enemy/Soldier_floor.png',
        soldierBFloor: 'assets/enemy/Soldier_B_floor.png',
        soldierFloorShotgun: 'assets/enemy/Soldier_floor_shotgun.png',
        soldierBFloorShotgun: 'assets/enemy/Soldier_B_floor_shotgun.png',
        soldierFloorFire1: 'assets/enemy/Soldier_floor_fire_ball1.png',
        soldierBFloorFire1: 'assets/enemy/Soldier_B_floor_fire_ball1.png',
        soldierFloorFire2: 'assets/enemy/Soldier_floor_fire_ball2.png',
        soldierBFloorFire2: 'assets/enemy/Soldier_B_floor_fire_ball2.png',
        monster: ['assets/enemy/Monster_1.png', 'assets/enemy/Monster_2.png', 'assets/enemy/Monster_3.png'],
        monsterRun: ['assets/enemy/monster_1_run.png', 'assets/enemy/monster_2_run.png'],
        monsterB2: ['assets/enemy/Monster_1B.png', 'assets/enemy/Monster_2B.png', 'assets/enemy/Monster_3B.png'],
        monsterB2Run: ['assets/enemy/Monster_1B_run.png', 'assets/enemy/Monster_2B_run.png'],
        monsterHit: 'assets/enemy/Monster_Hit.png',
        monsterB2Hit: 'assets/enemy/Monster_2B_Hit.png',
        monsterHitFire: ['assets/enemy/Monster_Hit_fire_ball1.png', 'assets/enemy/Monster_Hit_fire_ball2.png', 'assets/enemy/Monster_Hit_fire_ball3.png'],
        monsterB2HitFire: ['assets/enemy/Monster_B2_Hit_fire_ball1.png', 'assets/enemy/Monster_B2_Hit_fire_ball2.png', 'assets/enemy/Monster_B2_Hit_fire_ball3.png'],
        monsterHitShotgun: 'assets/enemy/Monster_Hit_shotgun.png',
        monsterB2HitShotgun: 'assets/enemy/Monster_B2_Hit_shotgun.png',
        monsterDown: 'assets/enemy/Monster_down.png',
        monsterB2Down: 'assets/enemy/Monster_2B_down.png',
        monsterDownShotgun: 'assets/enemy/Monster_down_shotgun.png',
        monsterB2DownShotgun: 'assets/enemy/Monster_B2_down_shotgun.png',
        monsterFloor: 'assets/enemy/Monster_floor.png',
        monsterB2Floor: 'assets/enemy/Monster_2B_floor.png',
        monsterFloorShotgun: 'assets/enemy/Monster_floor_shotgun.png',
        monsterB2FloorShotgun: 'assets/enemy/Monster_B2_floor_shotgun.png',
        monsterFloorFire1: 'assets/enemy/Monster_floor_fire_ball1.png',
        monsterB2FloorFire1: 'assets/enemy/Monster_B2_floor_fire_ball1.png',
        monsterFloorFire2: 'assets/enemy/Monster_floor_fire_ball2.png',
        monsterB2FloorFire2: 'assets/enemy/Monster_B2_floor_fire_ball2.png',
        brain: ['assets/enemy/Brain_1.png', 'assets/enemy/Brain_2.png', 'assets/enemy/Brain_3.png'],
        brainAttack: ['assets/enemy/Brain_attac1.png', 'assets/enemy/Brain_attac2.png', 'assets/enemy/Brain_attac3.png'],
        brainHit: 'assets/enemy/Brain_hit.png',
        brainHitShotgun: 'assets/enemy/brain_Hit_shotgun.png',
        brainDown: 'assets/enemy/Brain_down.png',
        brainDownShotgun: 'assets/enemy/brain_down_shotgun.png',
        brainFloor: 'assets/enemy/Brain_floor2.png',
        brainFloorShotgun: 'assets/enemy/brain_floor_shotgun.png',
        brainHit2: 'assets/enemy/Brain_hit2.png',
        brainDown2: 'assets/enemy/Brain_down2.png',
        brainFloor3: 'assets/enemy/Brain_floor3.png',
        brainHitFire: ['assets/enemy/Brain_hit_fire_ball1.png', 'assets/enemy/Brain_hit_fire_ball2.png', 'assets/enemy/Brain_hit_fire_ball3.png'],
        brainFloorFire1: 'assets/enemy/Brain_floor_fire_ball1.png',
        brainFloorFire2: 'assets/enemy/Brain_floor_fire_ball2.png',
        brainTeleport: ['assets/enemy/Brain_teleport1.png', 'assets/enemy/Brain_teleport2.png', 'assets/enemy/Brain_teleport3.png', 'assets/enemy/Brain_teleport4.png'],
        geco: ['assets/enemy/Geco_1.png', 'assets/enemy/Geco_2.png', 'assets/enemy/Geco_3.png'],
        gecoAttack: ['assets/enemy/geco_attac1.png', 'assets/enemy/geco_attac2.png', 'assets/enemy/geco_attac3.png'],
        gecoHit: 'assets/enemy/geco_hit.png',
        gecoHitShotgun: 'assets/enemy/geco_Hit_shotgun.png',
        gecoDown: 'assets/enemy/geco_down.png',
        gecoDownShotgun: 'assets/enemy/geco_down_shotgun.png',
        gecoFloor: 'assets/enemy/geco_floor.png',
        gecoFloorShotgun: 'assets/enemy/geco_floor_shotgun.png',
        gecoHitFire: ['assets/enemy/geco_hit_fire_ball1.png', 'assets/enemy/geco_hit_fire_ball2.png', 'assets/enemy/geco_hit_fire_ball3.png'],
        gecoFloorFire1: 'assets/enemy/geco_floor_fire_ball1.png',
        gecoFloorFire2: 'assets/enemy/geco_floor_fire_ball2.png',
        gecoInkBall: 'assets/geco_ink_ball.png',
        gecoInkScreen: 'assets/black_screen_geco_ink.png',

        // Laser Hit Sprites
        monsterHitLaser: 'assets/enemy/monster_hit_laser.png',
        monsterB2HitLaser: 'assets/enemy/Monster_B2_Hit_laser.png',
        brainHitLaser: 'assets/enemy/brain_hit_laser.png',
        gecoHitLaser: 'assets/enemy/geco_hit_laser.png',
        soldierHitLaser: 'assets/enemy/zombie_hit_laser.png',
        soldierBHitLaser: 'assets/enemy/zombie_B_hit_laser.png',
        gunMan: ['assets/gun_man/gun_man_f1.png', 'assets/gun_man/gun_man_f2.png', 'assets/gun_man/gun_man_f3.png', 'assets/gun_man/gun_man_f4.png'],
        coin: 'assets/gun_man/coin.png',
        coin_big_pile: 'assets/coin_big_pile.png',
        coin_small_pile: 'assets/coin_small_pile.png',
        shopShotgun: 'assets/gun_man/shotgun_item.png',
        shopMachinegun: 'assets/gun_man/machinegun_item.png',
        shopCannon: 'assets/gun_man/cannon_item.png',
        shopAutoShotgun: 'assets/gun_man/AutoShotgun_Item_side_view.png',
        energyBall: 'assets/energy_ball.png',
        ammoShotgun: 'assets/shotgun_shell.png',
        ammoMachinegun: 'assets/machinegun_shell.png',
        ammoCannon: 'assets/cannon_shell.png',
        addLife: 'assets/Add_life.png',
        totemRed: 'assets/Totem/Red_Totem.png',
        totemGreen: 'assets/Totem/Green_Totem.png',
        totemBlue: 'assets/Totem/Blue_Totem.png',
        totemEmpty: 'assets/Totem/Totem_Empty.png',
        totemFull: 'assets/Totem/Totem_Full_Win.png',
        arenaTriggerOff: 'assets/Totem/Arena_trigger_off.png',
        arenaTriggerOn: 'assets/Totem/Arena_trigger_on.png',
        kiligRoomActive: 'assets/Totem/kilig_room_ative.png',
        kiligRoomDone: 'assets/Totem/kilig_room_done.png',
        sonarRed: ['assets/Sonar/Sonar_red_Left.png', 'assets/Sonar/Sonar_red_Center.png', 'assets/Sonar/Sonar_red_Rigth.png'],
        sonarGreen: ['assets/Sonar/Sonar_green_Left.png', 'assets/Sonar/Sonar_green_Center.png', 'assets/Sonar/Sonar_green_Rigth.png'],
        sonarBlue: ['assets/Sonar/Sonar_blue_Left.png', 'assets/Sonar/Sonar_blue_Center.png', 'assets/Sonar/Sonar_blue_Rigth.png'],
        sonarTotem: ['assets/Sonar/Sonar_totem_Left.png', 'assets/Sonar/Sonar_totem_Center.png', 'assets/Sonar/Sonar_totem_Rigth.png'],
        barrel: 'assets/enviroment/envirom_barrel_texture.png',
        lamp: 'assets/enviroment/envirom_lamp.png',
        lamp2: 'assets/enviroment/envirom_lamp2.png',
        lamp3: 'assets/enviroment/envirom_lamp3.png',
        chair: 'assets/enviroment/envirom_chair.png',
        chair2: 'assets/enviroment/envirom_chair2.png',
        hanger: 'assets/enviroment/envirom_hanger.png'
    },
    audio: {
        monster: {
            sb: ['assets/Sounds/Moustro1/Moustro_SB1.wav', 'assets/Sounds/Moustro1/Moustro_SB2.wav', 'assets/Sounds/Moustro1/Moustro_SB3.wav', 'assets/Sounds/Moustro1/Moustro_SB4.wav'],
            hit: ['assets/Sounds/Moustro1/Moustro_hit1.wav', 'assets/Sounds/Moustro1/Moustro_hit2.wav', 'assets/Sounds/Moustro1/Moustro_hit3.wav', 'assets/Sounds/Moustro1/Moustro_hit4.wav', 'assets/Sounds/Moustro1/Moustro_hit5.wav'],
            death: ['assets/Sounds/Moustro1/Moustro_muerte1.wav', 'assets/Sounds/Moustro1/Moustro_muerte2.wav', 'assets/Sounds/Moustro1/Moustro_muerte3.wav'],
            attack: ['assets/Sounds/Moustro1/moustro_attac1.wav', 'assets/Sounds/Moustro1/moustro_attac2.wav', 'assets/Sounds/Moustro1/moustro_attac3.wav', 'assets/Sounds/Moustro1/moustro_attac4.wav', 'assets/Sounds/Moustro1/moustro_attac5.wav']
        },
        zombie: {
            dtc: ['assets/Sounds/Zombie/Zombie_DTC1.wav', 'assets/Sounds/Zombie/Zombie_DTC2.wav', 'assets/Sounds/Zombie/Zombie_DTC3.wav', 'assets/Sounds/Zombie/Zombie_DTC4.wav', 'assets/Sounds/Zombie/Zombie_DTC5.wav', 'assets/Sounds/Zombie/Zombie_DTC6.wav', 'assets/Sounds/Zombie/Zombie_DTC7.wav'],
            hit: ['assets/Sounds/Zombie/Zombie_hit1.wav', 'assets/Sounds/Zombie/Zombie_hit2.wav', 'assets/Sounds/Zombie/Zombie_hit3.wav', 'assets/Sounds/Zombie/Zombie_hit4.wav', 'assets/Sounds/Zombie/Zombie_hit5.wav', 'assets/Sounds/Zombie/Zombie_hit6.wav'],
            death: ['assets/Sounds/Zombie/Zombie_muerte1.wav', 'assets/Sounds/Zombie/Zombie_muerte2.wav'],
            attack: ['assets/Sounds/Zombie/Zombie_attac1.wav', 'assets/Sounds/Zombie/Zombie_attac2.wav', 'assets/Sounds/Zombie/Zombie_attac3.wav', 'assets/Sounds/Zombie/Zombie_attac4.wav', 'assets/Sounds/Zombie/Zombie_attac5.wav']
        },
        brain: {
            sb: ['assets/Sounds/brain/brain_sound1.wav', 'assets/Sounds/brain/brain_sound2.wav', 'assets/Sounds/brain/brain_sound3.wav'],
            attack: ['assets/Sounds/brain/brain_attac1.wav', 'assets/Sounds/brain/brain_attac2.wav'],
            death: ['assets/Sounds/brain/brain_muerte1.wav', 'assets/Sounds/brain/brain_muerte2.wav'],
            hit: ['assets/Sounds/brain/brain_hit1.wav', 'assets/Sounds/brain/brain_hit2.wav', 'assets/Sounds/brain/brain_hit3.wav', 'assets/Sounds/brain/brain_hit4.wav'],
            hitFire: ['assets/Sounds/brain/brain_muerte_hit_fire1.wav', 'assets/Sounds/brain/brain_muerte_hit_fire2.wav']
        },
        geco: {
            sb: ['assets/Sounds/geco/geco_sound1.wav', 'assets/Sounds/geco/geco_sound2.wav', 'assets/Sounds/geco/geco_sound3.wav'],
            attack: ['assets/Sounds/geco/geco_attac1.wav', 'assets/Sounds/geco/geco_attac2.wav'],
            death: ['assets/Sounds/geco/geco_muerte1.wav', 'assets/Sounds/geco/geco_muerte2.wav', 'assets/Sounds/geco/geco_muerte3.wav'],
            hit: ['assets/Sounds/geco/geco_hit1.wav', 'assets/Sounds/geco/geco_hit2.wav', 'assets/Sounds/geco/geco_hit3.wav', 'assets/Sounds/geco/geco_hit4.wav']
        },
        weapons: {
            pistol: ['assets/Sounds/gun/Pistol1.wav', 'assets/Sounds/gun/Pistol2.wav', 'assets/Sounds/gun/Pistol3.wav'],
            shotgun: ['assets/Sounds/gun/Shotgun1.wav', 'assets/Sounds/gun/Shotgun2.wav', 'assets/Sounds/gun/Shotgun3.wav'],
            machinegun: ['assets/Sounds/gun/Machinegun1.wav', 'assets/Sounds/gun/Machinegun2.wav', 'assets/Sounds/gun/Machine_gun3.wav'],
            sonar: {
                center: 'assets/Sounds/gun/Sonar_Center.wav',
                side: 'assets/Sounds/gun/Sonar_R_L.wav'
            },
            cannon: ['assets/Sounds/gun/cannon1.wav', 'assets/Sounds/gun/cannon2.wav', 'assets/Sounds/gun/cannon3.wav'],
            autoshotgun: ['assets/Sounds/gun/AutoShogun1.wav', 'assets/Sounds/gun/AutoShogun2.wav', 'assets/Sounds/gun/AutoShogun3.wav', 'assets/Sounds/gun/AutoShogun4.wav'],
            heavymachinegun: ['assets/Sounds/gun/HeavyMachine_gun1.wav', 'assets/Sounds/gun/HeavyMachine_gun2.wav', 'assets/Sounds/gun/HeavyMachine_gun3.wav'],
            heavymachinegunPickup: 'assets/Sounds/gun/HeavyMachine_pickup.wav',
            laser: 'assets/Sounds/gun/Laser_Sound.wav',
            noAmmo: 'assets/Sounds/gun/no_ammo.wav'
        },
        music: [
            'assets/Sounds/Music/RayCasting_BG1.mp3',
            'assets/Sounds/Music/RayCasting_BG2.mp3',
            'assets/Sounds/Music/RayCasting_BG3.mp3',
            'assets/Sounds/Music/RayCasting_BG4.mp3',
            'assets/Sounds/Music/RayCasting_BG5.mp3',
            'assets/Sounds/Music/RayCasting_BG6.mp3',
            'assets/Sounds/Music/RayCasting_BG7.mp3',
            'assets/Sounds/Music/RayCasting_BG8.mp3'
        ],
        fx: {
            ammoShotgun: 'assets/Sounds/pick_up_ammo_shotgun.wav',
            ammoMachinegun: 'assets/Sounds/pick_up_ammo_machinegun.wav',
            ammoCannon: 'assets/Sounds/pick_up_ammo_cannon.wav',
            crystal: 'assets/Sounds/pick_up_cristal.wav',
            totemEnd: 'assets/Sounds/tottem_end.wav',
            inkWipe: 'assets/Sounds/geco_ink_wipe.wav'
        }
    }
};

export const CONFIG = {
    fov: Math.PI / 2.5,
    resolution: 0.5,
    moveSpeed: 3.0,
    rotSpeed: 2.0,
    wallHeight: 1.5,
    // Physics / Momentum
    playerAccel: 170.0,
    playerStrafeAccel: 25.0, // Low accel for walking strafe
    playerRunStrafeAccel: 80.0, // Higher accel for running strafe to overcome friction
    playerFriction: 6.0,
    playerMaxSpeed: 6.0,
    playerRunMultiplier: 2.0,
    enemyKnockbackFriction: 4.0,

    // --- NEW: Combo System ---
    comboDecayTime: 3.0, // Seconds before combo resets
    comboMaxMultiplier: 5,

    // --- NEW: Dash/Dodge ---
    dashSpeed: 25.0,
    dashDuration: 0.15, // Seconds
    dashCooldown: 3.0, // Seconds
    dashInvulnDuration: 0.2, // Seconds of i-frames
    doubleTapWindow: 300, // Milliseconds to detect double-tap

    // --- NEW: Screen Shake ---
    screenShakeDecay: 8.0, // How fast shake fades

    // --- NEW: Distance Fog ---
    fogStart: 4.0, // Distance where fog starts
    fogEnd: 14.0, // Distance where fog is maximum
    fogColor: { r: 10, g: 8, b: 15 }, // Dark purple-black

    // --- NEW: Enemy Drop Chances (0-1) ---
    dropChances: {
        soldier: { type: 'ammoShotgun', chance: 0.30 },
        soldierB: { type: 'ammoShotgun', chance: 0.30 },
        monster: { type: 'ammoMachinegun', chance: 0.25 },
        monsterB2: { type: 'ammoMachinegun', chance: 0.25 },
        brain: { type: 'ammoCannon', chance: 0.20 },
        geco: { type: 'addLife', chance: 0.15 }
    },

    // --- NEW: Difficulty Scaling ---
    enemySpeedScalePerLevel: 0.05, // +5% per level
    enemySpeedScaleCap: 0.50, // Max +50%
    enemyAttackCooldownReduction: 0.03, // -3% per level
    chainAggroRadius: 10, // Tiles radius for chain aggro

    // --- NEW: Kill Room ---
    killRoomChance: 0.3, // 30% of eligible rooms become kill rooms
    killRoomMinSize: 7, // Minimum room dimension for kill room
    killRoomWavesBase: 2, // Base number of waves
    killRoomWavesPerLevel: 1, // Additional waves per 3 levels

    // --- NEW: Secret Walls ---
    secretWallsPerLevel: 2,

    // --- NEW: Level Complete Bonus ---
    levelCompleteCoinBonus: 50,
    levelCompleteHealthBonus: 25,

    // --- STAMINA SYSTEM ---
    playerStamina: 100,
    playerStaminaDrain: 28,       // Units per second while sprinting
    playerStaminaRegen: 18,       // Units per second while not sprinting
    playerStaminaCooldown: 2.0,   // Seconds before regen starts after depletion

    // --- BLOOD PARTICLES ---
    bloodParticleCount: 5,
    bloodParticleSpeed: 4.0,
    bloodParticleLife: 0.35,

    // --- CORRIDOR LAMPS ---
    corridorLampChance: 0.22,     // Probability per lamp check segment
    corridorLampSpacing: 6,       // Tiles between checks

    // --- BOSS TOTEM WAVES (from level 2) ---
    bossWaveCount: 3,             // Number of enemy waves when Totem is completed
    bossWaveBaseSize: 4,          // Base enemies per wave
    bossWaveLevelScale: 2,        // Extra enemies per level

    // --- GRAPHICS ENGINE V2 & MAP IMPROVEMENTS ---
    destructibleWallTexIndex: 16,    // Texture index (value in map.data) representing cracked wall
    drawSpriteShadows: true,         // Toggle for contact shadows under sprites
    drawCornerCreviceShadows: true,  // Toggle for corner crevice ambient occlusion
    spriteFogFading: true,           // Toggle for sprite fog alpha fade-in
    staticPropLighting: true,        // Enable static props casting light glows on walls
};
