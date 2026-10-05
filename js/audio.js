import { state } from './state.js';
import { ASSETS } from './config.js';

function decodeWav(arrayBuffer, audioCtx) {
    if (!audioCtx || typeof audioCtx.createBuffer !== 'function') return null;
    try {
        const view = new DataView(arrayBuffer);
        if (view.byteLength < 44) return null;
        if (view.getUint32(0, false) !== 0x52494646 || view.getUint32(8, false) !== 0x57415645) {
            return null; // Not RIFF WAVE
        }
        let offset = 12;
        let format = 0, channels = 0, sampleRate = 0, bitsPerSample = 0;
        let dataOffset = 0, dataLength = 0;
        while (offset < view.byteLength - 8) {
            const chunkId = view.getUint32(offset, false);
            const chunkSize = view.getUint32(offset + 4, true);
            if (chunkId === 0x666d7420) { // 'fmt '
                format = view.getUint16(offset + 8, true);
                channels = view.getUint16(offset + 10, true);
                sampleRate = view.getUint32(offset + 12, true);
                bitsPerSample = view.getUint16(offset + 22, true);
            } else if (chunkId === 0x64617461) { // 'data'
                dataOffset = offset + 8;
                dataLength = chunkSize;
                break;
            }
            offset += 8 + chunkSize;
        }

        if (format === 1 && channels > 0 && sampleRate > 0 && dataOffset > 0 && dataLength > 0) {
            const bytesPerSample = bitsPerSample / 8;
            if (bytesPerSample < 1) return null;
            const numFrames = Math.floor(Math.min(dataLength, view.byteLength - dataOffset) / (channels * bytesPerSample));
            if (numFrames <= 0) return null;

            const buffer = audioCtx.createBuffer(channels, numFrames, sampleRate);
            if (bitsPerSample === 16) {
                for (let c = 0; c < channels; c++) {
                    const channelData = buffer.getChannelData(c);
                    let bytePos = dataOffset + c * 2;
                    const step = channels * 2;
                    for (let i = 0; i < numFrames; i++) {
                        channelData[i] = view.getInt16(bytePos, true) / 32768.0;
                        bytePos += step;
                    }
                }
                return buffer;
            } else if (bitsPerSample === 24) {
                for (let c = 0; c < channels; c++) {
                    const channelData = buffer.getChannelData(c);
                    let bytePos = dataOffset + c * 3;
                    const step = channels * 3;
                    for (let i = 0; i < numFrames; i++) {
                        const b0 = view.getUint8(bytePos);
                        const b1 = view.getUint8(bytePos + 1);
                        const b2 = view.getInt8(bytePos + 2);
                        channelData[i] = (b0 | (b1 << 8) | (b2 << 16)) / 8388608.0;
                        bytePos += step;
                    }
                }
                return buffer;
            } else if (bitsPerSample === 8) {
                for (let c = 0; c < channels; c++) {
                    const channelData = buffer.getChannelData(c);
                    let bytePos = dataOffset + c;
                    const step = channels;
                    for (let i = 0; i < numFrames; i++) {
                        channelData[i] = (view.getUint8(bytePos) - 128) / 128.0;
                        bytePos += step;
                    }
                }
                return buffer;
            }
        }
    } catch (e) {
        console.warn('decodeWav error:', e);
    }
    return null;
}

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

        // Queue to serialize/limit concurrent audio decodes
        this.decodeQueue = [];
        this.activeDecodes = 0;
        this.maxConcurrentDecodes = 4;
    }

    init() {
        if (!this.ctx) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return;
                this.ctx = new AudioCtx();

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
            } catch (err) {
                console.warn('AudioContext creation failed or not supported in this environment:', err);
            }
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

    _createFallbackBuffer() {
        if (this.ctx && typeof this.ctx.createBuffer === 'function') {
            try {
                return this.ctx.createBuffer(1, 4410, 44100);
            } catch {}
        }
        return { duration: 0.1, numberOfChannels: 1, sampleRate: 44100 };
    }

    _processDecodeQueue() {
        while (this.activeDecodes < this.maxConcurrentDecodes && this.decodeQueue.length > 0) {
            const task = this.decodeQueue.shift();
            this.activeDecodes++;
            if (!this.ctx) this.init();
            if (!this.ctx) {
                task.resolve(this._createFallbackBuffer());
                this.activeDecodes--;
                continue;
            }
            try {
                const bufferCopy = task.arrayBuffer.slice(0);
                this.ctx.decodeAudioData(bufferCopy)
                    .then(audioBuffer => {
                        task.resolve(audioBuffer);
                    })
                    .catch(err => {
                        console.warn('decodeAudioData fallback:', err);
                        task.resolve(this._createFallbackBuffer());
                    })
                    .finally(() => {
                        this.activeDecodes--;
                        this._processDecodeQueue();
                    });
            } catch (err) {
                console.warn('decodeAudioData threw synchronously:', err);
                task.resolve(this._createFallbackBuffer());
                this.activeDecodes--;
            }
        }
    }

    _decodeAudioData(arrayBuffer) {
        if (!this.ctx) this.init();
        if (this.ctx) {
            const wavBuffer = decodeWav(arrayBuffer, this.ctx);
            if (wavBuffer) {
                return Promise.resolve(wavBuffer);
            }
        }
        return new Promise((resolve) => {
            this.decodeQueue.push({ arrayBuffer, resolve });
            this._processDecodeQueue();
        });
    }

    load(key, src) {
        if (this.sounds[key]) return Promise.resolve(this.sounds[key]);
        return fetch(src)
            .then(response => {
                if (!response.ok && response.status !== 0) throw new Error(`HTTP error! status: ${response.status}`);
                return response.arrayBuffer();
            })
            .then(arrayBuffer => this._decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                this.sounds[key] = audioBuffer;
                return audioBuffer;
            })
            .catch(e => {
                console.warn(`Error loading audio ${src}:`, e);
                const fallback = this._createFallbackBuffer();
                this.sounds[key] = fallback;
                return fallback;
            });
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
        if (!this.ctx) return;
        if (!this.sounds[key] || !this.sounds[key].duration) return;
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        try {
            // Identify Type
            const isEnemy = key.startsWith('monster') || key.startsWith('zombie') || key.startsWith('brain') || key.startsWith('geco') || key.startsWith('soldier');
            const isLaser = key.includes('laser');

            // Logic Check
            if (isEnemy) {
                if (this.isLaserActive) return; // Don't play enemy sounds if laser is active
                if (this.currentEnemySounds >= this.maxEnemySounds) return; // Limit concurrent
            }

            if (!(this.sounds[key] instanceof AudioBuffer) && typeof this.sounds[key].getChannelData !== 'function') {
                return;
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
                if (this.enemyNode) gainNode.connect(this.enemyNode);
                this.currentEnemySounds++;
            } else if (isLaser) {
                if (this.priorityNode) gainNode.connect(this.priorityNode);
            } else {
                if (this.sfxNode) gainNode.connect(this.sfxNode);
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
        } catch (e) {
            console.warn("Error playing sound:", e);
        }
    }

    playMusic(key, onEndedCallback) {
        if (!this.ctx) this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }

        if (!this.sounds[key]) {
            const match = key.match(/bg_music_(\d+)/);
            if (match && ASSETS && ASSETS.audio && ASSETS.audio.music) {
                const idx = parseInt(match[1]) - 1;
                const src = ASSETS.audio.music[idx];
                if (src) {
                    this.load(key, src).then(() => {
                        this.playMusic(key, onEndedCallback);
                    });
                    return;
                }
            }
            return;
        }

        if (!this.sounds[key] || !this.sounds[key].duration) {
            return;
        }

        try {
            // Stop previous music (fade out could be nice but simple stop for now)
            if (this.currentMusic && this.currentMusic.source) {
                try { this.currentMusic.source.stop(); } catch (e) { }
                this.currentMusic.source.onended = null; // Clear previous callback to avoid double triggers
            }

            if (!(this.sounds[key] instanceof AudioBuffer) && typeof this.sounds[key].getChannelData !== 'function') {
                return;
            }

            const source = this.ctx.createBufferSource();
            source.buffer = this.sounds[key];
            source.loop = false; // playlist logic handles looping manually

            const gainNode = this.ctx.createGain();
            gainNode.gain.value = 1.0;

            source.connect(gainNode);
            if (this.musicNode) {
                gainNode.connect(this.musicNode);
            } else {
                gainNode.connect(this.ctx.destination);
            }

            source.start(0);

            if (onEndedCallback) {
                source.onended = onEndedCallback;
            }

            this.currentMusic = { source, gainNode, key };
        } catch (e) {
            console.warn("Error playing music:", e);
        }
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
