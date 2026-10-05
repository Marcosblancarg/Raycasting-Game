import { state } from './state.js';
import { CONFIG } from './config.js';

// Rendering Optimization Caches
let cachedImageData = null;
let cachedWidth = 0;
let cachedHeight = 0;
let zBuffer = null;
const spriteList = [];
const rayResults = [];

// Helper function to draw sprite stripes in batch
function drawSpriteBatch(ctx, img, stripeStart, stripeEnd, spriteWidth, spriteScreenX, spriteTop, spriteHeight, isClimbing, alpha) {
    const srcX = stripeStart * img.naturalWidth / spriteWidth;
    const srcW = (stripeEnd - stripeStart + 1) * img.naturalWidth / spriteWidth;
    const destX = Math.floor(spriteScreenX - spriteWidth / 2 + stripeStart);
    const destW = stripeEnd - stripeStart + 1;

    ctx.save();
    ctx.globalAlpha = alpha * (isClimbing ? 0.4 : 1.0);
    ctx.drawImage(img, srcX, 0, srcW, img.naturalHeight, destX, spriteTop, destW, spriteHeight);
    ctx.restore();
}

export function castRay(rayDirX, rayDirY, outObj) {
    let mapX = Math.floor(state.player.x);
    let mapY = Math.floor(state.player.y);

    // Delta distance calculation
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    let stepX, stepY, sideDistX, sideDistY, side;

    if (rayDirX < 0) { stepX = -1; sideDistX = (state.player.x - mapX) * deltaDistX; }
    else { stepX = 1; sideDistX = (mapX + 1.0 - state.player.x) * deltaDistX; }

    if (rayDirY < 0) { stepY = -1; sideDistY = (state.player.y - mapY) * deltaDistY; }
    else { stepY = 1; sideDistY = (mapY + 1.0 - state.player.y) * deltaDistY; }

    let hit = 0;
    let steps = 0;
    const maxSteps = 100; // Safety break

    while (hit === 0 && steps < maxSteps) {
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }

        // Bounds Check
        if (mapX < 0 || mapX >= state.map.width || mapY < 0 || mapY >= state.map.height) {
            hit = 1; // Treat out of bounds as wall
        } else if (state.map.data[mapY * state.map.width + mapX] !== 0) {
            hit = 1;
        }
        steps++;
    }

    let perpWallDist;
    if (side === 0) perpWallDist = (mapX - state.player.x + (1 - stepX) / 2) / rayDirX;
    else perpWallDist = (mapY - state.player.y + (1 - stepY) / 2) / rayDirY;

    // Texture calculation
    let wallX;
    if (side === 0) wallX = state.player.y + perpWallDist * rayDirY;
    else wallX = state.player.x + perpWallDist * rayDirX;
    wallX -= Math.floor(wallX);

    if (!outObj) outObj = {};
    outObj.dist = perpWallDist;
    outObj.side = side;
    outObj.wallX = wallX;
    outObj.mapX = mapX;
    outObj.mapY = mapY;
    return outObj;
}

