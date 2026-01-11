
// js/data/weapons/pistol/pistol_animations.js
(function() {
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.GameData = window.TacticalShooter.GameData || {};
    window.TacticalShooter.GameData.Animations = window.TacticalShooter.GameData.Animations || {};

    // Animation ID Constants
    const ANIM_ID = {
        NONE: 0,
        PISTOL_RELOAD: 101,
        PISTOL_EQUIP: 102
    };

    window.TacticalShooter.GameData.Animations.PISTOL = {
        [ANIM_ID.PISTOL_RELOAD]: {
            id: ANIM_ID.PISTOL_RELOAD,
            duration: 1.75, // Requested 1.75s
            
            // Keyframes spaced for 1.75s flow
            keyframes: [
                {
                    time: 0.0,
                    rightArm: { x: 1.57, y: 0, z: 0 }, 
                    leftArm:  { x: 1.57, y: 1.5, z: 0.5 }, 
                    slidePos: 0
                },
                {
                    time: 0.15, // Lift
                    rightArm: { x: 1.4, y: 0, z: 0 }, 
                    leftArm:  { x: 1.0, y: 0.2, z: 0.0 },
                    slidePos: 0
                },
                {
                    time: 0.35, // Grab Mag
                    rightArm: { x: 1.3, y: 0, z: -0.1 }, 
                    leftArm:  { x: 0.0, y: 0.5, z: 0.0 }, 
                    slidePos: 0.04 
                },
                {
                    time: 0.8, // Insert (Pause here to emphasize action)
                    rightArm: { x: 1.35, y: 0, z: -0.1 }, 
                    leftArm:  { x: 1.57, y: 1.5, z: 0.5 }, 
                    slidePos: 0.04
                },
                {
                    time: 1.1, // Rack Start
                    rightArm: { x: 1.35, y: 0, z: -0.1 }, 
                    leftArm:  { x: 1.57, y: 1.5, z: 0.1 }, 
                    slidePos: 0.04
                },
                {
                    time: 1.3, // Rack Release
                    rightArm: { x: 1.4, y: 0, z: 0 }, 
                    leftArm:  { x: 1.57, y: 1.5, z: 0.5 }, 
                    slidePos: 0 
                },
                {
                    time: 1.75, // Return to Idle
                    rightArm: { x: 1.57, y: 0, z: 0 }, 
                    leftArm:  { x: 1.57, y: 1.5, z: 0.5 }, 
                    slidePos: 0
                }
            ]
        }
    };

    // Expose IDs globally for easier access
    window.TacticalShooter.AnimIDs = ANIM_ID;
    
})();
