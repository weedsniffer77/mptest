
// js/data/weapons/pistol/pistol_attributes.js
(function() {
    // Ensure Registry Exists
    window.TacticalShooter = window.TacticalShooter || {};
    window.TacticalShooter.GameData = window.TacticalShooter.GameData || { Weapons: {} };

    window.TacticalShooter.GameData.Weapons["PISTOL"] = {
        id: "PISTOL",
        name: "Tactical Pistol",
        type: "secondary",
        
        // Firing Mode
        automatic: false, // Semi-auto

        // Ammo
        magazineSize: 15, 
        reserveAmmo: 30,
        
        // Timing
        fireRate: 0.1, // 600 RPM
        reloadTime: 1.8, // 1.75s animation + small buffer
        
        // Ballistics
        damage: 20, // REDUCED FROM 35 to 20
        range: 100,
        bulletSpeed: 300,
        penetration: 0, // 0 = Stops on first hit
        
        // Accuracy (Radians)
        hipfireSpread: 0.03,
        adsSpread: 0.002, 
        sprintSpread: 0.15, 
        
        // Mobility
        sprintMultiplier: 1.2, 
        
        // Recoil
        recoilPitch: 0.015,
        recoilYaw: 0.008,
        recoilRecovery: 8.0,
        
        // Physics
        ragdollImpulse: 3.5, // Reduced to 3.5 for softer, more realistic impacts

        // Future Attachment Slots
        allowedAttachments: ["silencer", "extended_mag", "red_dot"],

        // EFFECTS CONFIGURATION
        effects: {
            shell: {
                color: 0xd4af37, // Brass
                scale: 1.0,
                velocityRand: 1.0
            },
            muzzle: {
                color: 0xffaa33,
                scale: 0.5,
                intensity: 2.0, // High bloom
                duration: 0.05
            },
            impact: {
                color: 0xffeebb, // Bright Yellow/White
                particleCount: 8,
                duration: 0.3,
                size: 0.08,
                gravity: -15.0
            }
        },

        // Visual Config (Animation Data)
        visuals: {
            hipPosition: { x: 0.18, y: -0.18, z: -0.4 },
            adsPosition: { x: 0, y: -0.0405, z: -0.55 }, 
            sprintPosition: { x: 0.2, y: -0.22, z: -0.3 },
            sprintRotation: { x: -0.5, y: 0.3, z: 0.1 }, 
            
            blockedPosition: { x: 0.05, y: -0.15, z: -0.2 },
            blockedRotation: { x: 0.8, y: -0.2, z: -0.1 }, 
            
            // --- Hand Attachment Offsets ---
            leftHandOffset: { x: 0, y: 0, z: 0 }, 
            leftHandRotation: { x: 0, y: 0, z: 0 },
            
            swayAmount: 0.02,
            swaySpeed: 2.0,
            
            walkBobAmount: 0.03, 
            walkBobSpeed: 8.0,
            
            sprintBobAmount: 0.025, 
            sprintBobSpeed: 13.0, 
            
            adsInSpeed: 18.0, 
            adsOutSpeed: 8.0, 
            sprintTransitionSpeed: 5.0,
            
            // Legacy fallbacks
            muzzleFlashIntensity: 1.0, 
            muzzleFlashScale: 0.5,
            muzzleFlashDuration: 0.05
        }
    };
    console.log('Weapon Loaded: PISTOL (Attributes)');
})();
