import { createPlayer } from "../entities/player.js";
import { createSnowball } from "../entities/snowball.js";

function isDead(obj, scene) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);
    return obj.isDead || (obj.expireDate && obj.expireDate <= currentTime);
}

export function checkAlive(scene) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);

    scene.snowballs.getChildren().forEach(snowball => {
        if (isDead(snowball, scene)) {
            snowball.destroy();
            scene.snowballs.remove(snowball);
        }
    });

    Object.entries(scene.players).forEach(([id, player]) => {
        if (isDead(player, scene)) {
            player.container.destroy(true);
            delete scene.players[id];
        }
    });
}

export function updateGameObject(scene, data) {
    const currentTime = Date.now() + (scene.serverTimeOffset || 0);

    switch (data.objectType) {
        case "player":
            if (data.id === scene.player.id) {
                // Local player: set position directly from server
                scene.player.container.setPosition(data.position.x, data.position.y);
                scene.player.updateHealth(data.newHealth || scene.player.health);
                if (data.newHealth <= 0 && scene.isAlive) {
                    scene.add.text(400, 300, "Game Over", { fontSize: "32px", color: "#fff" });
                    setTimeout(() => { window.location.href = "login.html"; }, 0);
                }
            } else {
                // Remote player: create or update
                let player = scene.players[data.id];
                if (!player && !data.isDead) {
                    player = createPlayer(scene, data.position?.x || 0, data.position?.y || 0);
                    player.id = data.id;
                    scene.players[data.id] = player;
                }
                if (player && !isDead(player, scene)) {
                    player.container.setPosition(data.position?.x || player.container.x, data.position?.y || player.container.y);
                    player.updateHealth(data.newHealth || player.health);
                    player.isDead = data.isDead || false;
                    player.expireDate = data.expireDate || null;
                }
            }
            break;

        case "snowball":
            let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
            if (!snowball && !data.isDead) {
                const radius = data.size || 10;
                snowball = createSnowball(scene, data.position?.x || 0, data.position?.y || 0, radius);
                snowball.id = data.id;
                scene.snowballs.add(snowball);
            }
            if (snowball && !isDead(snowball, scene)) {
                snowball.isDead = data.isDead || false;
                snowball.expireDate = data.expireDate || null;
                if (data.charging) {
                    snowball.setPosition(data.position?.x || snowball.x, data.position?.y || snowball.y);
                    snowball.setRadius(data.size || snowball.radius);
                } else if (data.velocity) {
                    snowball.setPosition(data.position?.x || snowball.x, data.position?.y || snowball.y);
                    if (snowball.body) {
                        snowball.body.setVelocity(data.velocity?.x || 0, data.velocity?.y || 0);
                    }
                }
            }
            break;

        default:
            console.warn("Unknown object type in update:", data.objectType);
    }
}
