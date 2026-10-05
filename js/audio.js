import { state } from './state.js';

export class AudioManager {
    constructor() {
        this.sounds = {};
        this.activeSources = {}; // Track active sound sources

        // Limits
        this.maxEnemySounds = 5;
        this.currentEnemySounds = 0;

        // Volume settings (0.0 to 1.0)
        this.musicVolume = 0.5;
        this.sfxVolume = 1.0;

        // Audio Context (initialized on first interaction)
        this.ctx = null;

        // Gain Nodes
        this.sfxNode = null;
        this.enemyNode = null;
        this.priorityNode = null; // Stays at full volume (Laser)
        this.musicNode = null;

        this.isLaserActive = false;

        this.currentMusic = null;
        this.lastFrameTime = 0;
        this.soundsPlayedThisFrame = 0;
    }

    init() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();

            // Create Hierarchy
            this.sfxNode = this.ctx.createGain();
            this.enemyNode = this.ctx.createGain();
            this.priorityNode = this.ctx.createGain();
            this.musicNode = this.ctx.createGain();

            // Connect to destination
            this.sfxNode.connect(this.ctx.destination);
            this.enemyNode.connect(this.ctx.destination);
            this.priorityNode.connect(this.ctx.destination);
            this.musicNode.connect(this.ctx.destination);

            // Apply initial volumes
            this.updateVolumes();
        }
    }

    updateVolumes() {
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const rampTime = 0.1;

        // Music
        this.musicNode.gain.setTargetAtTime(this.musicVolume, now, rampTime);

        if (this.isLaserActive) {
            // Laser Active State:
            // Enemies Silent
            this.enemyNode.gain.setTargetAtTime(0, now, rampTime);
            // SFX Ducked
            this.sfxNode.gain.setTargetAtTime(this.sfxVolume * 0.2, now, rampTime);
            // Priority Full
            this.priorityNode.gain.setTargetAtTime(this.sfxVolume, now, rampTime);
        } else {
            // Normal State
            this.enemyNode.gain.setTargetAtTime(this.sfxVolume, now, rampTime);
            this.sfxNode.gain.setTargetAtTime(this.sfxVolume, now, rampTime);
            this.priorityNode.gain.setTargetAtTime(this.sfxVolume, now, rampTime);
        }
    }

    setLaserActive(active) {
        if (this.isLaserActive === active) return;
        this.isLaserActive = active;
        this.updateVolumes();
    }

    load(key, src) {
        return fetch(src)
            .then(response => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => {
                if (!this.ctx) this.init();
                return this.ctx.decodeAudioData(arrayBuffer);
            })
            .then(audioBuffer => {
                this.sounds[key] = audioBuffer;
                console.log(`Audio loaded: ${key}`);
            })
            .catch(e => console.error(`Error loading audio ${src}:`, e));
    }

    stop(key) {
        if (this.activeSources[key]) {
            try {
                this.activeSources[key].stop();
            } catch (e) {
                // Ignore if already stopped
            }
            delete this.activeSources[key];
        }
    }

    play(key, loop = false, volume = 1.0) {
        if (!this.ctx) {
            // Try init if not seemingly active? No, usually distinct start.
            // console.warn('AudioContext not init'); 
            return;
        }
        if (!this.sounds[key]) { console.warn(`Sound not found: ${key}`); return; }
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Identify Type
        const isEnemy = key.startsWith('monster') || key.startsWith('zombie') || key.startsWith('brain') || key.startsWith('geco') || key.startsWith('soldier');
        const isLaser = key.includes('laser');

        // Logic Check
        if (isEnemy) {
            if (this.isLaserActive) return; // Don't play enemy sounds if laser is active
            if (this.currentEnemySounds >= this.maxEnemySounds) return; // Limit concurrent
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.sounds[key];
        source.loop = loop;

        const gainNode = this.ctx.createGain();
        // Individual volume adjustment (relative to category volume)
        gainNode.gain.value = volume;

        source.connect(gainNode);

        // Routing
        if (isEnemy) {
            gainNode.connect(this.enemyNode);
            this.currentEnemySounds++;
        } else if (isLaser) {
            gainNode.connect(this.priorityNode);
        } else {
            gainNode.connect(this.sfxNode);
        }

        source.start(0);

        // Tracking
        this.activeSources[key] = source;

        source.onended = () => {
            if (this.activeSources[key] === source) {
                delete this.activeSources[key];
            }
            if (isEnemy) {
                this.currentEnemySounds--;
                if (this.currentEnemySounds < 0) this.currentEnemySounds = 0;
            }
        };

        return { source, gainNode };
    }

    playMusic(key, onEndedCallback) {
        if (!this.ctx || !this.sounds[key]) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        // Stop previous music (fade out could be nice but simple stop for now)
        if (this.currentMusic && this.currentMusic.source) {
            try { this.currentMusic.source.stop(); } catch (e) { }
            this.currentMusic.source.onended = null; // Clear previous callback to avoid double triggers
        }

        const source = this.ctx.createBufferSource();
        source.buffer = this.sounds[key];
        source.loop = false; // playlist logic handles looping manually

        // No individual gain needed for music track typically, but can add one
        const gainNode = this.ctx.createGain();
        gainNode.gain.value = 1.0;

        source.connect(gainNode);
        gainNode.connect(this.musicNode); // Route to music node only

        source.start(0);

        if (onEndedCallback) {
            source.onended = onEndedCallback;
        }

        this.currentMusic = { source, gainNode, key };
    }

    setMusicVolume(vol) {
        this.musicVolume = Math.max(0, Math.min(1, vol));
        this.updateVolumes();
    }

    setSfxVolume(vol) {
        this.sfxVolume = Math.max(0, Math.min(1, vol));
        this.updateVolumes();
    }

    // Play sound with volume based on distance
    play3D(key, sourceX, sourceY, listenerX, listenerY, maxDist = 20, baseVolume = 1.0) {
        if (!this.ctx || !this.sounds[key]) return;

        const dx = sourceX - listenerX;
        const dy = sourceY - listenerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) return; // Too far to hear

        // Throttle check: max 4 sounds per frame
        const now = performance.now();
        if (now - this.lastFrameTime < 16) {
            if (this.soundsPlayedThisFrame >= 4) {
                return;
            }
            this.soundsPlayedThisFrame++;
        } else {
            this.lastFrameTime = now;
            this.soundsPlayedThisFrame = 1;
        }

        // Inverse Square Law approximation
        // Volume = 1 / (1 + distance^2)
        // Adjusted to be audible at reasonable ranges (reduced falloff factor from 0.1 to 0.05)
        let volume = (1 / (1 + (dist * dist) * 0.05)) * baseVolume;

        // Clamp volume (allow up to baseVolume or slightly higher, but prevent negatives)
        volume = Math.max(0, volume);

        this.play(key, false, volume);
    }

    playHeadshotDing() {
        if (!this.ctx) this.init();
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(1000, this.ctx.currentTime); // Crisp ding pitch
            osc.frequency.exponentialRampToValueAtTime(700, this.ctx.currentTime + 0.15);

            gain.gain.setValueAtTime(this.sfxVolume * 0.5, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

            osc.connect(gain);
            if (this.sfxNode) {
                gain.connect(this.sfxNode);
            } else {
                gain.connect(this.ctx.destination);
            }

            osc.start();
            osc.stop(this.ctx.currentTime + 0.15);
        } catch (err) {
            console.error("Error playing synthesized headshot ding:", err);
        }
    }
}

export const audioManager = new AudioManager();
