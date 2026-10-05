import { state } from './state.js';
import { CONFIG } from './config.js';

// --- ROOM SHAPE GENERATORS ---

function createRectRoom(x, y, w, h) {
    return { x, y, w, h, shape: 'rect', tiles: getRectTiles(x, y, w, h) };
}

function getRectTiles(x, y, w, h) {
    const tiles = [];
    for (let ry = y; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    return tiles;
}

function createLRoom(x, y, w, h) {
    // L-shape: full bottom + left column
    const tiles = [];
    const halfW = Math.floor(w / 2);
    const halfH = Math.floor(h / 2);

    // Bottom half (full width)
    for (let ry = y + halfH; ry < y + h; ry++) {
        for (let rx = x; rx < x + w; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    // Top left (half width)
    for (let ry = y; ry < y + halfH; ry++) {
        for (let rx = x; rx < x + halfW; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    return { x, y, w, h, shape: 'L', tiles };
}

function createTRoom(x, y, w, h) {
    // T-shape: full top row + center column
    const tiles = [];
    const halfH = Math.floor(h / 2);
    const thirdW = Math.floor(w / 3);

    // Top half (full width)
    for (let ry = y; ry < y + halfH; ry++) {
        for (let rx = x; rx < x + w; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    // Bottom center column
    for (let ry = y + halfH; ry < y + h; ry++) {
        for (let rx = x + thirdW; rx < x + w - thirdW; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    return { x, y, w, h, shape: 'T', tiles };
}

function createCrossRoom(x, y, w, h) {
    // Cross/Plus shape
    const tiles = [];
    const thirdW = Math.floor(w / 3);
    const thirdH = Math.floor(h / 3);

    // Horizontal bar (full width, middle third height)
    for (let ry = y + thirdH; ry < y + h - thirdH; ry++) {
        for (let rx = x; rx < x + w; rx++) {
            tiles.push({ x: rx, y: ry });
        }
    }
    // Vertical bar (middle third width, full height)
    for (let ry = y; ry < y + h; ry++) {
        for (let rx = x + thirdW; rx < x + w - thirdW; rx++) {
            // Avoid duplicates
            if (ry < y + thirdH || ry >= y + h - thirdH) {
                tiles.push({ x: rx, y: ry });
            }
        }
    }
    return { x, y, w, h, shape: 'cross', tiles };
}

function createCircularRoom(x, y, w, h) {
    // Oval/circular room
    const tiles = [];
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rx = w / 2 - 0.5;
    const ry = h / 2 - 0.5;

    for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
            const dx = (px + 0.5 - cx) / rx;
            const dy = (py + 0.5 - cy) / ry;
            if (dx * dx + dy * dy <= 1.0) {
                tiles.push({ x: px, y: py });
            }
        }
    }
    return { x, y, w, h, shape: 'circular', tiles };
}

function createCaveRoom(x, y, w, h) {
    const grid = [];
    for (let ry = 0; ry < h; ry++) {
        grid[ry] = [];
        for (let rx = 0; rx < w; rx++) {
            if (ry === 0 || ry === h - 1 || rx === 0 || rx === w - 1) {
                grid[ry][rx] = 1;
            } else {
                grid[ry][rx] = Math.random() < 0.45 ? 1 : 0;
            }
        }
    }

    for (let step = 0; step < 3; step++) {
        const nextGrid = [];
        for (let ry = 0; ry < h; ry++) {
            nextGrid[ry] = [];
            for (let rx = 0; rx < w; rx++) {
                if (ry === 0 || ry === h - 1 || rx === 0 || rx === w - 1) {
                    nextGrid[ry][rx] = 1;
                    continue;
                }
                let walls = 0;
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        if (grid[ry + dy][rx + dx] === 1) walls++;
                    }
                }
                nextGrid[ry][rx] = walls >= 5 ? 1 : 0;
            }
        }
        for (let ry = 0; ry < h; ry++) {
            for (let rx = 0; rx < w; rx++) {
                grid[ry][rx] = nextGrid[ry][rx];
            }
        }
    }

    const visited = Array.from({ length: h }, () => new Uint8Array(w));
    const components = [];
    for (let ry = 1; ry < h - 1; ry++) {
        for (let rx = 1; rx < w - 1; rx++) {
            if (grid[ry][rx] === 0 && !visited[ry][rx]) {
                const comp = [];
                const queue = [{ x: rx, y: ry }];
                visited[ry][rx] = 1;
                while (queue.length > 0) {
                    const curr = queue.shift();
                    comp.push(curr);
                    const dirs = [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
                    for (const d of dirs) {
                        const nx = curr.x + d.x;
                        const ny = curr.y + d.y;
                        if (nx > 0 && nx < w - 1 && ny > 0 && ny < h - 1) {
                            if (grid[ny][nx] === 0 && !visited[ny][nx]) {
                                visited[ny][nx] = 1;
                                queue.push({ x: nx, y: ny });
                            }
                        }
                    }
                }
                components.push(comp);
            }
        }
    }

    if (components.length === 0) {
        return createRectRoom(x, y, w, h);
    }
    components.sort((a, b) => b.length - a.length);
    const largest = components[0];

    for (let ry = 0; ry < h; ry++) {
        for (let rx = 0; rx < w; rx++) {
            grid[ry][rx] = 1;
        }
    }
    largest.forEach(tile => {
        grid[tile.y][tile.x] = 0;
    });

    const tiles = [];
    for (let ry = 0; ry < h; ry++) {
        for (let rx = 0; rx < w; rx++) {
            if (grid[ry][rx] === 0) {
                tiles.push({ x: x + rx, y: y + ry });
            }
        }
    }

    if (tiles.length < 5) {
        return createRectRoom(x, y, w, h);
    }
    return { x, y, w, h, shape: 'cave', tiles };
}

// --- ROOM GENERATION ---

function generateRoom(x, y, w, h, level) {
    // Rooms must be at least 8x8 for shaped rooms
    if (w >= 8 && h >= 8 && Math.random() < 0.5) {
        const shapes = [createLRoom, createTRoom, createCrossRoom, createCircularRoom, createCaveRoom];
        const shapeFn = shapes[Math.floor(Math.random() * shapes.length)];
        return shapeFn(x, y, w, h);
    }
    return createRectRoom(x, y, w, h);
}

// --- PILLAR/COLUMN GENERATION ---

function addPillars(room, mapData, size, style) {
    // Only add pillars to larger rooms
    if (room.w < 8 || room.h < 8) return;
    if (Math.random() > 0.35) return; // 35% chance

    const cx = Math.floor(room.x + room.w / 2);
    const cy = Math.floor(room.y + room.h / 2);

    // Pattern selection
    const pattern = Math.floor(Math.random() * 3);

    const getPillarTex = (px, py) => {
        return style.baseIdx + ((px + py) % style.count) + 1;
    };

    if (pattern === 0) {
        // 4 corner pillars
        const offX = Math.floor(room.w / 4);
        const offY = Math.floor(room.h / 4);
        const positions = [
            { x: room.x + offX, y: room.y + offY },
            { x: room.x + room.w - offX - 1, y: room.y + offY },
            { x: room.x + offX, y: room.y + room.h - offY - 1 },
            { x: room.x + room.w - offX - 1, y: room.y + room.h - offY - 1 }
        ];
        positions.forEach(p => {
            if (p.x > 0 && p.x < size - 1 && p.y > 0 && p.y < size - 1) {
                mapData[p.y * size + p.x] = getPillarTex(p.x, p.y);
            }
        });
    } else if (pattern === 1) {
        // Center pillar (2x2)
        if (cx > 1 && cx < size - 2 && cy > 1 && cy < size - 2) {
            mapData[cy * size + cx] = getPillarTex(cx, cy);
            mapData[cy * size + cx + 1] = getPillarTex(cx + 1, cy);
            mapData[(cy + 1) * size + cx] = getPillarTex(cx, cy + 1);
            mapData[(cy + 1) * size + cx + 1] = getPillarTex(cx + 1, cy + 1);
        }
    } else {
        // Row of pillars along the longer axis
        if (room.w >= room.h) {
            // Horizontal row
            for (let px = room.x + 3; px < room.x + room.w - 3; px += 3) {
                if (mapData[cy * size + px] === 0) {
                    mapData[cy * size + px] = getPillarTex(px, cy);
                }
            }
        } else {
            // Vertical row
            for (let py = room.y + 3; py < room.y + room.h - 3; py += 3) {
                if (mapData[py * size + cx] === 0) {
                    mapData[py * size + cx] = getPillarTex(cx, py);
                }
            }
        }
    }
}

// --- THEMATIC ZONES ---

// Zone themes: each assigns a range of wall, floor, and ceil textures, as well as fog parameters
const ZONE_THEMES = [
    { name: 'dungeon', walls: [0, 1, 2, 3], floors: [0, 4], ceils: [0, 1], fogStart: 3.0, fogEnd: 10.0 },         // Brick, wood/cobble, stone
    { name: 'fortress', walls: [4, 5, 6, 7], floors: [1, 2], ceils: [2, 3], fogStart: 6.0, fogEnd: 16.0 },         // Stone, tile/metal, metal/tile
    { name: 'crypt', walls: [8, 9, 10, 11], floors: [2, 3], ceils: [0, 4], fogStart: 2.0, fogEnd: 8.0 },          // Stone dark, metal/carpet, stone/wood
    { name: 'sanctum', walls: [12, 13, 14, 15], floors: [3, 4], ceils: [1, 2], fogStart: 4.0, fogEnd: 12.0 },      // Stone special, carpet/cobble, wood/metal
];

function assignZone(roomIndex, totalRooms) {
    // Divide rooms into zones based on their index (roughly equal groups)
    const zonesCount = ZONE_THEMES.length;
    const zoneIndex = Math.floor((roomIndex / totalRooms) * zonesCount);
    return ZONE_THEMES[Math.min(zoneIndex, zonesCount - 1)];
}

// --- MST + LOOPS CONNECTIVITY ---

function connectRoomsMST(rooms, mapData, size) {
    if (rooms.length <= 1) return;

    // Calculate centers
    const centers = rooms.map(r => ({
        x: Math.floor(r.x + r.w / 2),
        y: Math.floor(r.y + r.h / 2)
    }));

    // Build edge list (all pairs with distance)
    const edges = [];
    for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
            const dx = centers[i].x - centers[j].x;
            const dy = centers[i].y - centers[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            edges.push({ i, j, dist });
        }
    }

    // Sort edges by distance
    edges.sort((a, b) => a.dist - b.dist);

    // Kruskal's MST with Union-Find
    const parent = rooms.map((_, i) => i);
    const rank = new Array(rooms.length).fill(0);

    function find(x) {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
    }

    function union(x, y) {
        const px = find(x), py = find(y);
        if (px === py) return false;
        if (rank[px] < rank[py]) parent[px] = py;
        else if (rank[px] > rank[py]) parent[py] = px;
        else { parent[py] = px; rank[px]++; }
        return true;
    }

    const mstEdges = [];
    for (const edge of edges) {
        if (union(edge.i, edge.j)) {
            mstEdges.push(edge);
        }
        if (mstEdges.length === rooms.length - 1) break;
    }

    // Build MST corridors
    for (const edge of mstEdges) {
        carveCorridor(centers[edge.i], centers[edge.j], mapData, size);
    }

    // Add extra loops (2-4 extra connections for alternate paths)
    const extraLoops = 2 + Math.floor(Math.random() * 3);
    const remainingEdges = edges.filter(e => !mstEdges.includes(e));
    for (let i = 0; i < Math.min(extraLoops, remainingEdges.length); i++) {
        const edge = remainingEdges[i];
        // Only add short-ish connections to avoid crazy long corridors
        if (edge.dist < size * 0.5) {
            carveCorridor(centers[edge.i], centers[edge.j], mapData, size);
        }
    }
}

// --- CORRIDOR CARVING ---

function carveCorridor(from, to, mapData, size) {
    const clearBlock = (x, y) => {
        if (x > 0 && x < size - 1 && y > 0 && y < size - 1) {
            mapData[y * size + x] = 0;
            // Make 2-wide by clearing adjacent
            if (x + 1 < size - 1) mapData[y * size + (x + 1)] = 0;
            if (y + 1 < size - 1) mapData[(y + 1) * size + x] = 0;
            if (x + 1 < size - 1 && y + 1 < size - 1) mapData[(y + 1) * size + (x + 1)] = 0;
        }
    };

    // Serpentine corridor: add random midpoints for curves
    const useSerpentine = Math.random() < 0.3;

    if (useSerpentine) {
        // Add a random midpoint offset for a curve
        const midX = Math.floor((from.x + to.x) / 2) + Math.floor(Math.random() * 6 - 3);
        const midY = Math.floor((from.y + to.y) / 2) + Math.floor(Math.random() * 6 - 3);

        // From -> Mid
        carveL(from.x, from.y, midX, midY, clearBlock);
        // Mid -> To
        carveL(midX, midY, to.x, to.y, clearBlock);
    } else {
        // Standard L-shaped corridor
        carveL(from.x, from.y, to.x, to.y, clearBlock);
    }
}

function carveL(x1, y1, x2, y2, clearFn) {
    if (Math.random() > 0.5) {
        // Horizontal first, then vertical
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) clearFn(x, y1);
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) clearFn(x2, y);
    } else {
        // Vertical first, then horizontal
        for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) clearFn(x1, y);
        for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) clearFn(x, y2);
    }
}

// --- ALCOVES IN CORRIDORS ---

function addAlcoves(mapData, size, rooms) {
    // Scan corridors and add small 2x2 alcoves on random sides
    const alcoveCount = 3 + Math.floor(Math.random() * 4);
    for (let a = 0; a < alcoveCount; a++) {
        // Pick a random corridor cell (floor tile not in any room)
        let attempts = 0;
        while (attempts < 50) {
            const x = 2 + Math.floor(Math.random() * (size - 4));
            const y = 2 + Math.floor(Math.random() * (size - 4));

            if (mapData[y * size + x] === 0) {
                // Check it's a corridor (surrounded by walls on 2+ sides)
                let wallCount = 0;
                if (mapData[(y - 1) * size + x] > 0) wallCount++;
                if (mapData[(y + 1) * size + x] > 0) wallCount++;
                if (mapData[y * size + (x - 1)] > 0) wallCount++;
                if (mapData[y * size + (x + 1)] > 0) wallCount++;

                if (wallCount >= 2) {
                    // Carve alcove in a random wall direction
                    const dirs = [
                        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
                    ];
                    const dir = dirs[Math.floor(Math.random() * dirs.length)];
                    const ax = x + dir.dx;
                    const ay = y + dir.dy;
                    const ax2 = ax + dir.dx;
                    const ay2 = ay + dir.dy;

                    if (ax > 0 && ax < size - 1 && ay > 0 && ay < size - 1 &&
                        ax2 > 0 && ax2 < size - 1 && ay2 > 0 && ay2 < size - 1) {
                        mapData[ay * size + ax] = 0;
                        mapData[ay2 * size + ax2] = 0;
                    }
                    break;
                }
            }
            attempts++;
        }
    }
}

// --- SECRET WALLS ---

function placeSecretWalls(mapData, size, rooms) {
    const secrets = [];
    const count = CONFIG.secretWallsPerLevel;

    for (let i = 0; i < count; i++) {
        let attempts = 0;
        while (attempts < 50) {
            // Pick a room (not the first)
            const room = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
            // Pick a wall cell adjacent to the room
            const side = Math.floor(Math.random() * 4);
            let wx, wy;

            if (side === 0) { wx = room.x - 1; wy = room.y + Math.floor(Math.random() * room.h); }
            else if (side === 1) { wx = room.x + room.w; wy = room.y + Math.floor(Math.random() * room.h); }
            else if (side === 2) { wx = room.x + Math.floor(Math.random() * room.w); wy = room.y - 1; }
            else { wx = room.x + Math.floor(Math.random() * room.w); wy = room.y + room.h; }

            if (wx > 1 && wx < size - 2 && wy > 1 && wy < size - 2) {
                if (mapData[wy * size + wx] > 0) {
                    // Check that behind the wall there's also wall (so we can carve a secret room)
                    const behindX = side === 0 ? wx - 1 : side === 1 ? wx + 1 : wx;
                    const behindY = side === 2 ? wy - 1 : side === 3 ? wy + 1 : wy;
                    const behind2X = side === 0 ? wx - 2 : side === 1 ? wx + 2 : wx;
                    const behind2Y = side === 2 ? wy - 2 : side === 3 ? wy + 2 : wy;

                    if (behind2X > 0 && behind2X < size - 1 && behind2Y > 0 && behind2Y < size - 1) {
                        if (mapData[behindY * size + behindX] > 0 && mapData[behind2Y * size + behind2X] > 0) {
                            const isDestructible = Math.random() < 0.4;
                            if (isDestructible) {
                                mapData[wy * size + wx] = CONFIG.destructibleWallTexIndex;
                            } else {
                                mapData[wy * size + wx] = -1;
                                secrets.push({ x: wx, y: wy, discovered: false, behindX, behindY });
                            }
                            // Carve secret alcove
                            mapData[behindY * size + behindX] = 0;
                            mapData[behind2Y * size + behind2X] = 0;
                            break;
                        }
                    }
                }
            }
            attempts++;
        }
    }
    return secrets;
}

// --- KILL ROOMS ---

function selectKillRooms(rooms, level) {
    const eligible = rooms.filter((r, i) => i > 0 && r.w >= CONFIG.killRoomMinSize && r.h >= CONFIG.killRoomMinSize && !r.isArenaRoom && !r.isTreasureVault);
    const killRooms = [];

    // Pick 1-2 kill rooms
    const count = Math.min(eligible.length, level >= 3 ? 2 : 1);
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
        if (Math.random() < CONFIG.killRoomChance || level >= 3) {
            const room = shuffled[i];
            room.isKillRoom = true;
            room.killRoomActivated = false;
            killRooms.push(rooms.indexOf(room));
        }
    }
    return killRooms;
}

