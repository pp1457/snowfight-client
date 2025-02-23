import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

// Helper function to check if an object is dead
function isDead(obj, scene) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);
    return obj.isDead || (obj.expireDate && obj.expireDate <= currentTime);
}

// Function to remove dead objects from the scene
export function checkAlive(scene) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);

    // Remove dead snowballs
    scene.snowballs.getChildren().forEach(snowball => {
        if (isDead(snowball, scene)) {
            snowball.destroy();
            scene.snowballs.remove(snowball);
        }
    });

    // Remove dead players
    Object.entries(scene.players).forEach(([id, player]) => {
        if (isDead(player, scene)) {
            player.container.destroy(true);
            delete scene.players[id];
        }
    });
}

// Function to update game objects based on server data
export function updateGameObject(scene, data) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);

    switch (data.objectType) {
        case "player":
            if (data.id === scene.player.id) {
                // Update local player's health
                scene.player.updateHealth(data.newHealth || 0);
                if (data.isDead) {
                    // Display "Game Over" message and redirect after 2 seconds

                    if (scene.player.snowball && scene.socket.readyState === WebSocket.OPEN) {
                        scene.socket.send(JSON.stringify({
                            type: "movement",
                            objectType: "snowball",
                            id: scene.player.snowball.id,
                            size: 0,
                            damage: 0,
                            charging: false,
                            timeEmission: Date.now() + (scene.serverTimeOffset || 0),
                            lifeLength: 0
                        }));
                    }

                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 0);
                }
                return;
            }
            // Create remote player if it doesn't exist
            if (!scene.players[data.id]) {
                scene.players[data.id] = createPlayer(
                    scene,
                    data.position?.x || 0,
                    data.position?.y || 0
                );
                scene.players[data.id].id = data.id;
            }
            const player = scene.players[data.id];
            // Smoothly interpolate position
            player.container.x = Phaser.Math.Linear(
                player.container.x,
                data.position?.x || player.container.x,
                0.2
            );
            player.container.y = Phaser.Math.Linear(
                player.container.y,
                data.position?.y || player.container.y,
                0.2
            );
            // Update velocity if physics body exists
            if (player.container.body) {
                player.container.body.setVelocity(
                    data.velocity?.x || 0,
                    data.velocity?.y || 0
                );
            }
            // Update health, dead status, and expire date
            player.updateHealth(data.newHealth || 0);
            player.isDead = data.isDead || false;
            player.expireDate = data.expireDate || null;
            break;

        case "snowball": {
            let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
            if (!snowball && !data.isDead) {
                // Create new snowball if it doesn't exist and isn't dead
                const radius = data.size || 10;
                snowball = createSnowball(
                    scene,
                    data.position?.x || 0,
                    data.position?.y || 0,
                    radius
                );
                snowball.id = data.id;
                scene.snowballs.add(snowball);
            }
            if (snowball && !isDead(snowball, scene)) {
                // Update snowball properties
                snowball.isDead = data.isDead || false;
                snowball.expireDate = data.expireDate || null;
                if (data.charging) {
                    // Interpolate position and update size for charging snowballs
                    snowball.x = Phaser.Math.Linear(
                        snowball.x,
                        data.position?.x || snowball.x,
                        0.2
                    );
                    snowball.y = Phaser.Math.Linear(
                        snowball.y,
                        data.position?.y || snowball.y,
                        0.2
                    );
                    snowball.setRadius(data.size || snowball.radius);
                } else {
                    // Set position and velocity directly for fired snowballs
                    snowball.x = data.position?.x || snowball.x;
                    snowball.y = data.position?.y || snowball.y;
                    if (snowball.body) {
                        snowball.body.setVelocity(
                            data.velocity?.x || 0,
                            data.velocity?.y || 0
                        );
                    }
                }
            }
            break;
        }

        default:
            console.warn("Unknown object type in update:", data.objectType);
    }
}