export function render(canvas, ctx) {
    // 1. Floor & Ceiling (Scanline)
    const w = canvas.width;
    const h = canvas.height;

    if (!cachedImageData || cachedWidth !== w || cachedHeight !== h) {
        cachedImageData = ctx.createImageData(w, h);
        cachedWidth = w;
        cachedHeight = h;
    }
    const imgData = cachedImageData;
    const buffer = imgData.data;
    const buf32 = new Uint32Array(buffer.buffer);

    // Camera plane vectors (Vector-based raycasting)
    const dirX = Math.cos(state.player.dir);
    const dirY = Math.sin(state.player.dir);
    const planeX = -dirY * Math.tan(CONFIG.fov / 2);
    const planeY = dirX * Math.tan(CONFIG.fov / 2);

    const fogColor = CONFIG.fogColor;
    const fogColorUint32 = (255 << 24) | (fogColor.b << 16) | (fogColor.g << 8) | fogColor.r;

    // Pre-compute dynamic lights close to player
    const playerX = state.player.x;
    const playerY = state.player.y;
    const activeLights = [];
    state.projectiles.forEach(p => {
        if (p.type === 'fireball' || p.type === 'energyBall') {
            const dx = p.x - playerX;
            const dy = p.y - playerY;
            if (dx * dx + dy * dy < 225) { // 15 tiles
                activeLights.push({ x: p.x, y: p.y, type: 'projectile' });
            }
        }
    });
    state.explosions.forEach(ex => {
        const dx = ex.x - playerX;
        const dy = ex.y - playerY;
        if (dx * dx + dy * dy < 225) {
            activeLights.push({ x: ex.x, y: ex.y, type: 'explosion' });
        }
    });

    if (CONFIG.staticPropLighting) {
        state.items.forEach(item => {
            if (item.type === 'lamp' || item.type === 'lamp2' || item.type === 'lamp3' || item.type === 'altar') {
                const dx = item.x - playerX;
                const dy = item.y - playerY;
                if (dx * dx + dy * dy < 225) { // 15 tiles
                    activeLights.push({ x: item.x, y: item.y, type: 'static_lamp' });
                }
            }
        });
    }

    // Floor Casting
    const halfH = Math.floor(h / 2);
    for (let y = halfH; y < h; y++) {
        // RayDir for leftmost ray (x = 0) and rightmost ray (x = w)
        const rayDirX0 = dirX - planeX;
        const rayDirY0 = dirY - planeY;
        const rayDirX1 = dirX + planeX;
        const rayDirY1 = dirY + planeY;

        // Current y position relative to the center of the screen (the horizon)
        const p = y - halfH;
        const posZ = 0.5 * h * CONFIG.wallHeight;

        // Horizontal distance from the camera to the floor for the current row
        const rowDistance = posZ / (p === 0 ? 1 : p);

        // Calculate fog factor for this row once
        let fogFactor = 0;
        if (rowDistance > state.fogStart) {
            fogFactor = (rowDistance - state.fogStart) / (state.fogEnd - state.fogStart);
            if (fogFactor > 1) fogFactor = 1;
        }

        // Row fog end culling: if fully fogged, fill row instantly
        if (fogFactor >= 1) {
            const floorRowStart = y * w;
            const ceilRowStart = (h - y - 1) * w;
            buf32.fill(fogColorUint32, floorRowStart, floorRowStart + w);
            buf32.fill(fogColorUint32, ceilRowStart, ceilRowStart + w);
            continue;
        }

        // Calculate the real world step vector we have to add for each x
        const floorStepX = rowDistance * (rayDirX1 - rayDirX0) / w;
        const floorStepY = rowDistance * (rayDirY1 - rayDirY0) / w;

        // Real world coordinates of the leftmost column
        let floorX = state.player.x + rowDistance * rayDirX0;
        let floorY = state.player.y + rowDistance * rayDirY0;

        const floorRowStart = y * w;
        const ceilRowStart = (h - y - 1) * w;

        const oneMinusFog = 1 - fogFactor;
        const fogR = fogColor.r * fogFactor;
        const fogG = fogColor.g * fogFactor;
        const fogB = fogColor.b * fogFactor;

        for (let x = 0; x < w; x++) {
            const mapX = Math.floor(floorX);
            const mapY = Math.floor(floorY);
            const mapIdx = (mapY * state.map.width + mapX);

            // Default to 0 if out of bounds or undefined
            const fIdx = (state.map.floorData && state.map.floorData[mapIdx]) || 0;
            const cIdx = (state.map.ceilData && state.map.ceilData[mapIdx]) || 0;

            const floorTex = state.textureData[`floor_${fIdx}`] || state.textureData['floor'];
            const ceilTex = state.textureData[`ceil_${cIdx}`] || state.textureData['ceil'];

            const texX = Math.floor((floorX - mapX) * 256) & 255;
            const texY = Math.floor((floorY - mapY) * 256) & 255;
            const texIdx = (texY * 256 + texX) * 4;

            // Floor Pixel
            let rf = 50, gf = 50, bf = 50;
            if (floorTex) {
                rf = floorTex[texIdx];
                gf = floorTex[texIdx + 1];
                bf = floorTex[texIdx + 2];
            }
            const rFloor = Math.floor(rf * oneMinusFog + fogR);
            const gFloor = Math.floor(gf * oneMinusFog + fogG);
            const bFloor = Math.floor(bf * oneMinusFog + fogB);
            buf32[floorRowStart + x] = (255 << 24) | (bFloor << 16) | (gFloor << 8) | rFloor;

            // Ceiling Pixel
            let rc = 20, gc = 20, bc = 20;
            if (ceilTex) {
                rc = ceilTex[texIdx];
                gc = ceilTex[texIdx + 1];
                bc = ceilTex[texIdx + 2];
            }
            const rCeil = Math.floor(rc * oneMinusFog + fogR);
            const gCeil = Math.floor(gc * oneMinusFog + fogG);
            const bCeil = Math.floor(bc * oneMinusFog + fogB);
            buf32[ceilRowStart + x] = (255 << 24) | (bCeil << 16) | (gCeil << 8) | rCeil;

            floorX += floorStepX;
            floorY += floorStepY;
        }
    }

    ctx.putImageData(imgData, 0, 0);

    // ZBuffer for sprites
    if (!zBuffer || zBuffer.length !== canvas.width) {
        zBuffer = new Float64Array(canvas.width);
    }

    // Spatial hash for decals
    const decalMap = new Map();
    state.decals.forEach(d => {
        const key = `${d.mapX},${d.mapY},${d.side}`;
        if (!decalMap.has(key)) decalMap.set(key, []);
        decalMap.get(key).push(d);
    });

    // Pre-allocate rayResults if needed
    if (rayResults.length < canvas.width) {
        while (rayResults.length < canvas.width) {
            rayResults.push({ dist: 0, side: 0, wallX: 0, mapX: 0, mapY: 0 });
        }
    }

    // Walls
    const numRays = canvas.width;
    for (let x = 0; x < numRays; x++) {
        const cameraX = 2 * x / numRays - 1;
        const rayDirX = dirX + planeX * cameraX;
        const rayDirY = dirY + planeY * cameraX;

        const rayResult = rayResults[x];
        castRay(rayDirX, rayDirY, rayResult);
        const correctedDist = rayResult.dist;

        const lineHeight = Math.floor(canvas.height / correctedDist * CONFIG.wallHeight);
        const drawStart = -lineHeight / 2 + canvas.height / 2;

        // Texture
        const cellVal = state.map.data[rayResult.mapY * state.map.width + rayResult.mapX];
        let texIdx;
        if (cellVal === CONFIG.destructibleWallTexIndex) {
            texIdx = state.currentDestructibleWallTexIdx !== undefined ? state.currentDestructibleWallTexIdx : 15;
        } else {
            texIdx = Math.max(0, (cellVal || 1) - 1);
        }
        const tex = state.textures.walls ? state.textures.walls[texIdx % state.textures.walls.length] : null;
        const texX = Math.floor(rayResult.wallX * 256);

        if (tex && tex.complete) {
            ctx.drawImage(tex, texX, 0, 1, 256, x, drawStart, 1, lineHeight);
            if (rayResult.side === 1) {
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.fillRect(x, drawStart, 1, lineHeight);
            }
        } else {
            ctx.fillStyle = rayResult.side === 1 ? '#888' : '#aaa';
            ctx.fillRect(x, drawStart, 1, lineHeight);
        }

        if (CONFIG.drawCornerCreviceShadows) {
            let creviceShadow = 0.0;
            const wallX = rayResult.wallX;
            const edgeDist = 0.08;
            if (wallX < edgeDist) {
                creviceShadow = (1.0 - (wallX / edgeDist)) * 0.45;
            } else if (wallX > 1.0 - edgeDist) {
                creviceShadow = ((wallX - (1.0 - edgeDist)) / edgeDist) * 0.45;
            }
            if (creviceShadow > 0) {
                ctx.fillStyle = `rgba(0,0,0,${creviceShadow})`;
                ctx.fillRect(x, drawStart, 1, lineHeight);
            }
        }

        // Distance Fog & Dynamic Lighting
        let fogFactor = 0;
        if (correctedDist > state.fogStart) {
            fogFactor = (correctedDist - state.fogStart) / (state.fogEnd - state.fogStart);
            if (fogFactor > 1) fogFactor = 1;
        }

        let lightBoost = 0;
        const timeSinceLastShot = performance.now() - state.player.lastShot;
        if (timeSinceLastShot < 100) {
            lightBoost += (1.0 - timeSinceLastShot / 100) * Math.max(0, 1.0 - correctedDist / 5.0) * 0.6;
        }

        // Dynamic lighting calculations
        activeLights.forEach(light => {
            const pdx = rayResult.mapX + 0.5 - light.x;
            const pdy = rayResult.mapY + 0.5 - light.y;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
            if (light.type === 'projectile') {
                if (pdist < 3.0) {
                    lightBoost += (1.0 - pdist / 3.0) * 0.5;
                }
            } else if (light.type === 'explosion') {
                if (pdist < 4.0) {
                    lightBoost += (1.0 - pdist / 4.0) * 0.7;
                }
            } else if (light.type === 'static_lamp') {
                if (pdist < 3.5) {
                    const flicker = Math.sin(performance.now() * 0.008 + light.x * 10) * 0.03;
                    lightBoost += (1.0 - pdist / 3.5) * (0.4 + flicker);
                }
            }
        });

        fogFactor = Math.max(0, fogFactor - lightBoost);

        if (fogFactor > 0) {
            const fogColor = CONFIG.fogColor;
            ctx.fillStyle = `rgba(${fogColor.r}, ${fogColor.g}, ${fogColor.b}, ${fogFactor})`;
            ctx.fillRect(x, drawStart, 1, lineHeight);
        }

        const totalLight = Math.min(1.0, lightBoost);
        if (totalLight > 0) {
            ctx.fillStyle = `rgba(255, 230, 180, ${totalLight * 0.35})`;
            ctx.fillRect(x, drawStart, 1, lineHeight);
        }

        // Decals lookup in spatial hash
        const key = `${rayResult.mapX},${rayResult.mapY},${rayResult.side}`;
        const cellDecals = decalMap.get(key);
        if (cellDecals) {
            cellDecals.forEach(d => {
                const decalWidth = 0.3;
                if (Math.abs(rayResult.wallX - d.wallX) < decalWidth / 2) {
                    let decalTex;
                    if (d.isFireball) {
                        decalTex = state.sprites.fireballDecal;
                    } else {
                        decalTex = state.sprites.wallHoles ? state.sprites.wallHoles[d.texIndex || 0] : null;
                    }

                    if (decalTex && decalTex.complete) {
                        const normX = (rayResult.wallX - (d.wallX - decalWidth / 2)) / decalWidth;
                        const texX = Math.floor(normX * decalTex.width);
                        if (texX >= 0 && texX < decalTex.width) {
                            const zOff = d.zOffset || 0;
                            ctx.drawImage(decalTex, texX, 0, 1, decalTex.height, x, drawStart + lineHeight / 2 - lineHeight * 0.1 + (zOff * lineHeight), 1, lineHeight * 0.2);
                        }
                    }
                }
            });
        }

        zBuffer[x] = correctedDist;
    }

    // Sprites - Reusable spriteList sorting (Avoiding allocations)
    spriteList.length = 0;
    const playerXState = state.player.x;
    const playerYState = state.player.y;

    const addSprites = (arr) => {
        for (let i = 0; i < arr.length; i++) {
            const e = arr[i];
            const dx = e.x - playerXState;
            const dy = e.y - playerYState;
            e.distSq = dx * dx + dy * dy;
            
            // Early Frustum Culling
            if (e.distSq > 0.5) {
                const angleToSprite = Math.atan2(dy, dx);
                let diffAngle = angleToSprite - state.player.dir;
                while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
                while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
                if (Math.abs(diffAngle) > CONFIG.fov / 2 + 0.5) {
                    continue;
                }
            }
            
            spriteList.push(e);
        }
    };

    addSprites(state.enemies);
    addSprites(state.npcs);
    addSprites(state.items);
    addSprites(state.projectiles);
    addSprites(state.explosions);

    // Sort in-place by squared distance (farthest first)
    spriteList.sort((a, b) => b.distSq - a.distSq);

    const fogEndSq = state.fogEnd * state.fogEnd;

    for (let i = 0; i < spriteList.length; i++) {
        const sprite = spriteList[i];
        if (sprite.distSq > fogEndSq) continue; // Distance culling (farthest in fog ignored)

        let alpha = 1.0;
        if (CONFIG.spriteFogFading) {
            const spriteDist = Math.sqrt(sprite.distSq);
            if (spriteDist > state.fogStart) {
                const fogFactor = (spriteDist - state.fogStart) / (state.fogEnd - state.fogStart);
                alpha = Math.max(0.0, 1.0 - fogFactor);
            }
        }
        if (alpha <= 0.02) continue;

        const dx = sprite.x - playerXState;
        const dy = sprite.y - playerYState;

        const spriteX = dx * Math.cos(-state.player.dir) - dy * Math.sin(-state.player.dir);
        const spriteY = dx * Math.sin(-state.player.dir) + dy * Math.cos(-state.player.dir);

        if (spriteX > 0) {
            const transformY = spriteX;
            const transformX = spriteY;

            const spriteScreenX = Math.floor((canvas.width / 2) * (1 + transformX / transformY));
            
            // Select correct frame or image
            let img;
            if (sprite.type === 'soldier') {
                if (sprite.state === 'HIT') {
                    img = state.sprites.soldierHit;
                } else if (sprite.state === 'HIT_DEATH_V2') {
                    img = state.sprites.soldierHit2 || state.sprites.soldierHit;
                } else if (sprite.state === 'DOWN') {
                    img = state.sprites.soldierDown;
                } else if (sprite.state === 'FLOOR') {
                    img = state.sprites.soldierFloor;
                } else if (sprite.state === 'HIT_FIRE') {
                    img = state.sprites.soldierHitFire;
                    if (Array.isArray(img)) img = img[sprite.frame || 0];
                } else if (sprite.state === 'HIT_LASER') {
                    img = state.sprites.soldierHitLaser;
                } else if (sprite.state === 'FLOOR_FIRE_1') {
                    img = state.sprites.soldierFloorFire1;
                } else if (sprite.state === 'FLOOR_FIRE_2') {
                    img = state.sprites.soldierFloorFire2;
                } else if (sprite.state === 'HIT_SHOTGUN') {
                    img = state.sprites.soldierHitShotgun;
                } else if (sprite.state === 'DOWN_SHOTGUN') {
                    img = state.sprites.soldierDownShotgun;
                } else if (sprite.state === 'FLOOR_SHOTGUN') {
                    img = state.sprites.soldierFloorShotgun;
                } else if (sprite.state === 'ATTACK') {
                    img = state.sprites.soldierAttack;
                } else if (sprite.state === 'STAND_BY') {
                    if (sprite.hasDetectedPlayer) {
                        img = state.sprites.soldierStand;
                    } else {
                        img = state.sprites.soldier0;
                    }
                } else {
                    // Walk/Move animation: intercalate between Soldier_1, Soldier_Stand, Soldier_2, Soldier_Stand
                    const walkFrames = [
                        state.sprites.soldier[0],      // Soldier_1
                        state.sprites.soldierStand,     // Soldier_Stand
                        state.sprites.soldier[1],      // Soldier_2
                        state.sprites.soldierStand      // Soldier_Stand
                    ];
                    img = walkFrames[sprite.frame % 4 || 0];
                }
            } else if (sprite.state === 'ATTACK') {
                img = state.sprites[sprite.type + 'Attack'];
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            } else if (sprite.state === 'CHARGE') {
                img = state.sprites[sprite.type + 'Run'] || state.sprites[sprite.type];
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            } else if (sprite.state === 'STAND_BY') {
                if (sprite.type === 'soldier') img = state.sprites.soldier0;
            } else if (sprite.state === 'HIT') {
                img = state.sprites[sprite.type + 'Hit'];
            } else if (sprite.state === 'HIT_DEATH_V2') {
                img = state.sprites[sprite.type + 'Hit2'] || state.sprites[sprite.type + 'Hit'];
            } else if (sprite.state === 'DOWN') {
                img = state.sprites[sprite.type + 'Down'];
            } else if (sprite.state === 'DOWN_V2') {
                img = state.sprites[sprite.type + 'Down2'] || state.sprites[sprite.type + 'Down'];
            } else if (sprite.state === 'FLOOR') {
                img = state.sprites[sprite.type + 'Floor'];
            } else if (sprite.state === 'FLOOR_V2') {
                img = state.sprites[sprite.type + 'Floor3'] || state.sprites[sprite.type + 'Floor'];
            } else if (sprite.state === 'HIT_FIRE') {
                img = state.sprites[sprite.type + 'HitFire'];
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            } else if (sprite.state === 'HIT_LASER') {
                img = state.sprites[sprite.type + 'HitLaser'];
            } else if (sprite.state === 'FLOOR_FIRE_1') {
                img = state.sprites[sprite.type + 'FloorFire1'];
            } else if (sprite.state === 'FLOOR_FIRE_2') {
                img = state.sprites[sprite.type + 'FloorFire2'];
            } else if (sprite.state === 'HIT_SHOTGUN') {
                img = state.sprites[sprite.type + 'HitShotgun'];
            } else if (sprite.state === 'DOWN_SHOTGUN') {
                img = state.sprites[sprite.type + 'DownShotgun'];
            } else if (sprite.state === 'FLOOR_SHOTGUN') {
                img = state.sprites[sprite.type + 'FloorShotgun'];
            } else if (sprite.state === 'TELEPORT_OUT' || sprite.state === 'TELEPORT_IN') {
                img = state.sprites.brainTeleport;
                if (Array.isArray(img)) img = img[Math.min(sprite.frame || 0, img.length - 1)];
            } else if (sprite.speed !== undefined) {
                if (sprite.type === 'energyBall') {
                    img = state.sprites.energyBall;
                } else if (sprite.type === 'gecoInkBall') {
                    img = state.sprites.gecoInkBall;
                } else {
                    img = state.sprites.fireball;
                    if (Array.isArray(img)) img = img[sprite.frame || 0];
                }
            } else if (sprite.type === 'wall') {
                img = state.sprites.fireballExplosion;
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            } else if (sprite.type === 'gunMan') {
                img = state.sprites.gunMan;
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            } else if (sprite.type === 'arenaTrigger') {
                img = sprite.activated ? state.sprites.arenaTriggerOn : state.sprites.arenaTriggerOff;
            } else if (sprite.type === 'killRoomIndicator') {
                img = sprite.completed ? state.sprites.kiligRoomDone : state.sprites.kiligRoomActive;
            } else {
                img = state.sprites[sprite.type];
                if (Array.isArray(img)) img = img[sprite.frame || 0];
            }

            // Calculate dimensions
            let spriteHeight = Math.abs(Math.floor(canvas.height / transformY * CONFIG.wallHeight));
            let spriteWidth = spriteHeight;

            // Aspect Ratio & Custom Scaling
            if (img && img.complete && img.naturalWidth > 0) {
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                let scale = 1.0;
                if (sprite.type && sprite.type.toLowerCase().includes('totem')) scale = 0.5;
                else if (sprite.speed !== undefined) scale = 0.5;
                else if (sprite.type === 'wall') scale = 0.8;
                else if (sprite.type === 'barrel') scale = 0.6;
                else if (sprite.type === 'lamp') scale = 0.75;
                else if (sprite.type === 'lamp2') scale = 0.7;
                else if (sprite.type === 'lamp3') scale = 0.7;
                else if (sprite.type === 'chair' || sprite.type === 'chair2') scale = 0.55;
                else if (sprite.type === 'hanger') scale = 0.8;
                else if (sprite.type === 'coin_small_pile') scale = 0.35;
                else if (sprite.type === 'coin_big_pile') scale = 0.45;

                spriteHeight = Math.abs(Math.floor(spriteHeight * scale));
                spriteWidth = Math.abs(Math.floor(spriteHeight * aspectRatio));
            }

            let spriteTop = Math.floor(canvas.height / 2 - spriteHeight / 2);

            // Align floor-based sprites to the floor instead of centering them vertically
            const isFloorSprite = 
                (sprite.type && (
                    sprite.type.startsWith('coin_') || 
                    sprite.type.startsWith('ammo') || 
                    sprite.type === 'addLife' || 
                    sprite.type === 'heavymachinegunPickup' ||
                    sprite.type === 'barrel' ||
                    sprite.type === 'chair' ||
                    sprite.type === 'chair2' ||
                    sprite.type === 'hanger' ||
                    sprite.type === 'lamp' ||
                    sprite.type === 'lamp2' ||
                    sprite.type === 'lamp3'
                )) || 
                (sprite.state && (
                    sprite.state === 'FLOOR' || 
                    sprite.state === 'FLOOR_SHOTGUN' || 
                    sprite.state === 'FLOOR_FIRE_1' || 
                    sprite.state === 'FLOOR_FIRE_2' ||
                    sprite.state === 'FLOOR_V2'
                ));

            if (isFloorSprite) {
                const wallHeightOnScreen = Math.abs(Math.floor(canvas.height / transformY * CONFIG.wallHeight));
                spriteTop = Math.floor(canvas.height / 2 + wallHeightOnScreen / 2 - spriteHeight);
            }

            // Frustum Culling
            const halfWidth = spriteWidth / 2;
            if (spriteScreenX + halfWidth < 0 || spriteScreenX - halfWidth > canvas.width) {
                continue;
            }

            const isFloating = sprite.speed !== undefined || sprite.type === 'wall' || sprite.type === 'explosion';
            if (CONFIG.drawSpriteShadows && !isFloating) {
                const shadowWidth = spriteWidth * 0.7;
                const shadowHeight = spriteWidth * 0.18;
                const cx = spriteScreenX;
                const cy = spriteTop + spriteHeight;
                const rx = shadowWidth / 2;
                const ry = shadowHeight / 2;

                ctx.save();
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                // Draw shadow columns only where visible (Z-buffer test)
                const startStripeX = Math.max(0, Math.floor(cx - rx));
                const endStripeX = Math.min(canvas.width - 1, Math.ceil(cx + rx));
                for (let x = startStripeX; x <= endStripeX; x++) {
                    if (transformY < zBuffer[x]) {
                        const dx = x - cx;
                        const normX = dx / rx;
                        const term = 1.0 - normX * normX;
                        if (term >= 0) {
                            const halfLen = ry * Math.sqrt(term);
                            const y1 = cy - halfLen;
                            const y2 = cy + halfLen;

                            // Clip shadow vertically so it only draws on the floor, not on walls
                            const wallDist = zBuffer[x];
                            const wallLineHeight = Math.floor(canvas.height / wallDist * CONFIG.wallHeight);
                            const wallDrawEnd = Math.floor(canvas.height / 2 + wallLineHeight / 2);

                            const clipY1 = Math.max(y1, wallDrawEnd);
                            const clipHeight = y2 - clipY1;

                            if (clipHeight > 0) {
                                ctx.fillRect(x, clipY1, 1, clipHeight);
                            }
                        }
                    }
                }
                ctx.restore();
            }

            if (img && img.complete && img.naturalWidth > 0) {
                // Batched sprite stripe rendering (Highly optimized!)
                let batchStart = -1;
                for (let stripe = 0; stripe < spriteWidth; stripe++) {
                    const x = Math.floor(spriteScreenX - halfWidth + stripe);
                    const isVisible = (x > 0 && x < canvas.width && transformY < zBuffer[x]);

                    if (isVisible) {
                        if (batchStart === -1) {
                            batchStart = stripe;
                        }
                    } else {
                        if (batchStart !== -1) {
                            drawSpriteBatch(ctx, img, batchStart, stripe - 1, spriteWidth, spriteScreenX, spriteTop, spriteHeight, sprite.isClimbing, alpha);
                            batchStart = -1;
                        }
                    }
                }
                if (batchStart !== -1) {
                    drawSpriteBatch(ctx, img, batchStart, spriteWidth - 1, spriteWidth, spriteScreenX, spriteTop, spriteHeight, sprite.isClimbing, alpha);
                }
            } else {
                // Fallback Box
                const startX = Math.floor(-halfWidth + spriteScreenX);
                const endX = Math.floor(halfWidth + spriteScreenX);
                if (startX < canvas.width && endX > 0 && transformY < zBuffer[Math.max(0, Math.min(canvas.width - 1, spriteScreenX))]) {
                    ctx.fillStyle = sprite.type === 'monster' ? 'red' : 'green';
                    ctx.fillRect(spriteScreenX - halfWidth, spriteTop, spriteWidth, spriteHeight);
                }
            }

            // --- Chain Aggro Visual "!" ---
            if (sprite.justAlerted && sprite.alertTimer > 0) {
                const alertAlpha = Math.min(1, sprite.alertTimer);
                ctx.save();
                ctx.font = `bold ${Math.floor(spriteHeight * 0.4)}px monospace`;
                ctx.fillStyle = `rgba(255, 255, 0, ${alertAlpha})`;
                ctx.textAlign = 'center';
                ctx.shadowBlur = 10;
                ctx.shadowColor = 'rgba(255, 100, 0, 0.8)';
                ctx.fillText('!', spriteScreenX, spriteTop - 4);
                ctx.restore();
            }
        }
    }

    // --- Render Blood Particles ---
    if (state.particles && state.particles.length > 0) {
        const dirX2 = Math.cos(state.player.dir);
        const dirY2 = Math.sin(state.player.dir);
        const planeX2 = -dirY2 * Math.tan(CONFIG.fov / 2);
        const planeY2 = dirX2 * Math.tan(CONFIG.fov / 2);
        const w2 = canvas.width;
        const h2 = canvas.height;

        for (const p of state.particles) {
            const pdx = p.wX + p.x - state.player.x;
            const pdy = p.wY + p.y - state.player.y;
            const det = dirX2 * planeY2 - dirY2 * planeX2;
            if (Math.abs(det) < 0.0001) continue;
            const invDet = 1.0 / det;
            const tY = invDet * (dirX2 * pdy - dirY2 * pdx);
            if (tY <= 0.1) continue;
            const tX = invDet * (planeY2 * pdx - planeX2 * pdy);
            const screenX = Math.floor(w2 / 2 * (1 + tX / tY));
            const screenY = Math.floor(h2 / 2 + CONFIG.wallHeight * h2 / (2 * tY));
            if (screenX < 0 || screenX >= w2 || screenY < -10 || screenY >= h2 + 10) continue;
            const lifeRatio = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = lifeRatio * 0.9;
            ctx.fillStyle = p.color || `rgb(${Math.floor(180 + 75 * lifeRatio)}, 0, 0)`;
            const sz = Math.floor(p.size * (1 / tY) * 40 * lifeRatio);
            if (sz > 0) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, Math.max(1, sz), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    const uiLayer = document.getElementById('ui-layer');
    if (state.showMap) {
        if (uiLayer) uiLayer.style.display = 'none';
        renderFullscreenMap(canvas, ctx);
    } else {
        if (uiLayer) uiLayer.style.display = '';
        renderMinimap(canvas, ctx);
    }
}


function renderMinimap(canvas, ctx) {
    const size = 120; // Smaller size
    const tileSize = 10; // Zoom level
    const viewRange = Math.ceil(size / tileSize / 2) + 1;
    const posX = canvas.width - size - 10;
    const posY = 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(posX, posY, size, size);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(posX, posY, size, size);

    // Clip to minimap area
    ctx.save();
    ctx.beginPath();
    ctx.rect(posX, posY, size, size);
    ctx.clip();

    const cx = state.player.x;
    const cy = state.player.y;
    const centerScreenX = posX + size / 2;
    const centerScreenY = posY + size / 2;

    // Rotate canvas so player always faces UP
    ctx.translate(centerScreenX, centerScreenY);
    ctx.rotate(-state.player.dir - Math.PI / 2);
    ctx.translate(-centerScreenX, -centerScreenY);

    // Draw Map (Visited Only)
    for (let y = Math.floor(cy - viewRange); y <= Math.ceil(cy + viewRange); y++) {
        for (let x = Math.floor(cx - viewRange); x <= Math.ceil(cx + viewRange); x++) {
            if (x >= 0 && x < state.map.width && y >= 0 && y < state.map.height) {
                if (state.map.visited && state.map.visited[y * state.map.width + x]) {
                    const drawX = posX + size / 2 + (x - cx) * tileSize;
                    const drawY = posY + size / 2 + (y - cy) * tileSize;

                    if (state.map.data[y * state.map.width + x] > 0) {
                        ctx.fillStyle = '#888';
                        ctx.fillRect(Math.floor(drawX), Math.floor(drawY), tileSize + 1, tileSize + 1);
                    } else {
                        ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
                        ctx.fillRect(Math.floor(drawX), Math.floor(drawY), tileSize + 1, tileSize + 1);
                    }
                }
            }
        }
    }

    // Items
    state.items.forEach(item => {
        const drawX = posX + size / 2 + (item.x - cx) * tileSize;
        const drawY = posY + size / 2 + (item.y - cy) * tileSize;

        // Only show if within bounds (simple check, clip handles drawing)
        if (Math.abs(item.x - cx) < viewRange && Math.abs(item.y - cy) < viewRange) {
            if (item.type === 'totemRed') ctx.fillStyle = '#f00';
            else if (item.type === 'totemGreen') ctx.fillStyle = '#0f0';
            else if (item.type === 'totemBlue') ctx.fillStyle = '#00f';
            else if (item.type === 'totemEmpty') ctx.fillStyle = '#aaa';
            else if (item.type === 'totemFull') ctx.fillStyle = '#ff0';
            else return;

            ctx.fillRect(drawX - 2, drawY - 2, 4, 4);
        }
    });

    // NPCs (like Gun Man) - Green
    state.npcs.forEach(npc => {
        const drawX = posX + size / 2 + (npc.x - cx) * tileSize;
        const drawY = posY + size / 2 + (npc.y - cy) * tileSize;
        if (Math.abs(npc.x - cx) < viewRange && Math.abs(npc.y - cy) < viewRange) {
            ctx.fillStyle = '#0f0';
            ctx.beginPath();
            ctx.arc(drawX, drawY, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    // Enemies (Different icons per type)
    state.enemies.forEach(e => {
        if (e.state === 'DOWN' || e.state === 'FLOOR' || e.state === 'DOWN_SHOTGUN' || e.state === 'FLOOR_SHOTGUN' || e.state === 'HIT_SHOTGUN' || e.state === 'HIT_FIRE' || e.state === 'FLOOR_FIRE_1' || e.state === 'FLOOR_FIRE_2' || e.state.includes('V2')) return;

        const drawX = posX + size / 2 + (e.x - cx) * tileSize;
        const drawY = posY + size / 2 + (e.y - cy) * tileSize;
        if (Math.abs(e.x - cx) < viewRange && Math.abs(e.y - cy) < viewRange) {
            if (e.type === 'brain') {
                ctx.fillStyle = '#f0f'; // Purple
                ctx.beginPath();
                ctx.arc(drawX, drawY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'geco') {
                ctx.fillStyle = '#f90'; // Orange
                ctx.beginPath();
                ctx.arc(drawX, drawY, 2.5, 0, Math.PI * 2);
                ctx.fill();
            } else if (e.type === 'monster' || e.type === 'monsterB2') {
                ctx.fillStyle = '#f33'; // Bright Red triangle
                ctx.beginPath();
                ctx.moveTo(drawX, drawY - 3);
                ctx.lineTo(drawX - 2.5, drawY + 2.5);
                ctx.lineTo(drawX + 2.5, drawY + 2.5);
                ctx.closePath();
                ctx.fill();
            } else {
                ctx.fillStyle = '#a22'; // Dark Red square
                ctx.fillRect(drawX - 2, drawY - 2, 4, 4);
            }
        }
    });

    // Player (Center)
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(posX + size / 2, posY + size / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Direction
    ctx.strokeStyle = '#0f0';
    ctx.beginPath();
    ctx.moveTo(posX + size / 2, posY + size / 2);
    ctx.lineTo(posX + size / 2 + Math.cos(state.player.dir) * 10, posY + size / 2 + Math.sin(state.player.dir) * 10);
    ctx.stroke();

    // Sonar Target Pointer
    if (state.player.weaponIndex === 4) {
        const mode = state.player.sonarMode;
        let target = null;
        if (mode === 'totem') {
            target = state.items.find(i => i.isGoal);
        } else {
            const typeName = 'totem' + mode.charAt(0).toUpperCase() + mode.slice(1);
            target = state.items.find(i => i.type === typeName);
        }
        if (target) {
            const dx = target.x - state.player.x;
            const dy = target.y - state.player.y;
            const angle = Math.atan2(dy, dx);
            ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(posX + size / 2, posY + size / 2);
            ctx.lineTo(posX + size / 2 + Math.cos(angle) * 35, posY + size / 2 + Math.sin(angle) * 35);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    ctx.restore();
}

function renderFullscreenMap(canvas, ctx) {
    const w = canvas.width;
    const h = canvas.height;

    // 1. Semi-transparent dark background overlay
    ctx.fillStyle = 'rgba(10, 8, 18, 0.90)';
    ctx.fillRect(0, 0, w, h);

    // 2. Cyberpunk grid background
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    ctx.beginPath();
    for (let gx = 0; gx < w; gx += gridSize) {
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, h);
    }
    for (let gy = 0; gy < h; gy += gridSize) {
        ctx.moveTo(0, gy);
        ctx.lineTo(w, gy);
    }
    ctx.stroke();

    // 3. Ambient Scanlines Effect
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let sl = 0; sl < h; sl += 4) {
        ctx.fillRect(0, sl, w, 2);
    }

    // 4. Vignette / Map borders
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, w - 40, h - 40);

    // 5. Draw level statistics
    let floorCount = 0;
    let visitedFloorCount = 0;
    for (let idx = 0; idx < state.map.width * state.map.height; idx++) {
        if (state.map.data[idx] === 0) {
            floorCount++;
            if (state.map.visited && state.map.visited[idx]) visitedFloorCount++;
        }
    }
    const explorePct = floorCount > 0 ? Math.floor((visitedFloorCount / floorCount) * 100) : 0;

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.textAlign = 'left';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0, 240, 255, 0.5)';
    
    ctx.fillText('=== TACTICAL MAP LINK ===', 45, 60);
    ctx.font = '16px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`LEVEL: ${state.level}`, 45, 95);
    ctx.fillText(`EXPLORATION RATE: ${explorePct}%`, 45, 120);
    ctx.fillText(`KILLS: ${state.player.kills}`, 45, 145);

    // Inventory / Objectives feedback
    ctx.fillStyle = 'rgba(0, 240, 255, 0.85)';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('OBJECTIVES:', 45, 185);
    ctx.font = 'bold 14px monospace';

    // Red Totem Box
    if (state.player.inventory.red) {
        ctx.fillStyle = 'rgba(255, 51, 51, 0.15)';
        ctx.fillRect(45, 202, 160, 24);
        ctx.strokeStyle = 'rgba(255, 51, 51, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(45, 202, 160, 24);
        ctx.fillStyle = '#ff3333';
        ctx.fillText('[X] RED TOTEM', 55, 219);
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(45, 202, 160, 24);
        ctx.strokeStyle = 'rgba(100, 30, 30, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 202, 160, 24);
        ctx.fillStyle = '#662222';
        ctx.fillText('[ ] RED TOTEM', 55, 219);
    }

    // Green Totem Box
    if (state.player.inventory.green) {
        ctx.fillStyle = 'rgba(51, 255, 51, 0.15)';
        ctx.fillRect(45, 232, 160, 24);
        ctx.strokeStyle = 'rgba(51, 255, 51, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(45, 232, 160, 24);
        ctx.fillStyle = '#33ff33';
        ctx.fillText('[X] GREEN TOTEM', 55, 249);
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(45, 232, 160, 24);
        ctx.strokeStyle = 'rgba(30, 100, 30, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 232, 160, 24);
        ctx.fillStyle = '#226622';
        ctx.fillText('[ ] GREEN TOTEM', 55, 249);
    }

    // Blue Totem Box
    if (state.player.inventory.blue) {
        ctx.fillStyle = 'rgba(51, 51, 255, 0.15)';
        ctx.fillRect(45, 262, 160, 24);
        ctx.strokeStyle = 'rgba(51, 51, 255, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(45, 262, 160, 24);
        ctx.fillStyle = '#3333ff';
        ctx.fillText('[X] BLUE TOTEM', 55, 279);
    } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        ctx.fillRect(45, 262, 160, 24);
        ctx.strokeStyle = 'rgba(30, 30, 100, 0.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(45, 262, 160, 24);
        ctx.fillStyle = '#222266';
        ctx.fillText('[ ] BLUE TOTEM', 55, 279);
    }

    ctx.shadowBlur = 0; // Reset shadow

    // 6. Draw Map Grid (Centered and scaled)
    const mapW = state.map.width;
    const mapH = state.map.height;
    const margin = 60;
    const textWidth = 320;
    
    // Center and fit calculations
    const availableW = w - textWidth - margin * 2;
    const availableH = h - margin * 2;
    const tileSize = Math.max(2, Math.floor(Math.min(availableW / mapW, availableH / mapH)));
    
    const startX = Math.floor(textWidth + margin + (availableW - mapW * tileSize) / 2);
    const startY = Math.floor(margin + (availableH - mapH * tileSize) / 2);

    // Draw map border
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(startX - 2, startY - 2, mapW * tileSize + 4, mapH * tileSize + 4);

    // Draw tiles
    for (let y = 0; y < mapH; y++) {
        for (let x = 0; x < mapW; x++) {
            const idx = y * mapW + x;
            if (state.map.visited && state.map.visited[idx] === 1) {
                const cellX = startX + x * tileSize;
                const cellY = startY + y * tileSize;
                const cellVal = state.map.data[idx];

                if (cellVal > 0) {
                    if (cellVal === CONFIG.destructibleWallTexIndex) {
                        ctx.fillStyle = 'rgba(255, 140, 0, 0.6)'; // Cracked wall is orange
                    } else {
                        ctx.fillStyle = 'rgba(0, 150, 180, 0.45)'; // Standard wall is blue/gray
                    }
                    ctx.fillRect(cellX, cellY, tileSize, tileSize);
                    
                    ctx.strokeStyle = 'rgba(0, 240, 255, 0.1)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(cellX, cellY, tileSize, tileSize);
                } else {
                    ctx.fillStyle = 'rgba(15, 30, 45, 0.25)';
                    ctx.fillRect(cellX, cellY, tileSize, tileSize);
                }
            }
        }
    }

    // 7. Draw Objectives & Points of interest (only if visited)
    state.items.forEach(item => {
        const ix = Math.floor(item.x);
        const iy = Math.floor(item.y);
        const idx = iy * mapW + ix;
        
        if (state.map.visited && state.map.visited[idx] === 1) {
            const cellX = startX + item.x * tileSize;
            const cellY = startY + item.y * tileSize;
            
            if (item.type === 'totemRed') {
                ctx.fillStyle = '#f00';
                drawMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            } else if (item.type === 'totemGreen') {
                ctx.fillStyle = '#0f0';
                drawMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            } else if (item.type === 'totemBlue') {
                ctx.fillStyle = '#00f';
                drawMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            } else if (item.type === 'totemEmpty') {
                ctx.fillStyle = '#888';
                drawMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            } else if (item.type === 'totemFull') {
                ctx.fillStyle = '#ff0';
                drawMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            } else if (item.type === 'addLife') {
                ctx.fillStyle = '#ff3388';
                drawCrossMapPoint(ctx, cellX, cellY, tileSize * 0.35);
            } else if (item.type === 'arenaTrigger') {
                drawXMapPoint(ctx, cellX, cellY, tileSize * 0.45);
            }
        }
    });

    // NPCs
    state.npcs.forEach(npc => {
        const nx = Math.floor(npc.x);
        const ny = Math.floor(npc.y);
        const idx = ny * mapW + nx;
        if (state.map.visited && state.map.visited[idx] === 1) {
            const cellX = startX + npc.x * tileSize;
            const cellY = startY + npc.y * tileSize;
            ctx.fillStyle = '#0f0';
            drawMapPoint(ctx, cellX, cellY, tileSize * 0.4);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('$', cellX, cellY + 3);
        }
    });

    // 8. Draw Player
    const px = startX + state.player.x * tileSize;
    const py = startY + state.player.y * tileSize;
    const pSize = Math.max(6, tileSize * 0.8);
    
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(state.player.dir);
    
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#fff';
    
    ctx.beginPath();
    ctx.moveTo(pSize, 0);
    ctx.lineTo(-pSize * 0.6, -pSize * 0.5);
    ctx.lineTo(-pSize * 0.6, pSize * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Pulse effect
    const pulseRadius = (1.5 + Math.sin(performance.now() * 0.005) * 0.5) * pSize * 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(px, py, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('Press [M] to Close Tactical Overlay', w / 2, h - 35);
}

function drawMapPoint(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
}

function drawCrossMapPoint(ctx, x, y, size) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();
}

function drawXMapPoint(ctx, x, y, size) {
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ff3333'; // Red
    ctx.beginPath();
    ctx.moveTo(x - size, y - size);
    ctx.lineTo(x + size, y + size);
    ctx.moveTo(x + size, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.stroke();
}