function trySpawnTreasureVault(rooms, mapData, size, level) {
    let vaultsPlaced = 0;
    const targetVaults = 2;
    let attempts = 0;
    
    while (vaultsPlaced < targetVaults && attempts < 100) {
        attempts++;
        if (rooms.length <= 1) break;
        const r = rooms[1 + Math.floor(Math.random() * (rooms.length - 1))];
        if (r.isArenaRoom || r.isTreasureVault) continue;
        
        const side = Math.floor(Math.random() * 4);
        let vx, vy, vw = 5, vh = 5;
        let sx, sy;
        
        if (side === 0) { // Left
            vx = r.x - 6;
            vy = r.y + Math.floor((r.h - vh) / 2);
            sx = r.x - 1;
            sy = vy + 2;
        } else if (side === 1) { // Right
            vx = r.x + r.w + 1;
            vy = r.y + Math.floor((r.h - vh) / 2);
            sx = r.x + r.w;
            sy = vy + 2;
        } else if (side === 2) { // Top
            vx = r.x + Math.floor((r.w - vw) / 2);
            vy = r.y - 6;
            sx = vx + 2;
            sy = r.y - 1;
        } else { // Bottom
            vx = r.x + Math.floor((r.w - vw) / 2);
            vy = r.y + r.h + 1;
            sx = vx + 2;
            sy = r.y + r.h;
        }
        
        if (vx < 1 || vx + vw >= size - 1 || vy < 1 || vy + vh >= size - 1) continue;
        
        let clear = true;
        for (let y = vy - 1; y <= vy + vh; y++) {
            for (let x = vx - 1; x <= vx + vw; x++) {
                if (mapData[y * size + x] <= 0) {
                    clear = false;
                    break;
                }
            }
            if (!clear) break;
        }
        
        if (clear) {
            const tiles = [];
            const zone = assignZone(rooms.length, rooms.length + 10);
            const roomFloor = zone.floors[Math.floor(Math.random() * zone.floors.length)];
            const roomCeil = zone.ceils[Math.floor(Math.random() * zone.ceils.length)];
            const primaryLvl = ((level - 1) % 6) + 1;
            const styles = state.wallStyles.filter(s => s.level === primaryLvl);
            const style = styles[Math.floor(Math.random() * styles.length)] || state.wallStyles[0];

            for (let y = vy; y < vy + vh; y++) {
                for (let x = vx; x < vx + vw; x++) {
                    const idx = y * size + x;
                    mapData[idx] = 0;
                    state.map.floorData[idx] = roomFloor;
                    state.map.ceilData[idx] = roomCeil;
                    tiles.push({ x, y });
                }
            }
            
            for (let y = vy - 1; y <= vy + vh; y++) {
                for (let x = vx - 1; x <= vx + vw; x++) {
                    if (x === vx - 1 || x === vx + vw || y === vy - 1 || y === vy + vh) {
                        mapData[y * size + x] = style.baseIdx + ((x + y) % style.count) + 1;
                    }
                }
            }
            
            const isDestructible = Math.random() < 0.5;
            if (isDestructible) {
                mapData[sy * size + sx] = CONFIG.destructibleWallTexIndex;
            } else {
                mapData[sy * size + sx] = -1; // Secret Wall
            }
            
            const vault = {
                x: vx, y: vy, w: vw, h: vh,
                shape: 'rect',
                tiles: tiles,
                isTreasureVault: true,
                zone: zone
            };
            
            rooms.push(vault);
            
            if (!isDestructible) {
                state.secretWalls.push({
                    x: sx,
                    y: sy,
                    discovered: false,
                    behindX: vx + 2,
                    behindY: vy + 2
                });
            }
            
            const lootType = (level >= 3 && Math.random() < 0.35) ? 'heavymachinegunPickup' : (Math.random() < 0.5 ? 'addLife' : 'ammoCannon');
            state.items.push({
                x: vx + 2.5,
                y: vy + 2.5,
                type: lootType
            });
            
            state.items.push({ x: vx + 1.5, y: vy + 1.5, type: 'coin_small_pile' });
            state.items.push({ x: vx + 3.5, y: vy + 3.5, type: 'coin_big_pile' });
            
            vaultsPlaced++;
            console.log(`Placed Treasure Vault at ${vx},${vy} sharing secret wall at ${sx},${sy}`);
        }
    }
}

