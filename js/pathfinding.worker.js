/**
 * Pathfinding Web Worker
 * Runs BFS pathfinding on a background thread.
 */

let mapWidth = 0;
let mapHeight = 0;
let mapData = null;

self.onmessage = function(e) {
    const msg = e.data;
    if (msg.type === 'init') {
        mapWidth = msg.width;
        mapHeight = msg.height;
        mapData = msg.data;
    } else if (msg.type === 'findPath') {
        if (!mapData) {
            self.postMessage({ enemyId: msg.enemyId, path: [] });
            return;
        }
        const path = findPath(msg.startX, msg.startY, msg.endX, msg.endY);
        self.postMessage({ enemyId: msg.enemyId, path: path });
    }
};

function findPath(startX, startY, endX, endY) {
    const mapW = mapWidth;
    const mapH = mapHeight;

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
                if (!visited[idx] && mapData[idx] === 0) {
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
