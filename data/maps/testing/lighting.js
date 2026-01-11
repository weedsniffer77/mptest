
// js/data/maps/testing/lighting.js
window.TESTING_LIGHTING = {
    id: "TESTING_LIGHTING",
    name: "Bright Day",
    mapId: "TESTING",
    
    // Sun
    sun: {
        type: "directional",
        position: { x: 50, y: 80, z: 40 },
        color: "#fff8e0", // Warm sunlight
        intensity: 4.0, 
        
        visual: {
            distance: 400,
            coreSize: 200, // Reduced by 50% (was 400)
            coreColor: "#ffffff",
            glowSize: 300, // Reduced by 50% (was 600)
            glowColor: "#ffddaa"
        }
    },
    
    // Atmosphere
    atmosphere: {
        zenithColor: "#2a70d0",      
        horizonColor: "#b0d0e0",     
        groundColor: "#808080"       
    },
    
    // Ambient
    ambient: {
        color: "#aaccff", 
        intensity: 2.0 
    },
    
    // Hemisphere
    hemisphere: {
        skyColor: "#ddeeff",
        groundColor: "#404040",
        intensity: 1.0
    },
    
    // Fog
    fog: {
        enabled: true,
        color: "#c0d0e0", 
        density: 0.003
    },
    
    // Post-processing
    postProcessing: {
        bloom: {
            strength: 0.8,
            radius: 0.4, 
            threshold: 2.0 // Increased from 0.9 to prevent white surfaces from glowing
        }
    }
};

console.log('Testing lighting config loaded');