function connectRoomsHubAndSpoke(rooms, mapData, size, lvl) {
    if (rooms.length <= 1) return;

    const hub = rooms[0];
    const hubCenter = {
        x: Math.floor(hub.x + hub.w / 2),
        y: Math.floor(hub.y + hub.h / 2)
    };

    const normalRooms = rooms.filter(r => !r.isTreasureVault && r !== hub);

    const branches = [[], [], []];
    normalRooms.forEach(r => {
        const rx = r.x + r.w / 2;
        const ry = r.y + r.h / 2;
        const angle = Math.atan2(ry - hubCenter.y, rx - hubCenter.x) + Math.PI;
        const branchIdx = Math.floor((angle / (Math.PI * 2)) * 3) % 3;
        branches[branchIdx].push(r);
    });

    state.branches = branches;

    branches.forEach((branchRooms, bIdx) => {
        if (branchRooms.length === 0) return;

        if (branchRooms.length > 1) {
            connectRoomsMST(branchRooms, mapData, size);
        }

        let closestRoom = null;
        let minDist = Infinity;
        branchRooms.forEach(r => {
            const rx = r.x + r.w / 2;
            const ry = r.y + r.h / 2;
            const dist = Math.hypot(rx - hubCenter.x, ry - hubCenter.y);
            if (dist < minDist) {
                minDist = dist;
                closestRoom = r;
            }
        });

        if (closestRoom) {
            const closestCenter = {
                x: Math.floor(closestRoom.x + closestRoom.w / 2),
                y: Math.floor(closestRoom.y + closestRoom.h / 2)
            };
            carveCorridor(hubCenter, closestCenter, mapData, size);

            const midX = Math.floor((hubCenter.x + closestCenter.x) / 2);
            const midY = Math.floor((hubCenter.y + closestCenter.y) / 2);

            if (mapData[midY * size + midX] === 0) {
                const useLvl = ((lvl - 1) % 6) + 1;
                const gateTexMap = { 1: 7, 2: 23, 3: 40, 4: 55, 5: 72, 6: 92 };
                const gateTexIdx = gateTexMap[useLvl] || 7;
                mapData[midY * size + midX] = gateTexIdx + 1; // Gate Wall

                const gkx = Math.floor(hubCenter.x + (midX - hubCenter.x) * 0.4);
                const gky = Math.floor(hubCenter.y + (midY - hubCenter.y) * 0.4);

                const keeperId = Math.random();
                state.enemies.push({
                    id: keeperId,
                    x: gkx + 0.5,
                    y: gky + 0.5,
                    type: 'soldierB',
                    hp: 110 + lvl * 10,
                    vx: 0, vy: 0,
                    state: 'IDLE',
                    frame: 0,
                    animTimer: 0,
                    isGatekeeper: true,
                    speedScale: 1.0
                });

                state.gates.push({
                    x: midX,
                    y: midY,
                    gatekeeperId: keeperId,
                    opened: false
                });
                console.log(`Placed gate at ${midX}, ${midY} with keeper in branch ${bIdx}`);
            }
        }
    });
}

