/**
 * particles.js - Blood & impact particle helper
 * Uses state.particles[] directly to avoid circular imports.
 */
import { state } from './state.js';
import { CONFIG } from './config.js';

export function spawnBloodParticles(worldX, worldY, dirAngle) {
    if (!state.particles) state.particles = [];
    const count = (CONFIG.bloodParticleCount !== undefined) ? CONFIG.bloodParticleCount : 5;
    for (let i = 0; i < count; i++) {
        const angle = dirAngle + (Math.random() - 0.5) * 1.4;
        const spd = (CONFIG.bloodParticleSpeed || 4.0) * (0.4 + Math.random() * 0.8);
        state.particles.push({
            wX: worldX,
            wY: worldY,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2.0,
            life: (CONFIG.bloodParticleLife || 0.35) * (0.5 + Math.random() * 0.8),
            maxLife: CONFIG.bloodParticleLife || 0.35,
            size: 2 + Math.random() * 3
        });
    }
}
