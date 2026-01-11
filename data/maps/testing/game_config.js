// js/data/maps/testing/game_config.js
window.TESTING_GAME_CONFIG = {
    id: "TESTING_CONFIG",
    mapId: "TESTING",
    
    // Player spawn point (Short side, facing center)
    // Map is X: +/- 40, Z: +/- 25
    // Spawning near X = -35
    playerSpawn: {
        position: { x: -35, y: 0, z: 0 },
        rotation: { x: 0, y: -Math.PI / 2, z: 0 }
    },
    
    // Enemy spawn points (far end - for future use)
    enemySpawns: [
        { x: 35, y: 0, z: 0 },
        { x: 35, y: 0, z: 10 },
        { x: 35, y: 0, z: -10 }
    ],
    
    // Objectives (for future use)
    objectives: []
};

console.log('Testing game config loaded');