// ============================
// MAIN LEVEL GENERATOR
// ============================

export function generateLevel(lvl) {
    let size;
    let numRooms;
    if (lvl === 1) {
        size = 50;
        numRooms = 17;
    } else if (lvl === 2) {
        size = 65;
        numRooms = 21;
    } else if (lvl <= 5) {
        size = 64;
        numRooms = 15 + lvl;
    } else {
        size = 96;
        numRooms = 24 + lvl;
    }

    state.map = {
        width: size,
        height: size,
        data: new Int8Array(size * size),
        floorData: new Int8Array(size * size).fill(0),
        ceilData: new Int8Array(size * size).fill(0),
        visited: new Int8Array(size * size).fill(0)
    };

    const primaryLvl = ((lvl - 1) % 6) + 1;
    const primaryStyles = state.wallStyles ? state.wallStyles.filter(s => s.level === primaryLvl) : [];
    const bgStyle = primaryStyles[0] || { baseIdx: 0, count: 8 };

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            state.map.data[y * size + x] = bgStyle.baseIdx + ((x + y) % bgStyle.count) + 1;
        }
    }

    state.enemies = [];
    state.npcs = [];
    state.items = [];
    state.decals = [];
    state.hitMarkers = [];
    state.secretWalls = [];
    state.gates = [];
    state.totemGuardians = [];
    state.killRoom = { active: false, roomIndex: -1, wave: 0, maxWaves: 3, enemiesRemaining: 0, sealedWalls: [], rewards: { coins: 0, health: 0 } };

    state.fogStart = ZONE_THEMES[0].fogStart;
    state.fogEnd = ZONE_THEMES[0].fogEnd;

    const rooms = [];

    for (let i = 0; i < numRooms * 3; i++) {
        if (rooms.length >= numRooms) break;

        const w = 5 + Math.floor(Math.random() * 8);
        const h = 5 + Math.floor(Math.random() * 8);
        const x = 1 + Math.floor(Math.random() * (size - w - 2));
        const y = 1 + Math.floor(Math.random() * (size - h - 2));

        let overlap = false;
        for (let r of rooms) {
            if (x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y) {
                overlap = true; break;
            }
        }

        if (!overlap) {
            const room = generateRoom(x, y, w, h, lvl);
            rooms.push(room);

            const zone = assignZone(rooms.length - 1, numRooms);
            room.zone = zone;
            const roomFloor = zone.floors[Math.floor(Math.random() * zone.floors.length)];
            const roomCeil = zone.ceils[Math.floor(Math.random() * zone.ceils.length)];

            // Select wall style for the room
            let roomStyle = null;
            if (lvl >= 4 && Math.random() < 0.35) {
                // Mix in styles of previous levels
                const maxPrevLvl = Math.min(lvl - 1, 6);
                const prevStyles = state.wallStyles ? state.wallStyles.filter(s => s.level >= 1 && s.level <= maxPrevLvl) : [];
                if (prevStyles.length > 0) {
                    roomStyle = prevStyles[Math.floor(Math.random() * prevStyles.length)];
                }
            }
            if (!roomStyle) {
                // Default style for the current level
                roomStyle = primaryStyles[Math.floor(Math.random() * primaryStyles.length)] || { baseIdx: 0, count: 8 };
            }
            room.wallStyle = roomStyle;

            const landmarkIndex = Math.floor(numRooms / 4);
            if (rooms.length === landmarkIndex || rooms.length === landmarkIndex * 2 || rooms.length === landmarkIndex * 3) {
                room.hasLandmark = true;
            }

            const isLargeRoom = room.w >= 8 && room.h >= 8;
            const cx = room.x + room.w / 2;
            const cy = room.y + room.h / 2;

            for (const tile of room.tiles) {
                const idx = tile.y * size + tile.x;
                if (tile.x > 0 && tile.x < size - 1 && tile.y > 0 && tile.y < size - 1) {
                    state.map.data[idx] = 0;
                    
                    let floorTex = roomFloor;
                    if (isLargeRoom) {
                        const distFromCenter = Math.max(Math.abs(tile.x - cx), Math.abs(tile.y - cy));
                        if (distFromCenter <= Math.min(room.w, room.h) / 4) {
                            floorTex = zone.floors[Math.min(zone.floors.length - 1, 1)];
                        }
                    }
                    state.map.floorData[idx] = floorTex;
                    state.map.ceilData[idx] = roomCeil;
                }
            }

            for (const tile of room.tiles) {
                for (let dy = -1; dy <= 1; dy++) {
                    for (let dx = -1; dx <= 1; dx++) {
                        const nx = tile.x + dx;
                        const ny = tile.y + dy;
                        if (nx > 0 && nx < size - 1 && ny > 0 && ny < size - 1) {
                            if (state.map.data[ny * size + nx] > 0) {
                                state.map.data[ny * size + nx] = roomStyle.baseIdx + ((nx + ny) % roomStyle.count) + 1;
                            }
                        }
                    }
                }
            }

            addPillars(room, state.map.data, size, roomStyle);
        }
    }

    let arenaRoom = null;
    if (lvl >= 2) {
        for (let i = 1; i < rooms.length; i++) {
            const r = rooms[i];
            if (r.w >= 9 && r.h >= 9) {
                r.isArenaRoom = true;
                arenaRoom = r;
                break;
            }
        }
    }

    trySpawnTreasureVault(rooms, state.map.data, size, lvl);

    state.player.x = rooms[0].x + rooms[0].w / 2;
    state.player.y = rooms[0].y + rooms[0].h / 2;

    let branches = null;
    if (lvl >= 3) {
        connectRoomsHubAndSpoke(rooms, state.map.data, size, lvl);
        branches = state.branches;
    } else {
        connectRoomsMST(rooms, state.map.data, size);
    }

    addAlcoves(state.map.data, size, rooms);

    const standardSecrets = placeSecretWalls(state.map.data, size, rooms);
    state.secretWalls = state.secretWalls.concat(standardSecrets);

    standardSecrets.forEach(sw => {
        state.items.push({
            x: sw.behindX + 0.5,
            y: sw.behindY + 0.5,
            type: Math.random() < 0.5 ? 'addLife' : (Math.random() < 0.5 ? 'ammoCannon' : 'ammoShotgun')
        });
    });

    rooms.forEach(r => {
        if (r.hasLandmark && !r.isArenaRoom && !r.isTreasureVault) {
            const cx = r.x + r.w / 2;
            const cy = r.y + r.h / 2;
            if (state.map.data[Math.floor(cy) * size + Math.floor(cx)] === 0) {
                state.items.push({
                    x: cx,
                    y: cy,
                    type: Math.random() < 0.5 ? 'statue' : 'altar'
                });
            }
        }
    });

    if (arenaRoom) {
        const cx = Math.floor(arenaRoom.x + arenaRoom.w / 2);
        const cy = Math.floor(arenaRoom.y + arenaRoom.h / 2);
        state.map.data[cy * size + cx] = 11;
        state.map.data[cy * size + cx + 1] = 11;
        state.map.data[(cy + 1) * size + cx] = 11;
        state.map.data[(cy + 1) * size + cx + 1] = 11;

        state.items.push({
            x: cx + 0.5,
            y: cy - 0.5,
            type: 'arenaTrigger',
            roomIdx: rooms.indexOf(arenaRoom),
            activated: false
        });
        console.log(`Arena trigger placed in room ${rooms.indexOf(arenaRoom)} at ${cx + 0.5}, ${cy - 0.5}`);
    }

    state.npcs.push({
        x: rooms[0].x + rooms[0].w / 2 + 2,
        y: rooms[0].y + rooms[0].h / 2 + 2,
        type: 'gunMan',
        vx: 0, vy: 0,
        state: 'IDLE',
        frame: 0,
        animTimer: 0
    });

    const spawnItem = (type, count) => {
        for (let i = 0; i < count; i++) {
            const r = rooms[Math.floor(Math.random() * rooms.length)];
            if (r.isTreasureVault) continue;
            state.items.push({
                x: r.x + 1 + Math.random() * (r.w - 2),
                y: r.y + 1 + Math.random() * (r.h - 2),
                type: type
            });
        }
    };

    spawnItem('ammoShotgun', 10);
    spawnItem('ammoMachinegun', 8);
    spawnItem('ammoCannon', 5);
    spawnItem('addLife', 5);

    // Goal totem empty placed in a random room (excluding Room 0, treasure vaults, and arena rooms)
    const eligibleExitRooms = rooms.filter((r, idx) => idx > 0 && !r.isTreasureVault && !r.isArenaRoom);
    const exitRoom = eligibleExitRooms.length > 0 
        ? eligibleExitRooms[Math.floor(Math.random() * eligibleExitRooms.length)] 
        : (rooms[rooms.length - 1] || rooms[0]);
    
    state.items.push({
        x: exitRoom.x + exitRoom.w / 2,
        y: exitRoom.y + exitRoom.h / 2,
        type: 'totemEmpty',
        isGoal: true
    });
    console.log(`Exit portal (goal) placed in room ${rooms.indexOf(exitRoom)} at ${exitRoom.x + exitRoom.w / 2}, ${exitRoom.y + exitRoom.h / 2}`);

    for (let i = 0; i < 3; i++) {
        state.items.push({ x: state.player.x + (Math.random() * 2 - 1), y: state.player.y + 3.0 + (Math.random() * 2 - 1), type: 'ammoShotgun' });
        state.items.push({ x: state.player.x + (Math.random() * 2 - 1), y: state.player.y + 3.0 + (Math.random() * 2 - 1), type: 'ammoMachinegun' });
        state.items.push({ x: state.player.x + (Math.random() * 2 - 1), y: state.player.y + 3.0 + (Math.random() * 2 - 1), type: 'ammoCannon' });
    }

    // heavymachinegunPickup random room spawning removed to make it exclusive to Level 3+ secret vaults.

    // Spawn environment decorations in rooms (barrel, lamp, chair, chair2, hanger)
    rooms.forEach(r => {
        if (r.isTreasureVault || r.isArenaRoom) return;
        const numDecorations = 1 + Math.floor(Math.random() * 3); // 1 to 3 items
        for (let i = 0; i < numDecorations; i++) {
            const dx = r.x + 1 + Math.random() * (r.w - 2);
            const dy = r.y + 1 + Math.random() * (r.h - 2);
            
            // Avoid spawning on top of the player
            const distToPlayer = Math.hypot(dx - state.player.x, dy - state.player.y);
            if (distToPlayer < 2.0) continue;

            const decorTypes = ['barrel', 'lamp', 'chair', 'chair2', 'hanger'];
            const type = decorTypes[Math.floor(Math.random() * decorTypes.length)];
            
            // Check for overlap with other items
            const overlap = state.items.some(item => Math.hypot(item.x - dx, item.y - dy) < 0.8);
            if (!overlap) {
                state.items.push({ x: dx, y: dy, type: type });
            }
        }
    });

    const colors = ['totemRed', 'totemGreen', 'totemBlue'];
    const placedTotems = [];
    const minTotemDist = 20;

    let totemRooms = [...rooms].filter((r, i) => i > 0);

    colors.forEach((color, ci) => {
        let placed = false;
        let attempts = 0;

        let targetRooms = totemRooms;
        if (lvl >= 3 && branches && branches[ci] && branches[ci].length > 0) {
            targetRooms = branches[ci];
        }

        let bestRoom = null;
        let maxDist = 0;
        targetRooms.forEach(r => {
            if (r.isArenaRoom || r.isTreasureVault) return;
            const rx = r.x + r.w / 2;
            const ry = r.y + r.h / 2;
            const dist = Math.hypot(rx - state.player.x, ry - state.player.y);
            if (dist > maxDist) {
                let tooClose = false;
                for (const p of placedTotems) {
                    if (Math.hypot(rx - p.x, ry - p.y) < minTotemDist) {
                        tooClose = true; break;
                    }
                }
                if (!tooClose) {
                    maxDist = dist;
                    bestRoom = r;
                }
            }
        });

        const r = bestRoom || targetRooms[Math.floor(Math.random() * targetRooms.length)];
        const tx = r.x + Math.floor(r.w / 2);
        const ty = r.y + Math.floor(r.h / 2);

        state.items.push({ x: tx, y: ty, type: color });
        placedTotems.push({ x: tx, y: ty });
        placed = true;
        console.log(`Placed ${color} at ${tx.toFixed(1)}, ${ty.toFixed(1)}`);

        const guardianCount = 1 + Math.floor(lvl / 2);
        const guardianEnemies = [];
        for (let g = 0; g < guardianCount; g++) {
            const guardAngle = (g / guardianCount) * Math.PI * 2;
            const guardDist = 2.0;
            const enemy = {
                id: Math.random(),
                x: tx + Math.cos(guardAngle) * guardDist,
                y: ty + Math.sin(guardAngle) * guardDist,
                type: lvl >= 3 ? 'brain' : 'monster',
                hp: (lvl >= 3 ? 120 : 80) + lvl * 8,
                vx: 0, vy: 0,
                state: 'IDLE',
                frame: 0,
                animTimer: 0,
                isGuardian: true,
                speedScale: 1.0
            };
            state.enemies.push(enemy);
            guardianEnemies.push(enemy);
        }

        state.totemGuardians.push({
            totemIndex: state.items.length - 1,
            enemies: guardianEnemies,
            activated: false
        });
    });

    const killRoomIndices = selectKillRooms(rooms, lvl);
    state.killRoomCandidates = killRoomIndices.map(idx => {
        const r = rooms[idx];
        const cx = r.x + r.w / 2;
        const cy = r.y + r.h / 2;

        state.items.push({
            x: cx,
            y: cy,
            type: 'killRoomIndicator',
            killRoomIdx: idx,
            activated: false,
            completed: false
        });

        return {
            roomIdx: idx,
            x: r.x, y: r.y, w: r.w, h: r.h,
            tiles: r.tiles,
            activated: false,
            completed: false
        };
    });

    const cappedLevel = Math.min(lvl, 10);
    const speedScale = 1.0 + Math.min(lvl * CONFIG.enemySpeedScalePerLevel, CONFIG.enemySpeedScaleCap);

    const spawnRooms = rooms.filter((r, i) => {
        if (i === 0) return false;
        if (r.isKillRoom) return false;
        if (r.isTreasureVault) return false;
        return true;
    });

    if (spawnRooms.length > 0) {
        spawnRooms.forEach(r => {
            const rx = r.x + r.w / 2;
            const ry = r.y + r.h / 2;
            const distToSpawn = Math.hypot(rx - state.player.x, ry - state.player.y);
            if (distToSpawn < 10.0) {
                return;
            }

            let roomBudget = Math.round((r.w * r.h) / 12 * Math.sqrt(cappedLevel));
            if (r.isArenaRoom) roomBudget = 0;

            while (roomBudget >= 1.0) {
                let chosenType = 'soldier';
                let cost = 1.0;
                let hpBase = 30;

                if (lvl >= 3 && roomBudget >= 4.0 && Math.random() < 0.25) {
                    chosenType = 'brain'; cost = 4.0; hpBase = 100;
                } else if (lvl >= 3 && roomBudget >= 3.0 && Math.random() < 0.3) {
                    chosenType = 'geco'; cost = 3.0; hpBase = 40;
                } else if (lvl >= 2 && roomBudget >= 2.0 && Math.random() < 0.4) {
                    chosenType = 'soldierB'; cost = 2.0; hpBase = 30;
                } else if (lvl >= 2 && roomBudget >= 2.0 && Math.random() < 0.4) {
                    chosenType = 'monsterB2'; cost = 2.0; hpBase = 50;
                } else if (roomBudget >= 1.5 && Math.random() < 0.5) {
                    chosenType = 'monster'; cost = 1.5; hpBase = 50;
                }

                const isGecoHiding = (chosenType === 'geco' && Math.random() < 0.20);
                state.enemies.push({
                    id: Math.random(),
                    x: r.x + 1 + Math.random() * (r.w - 2),
                    y: r.y + 1 + Math.random() * (r.h - 2),
                    type: chosenType,
                    hp: hpBase + lvl * 5,
                    vx: 0, vy: 0,
                    state: isGecoHiding ? 'HIDING' : 'IDLE',
                    isClimbing: isGecoHiding,
                    frame: 0,
                    animTimer: 0,
                    speedScale: speedScale
                });

                roomBudget -= cost;
            }
        });
    }

    // --- AMBUSH CORRIDORS ---
    let ambushesSpawned = 0;
    let attempts = 0;
    while (ambushesSpawned < 5 && attempts < 100) {
        attempts++;
        const cx = 2 + Math.floor(Math.random() * (size - 4));
        const cy = 2 + Math.floor(Math.random() * (size - 4));
        const idx = cy * size + cx;
        
        if (state.map.data[idx] === 0) {
            let inRoom = false;
            for (const r of rooms) {
                if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) {
                    inRoom = true;
                    break;
                }
            }
            
            if (!inRoom) {
                const wallLeft = state.map.data[cy * size + (cx - 1)] > 0;
                const wallRight = state.map.data[cy * size + (cx + 1)] > 0;
                const wallTop = state.map.data[(cy - 1) * size + cx] > 0;
                const wallBottom = state.map.data[(cy + 1) * size + cx] > 0;
                
                if ((wallLeft && wallRight) || (wallTop && wallBottom)) {
                    state.enemies.push({
                        id: Math.random(),
                        x: cx + 0.5,
                        y: cy + 0.5,
                        type: lvl >= 3 ? 'soldierB' : 'soldier',
                        hp: 30 + lvl * 5,
                        vx: 0, vy: 0,
                        state: 'IDLE',
                        frame: 0,
                        animTimer: 0,
                        speedScale: speedScale,
                        isAmbush: true
                    });
                    ambushesSpawned++;
                }
            }
        }
    }

    // --- CORRIDOR LAMPS ---
    let corridorTileCounter = 0;
    for (let cy = 1; cy < size - 1; cy++) {
        for (let cx = 1; cx < size - 1; cx++) {
            const idx = cy * size + cx;
            if (state.map.data[idx] === 0) {
                let inRoom = false;
                for (const r of rooms) {
                    if (cx >= r.x && cx < r.x + r.w && cy >= r.y && cy < r.y + r.h) {
                        inRoom = true;
                        break;
                    }
                }
                if (!inRoom) {
                    corridorTileCounter++;
                    if (corridorTileCounter >= 6) {
                        corridorTileCounter = 0;
                        if (Math.random() < 0.25) {
                            const lampType = Math.random() < 0.5 ? 'lamp2' : 'lamp3';
                            const overlap = state.items.some(item => Math.hypot(item.x - (cx + 0.5), item.y - (cy + 0.5)) < 0.8);
                            if (!overlap) {
                                state.items.push({ x: cx + 0.5, y: cy + 0.5, type: lampType });
                            }
                        }
                    }
                }
            }
        }
    }

    state.sprites.arenaTrigger = state.sprites.arenaTriggerOff;
    state.sprites.statue = state.sprites.barrel;
    state.sprites.altar = state.sprites.lamp;
    state.sprites.treasureChest = state.sprites.shopAutoShotgun;

    state.rooms = rooms;
    document.getElementById('level-display').innerText = lvl;
}
