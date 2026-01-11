
// js/data/game_data.js
(function() {
    window.TacticalShooter = window.TacticalShooter || {};
    
    // Initialize Registry Containers
    const GameData = {
        Weapons: {},     // Populated by individual weapon files
        Attachments: {}, // Populated by attachment files
        Gamemodes: {
            "TDM": {
                name: "Team Deathmatch",
                scoreLimit: 50,
                timeLimit: 600
            }
        }
    };

    window.TacticalShooter.GameData = GameData;
    console.log('GameData: Registry Initialized. Waiting for modules...');
})();
