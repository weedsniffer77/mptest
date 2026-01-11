// js/visual/vfx_config.js
window.VFX_CONFIG = {
    impactSparks: {
        particleCount: 12,
        lifetime: 0.4,
        speed: 5.0,
        speedVariance: 2.0,
        gravity: -12.0,
        color: 0xffeebb, // Bright Yellow Hex
        size: 0.1,
        sizeDecay: 0.92
    },
    
    muzzleFlash: {
        lifetime: 0.05,
        color: 0xffcc66,
        intensity: 2.0,
        size: 0.3
    }
};

console.log('VFX config loaded');