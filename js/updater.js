import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";

// Utility function to get current server-adjusted time
function getCurrentTime(scene) {
    return Date.now() + (scene.serverTimeOffset || 0);
}

// Check if an object has expired or is marked as dead
function isDead(obj, scene) {
    if (obj.charging) {
        return false;
    }
    const currentTime = getCurrentTime(scene);
    return obj.isDead || (obj.expireDate && obj.expireDate <= currentTime);
}

// Clean up dead objects from the scene
export function checkAlive(scene) {
    const currentTime = getCurrentTime(scene);

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
            console.log("AHhhh I'm dead");
            player.container.destroy(true);
            delete scene.players[id];
        }
    });
}

// Main update function with early validation
export function updateGameObject(scene, data) {
    if (!data || !data.objectType) {
        console.warn("Invalid data received:", data);
        return;
    }

    const currentTime = getCurrentTime(scene);

    switch (data.objectType) {
        case "player":
            handlePlayerUpdate(scene, data, currentTime);
            break;
        case "snowball":
            handleSnowballUpdate(scene, data, currentTime);
            break;
        default:
            console.warn("Unknown object type:", data.objectType);
    }
}

// Handle player-specific updates
function handlePlayerUpdate(scene, data, currentTime) {
    if (data.id === scene.player.id) {
        updateLocalPlayer(scene, data);
        return;
    }

    let player = scene.players[data.id];
    if (!player) {
        player = createRemotePlayer(scene, data);
        scene.players[data.id] = player;
    }

    player.expireDate = currentTime + 100;
    updatePlayerStatus(player, data);
    updatePlayerPosition(player, data);
    updatePlayerVelocity(player, data);
    updatePlayerHealth(player, data);
}

// Update the local player (current user)
function updateLocalPlayer(scene, data) {
    scene.player.updateHealth(data.newHealth || 0);
    if (data.isDead) {
        sendSnowballCleanup(scene);
        redirectToLogin();
    }
}

// Create a new remote player
function createRemotePlayer(scene, data) {
    const player = createPlayer(
        scene,
        data.position?.x || 0,
        data.position?.y || 0,
        data.username || "Unknown"
    );
    player.id = data.id;
    return player;
}

// Update player position with smooth interpolation
function updatePlayerPosition(player, data) {
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
}

// Update player physics velocity
function updatePlayerVelocity(player, data) {
    if (player.container.body) {
        player.container.body.setVelocity(
            data.velocity?.x || 0,
            data.velocity?.y || 0
        );
    }
}

// Update player health and status
function updatePlayerHealth(player, data) {
    player.updateHealth(data.newHealth || 0);
}

function updatePlayerStatus(player, data) {
    player.isDead = data.isDead || false;
}

// Send cleanup message for snowball when player dies
function sendSnowballCleanup(scene) {
    if (scene.player.snowball && scene.socket.readyState === WebSocket.OPEN) {
        scene.socket.send(JSON.stringify({
            type: "movement",
            objectType: "snowball",
            id: scene.player.snowball.id,
            size: 0,
            damage: 0,
            charging: false,
            timeEmission: getCurrentTime(scene),
            lifeLength: 0
        }));
    }
}

// Redirect to login page
function redirectToLogin() {
    setTimeout(() => {
        window.location.href = "login.html";
    }, 0);
}

// Handle snowball-specific updates
function handleSnowballUpdate(scene, data, currentTime) {
    let snowball = scene.snowballs.getChildren().find(s => s.id === data.id);
    if (!snowball && !data.isDead) {
        snowball = createNewSnowball(scene, data);
        scene.snowballs.add(snowball);
    } else if (snowball && data.isDead) {
        snowball.destroy();
        scene.snowballs.remove(snowball);
    }

    if (snowball && !isDead(snowball, scene)) {
        updateSnowballStatus(snowball, data);
        if (data.charging) {
            updateChargingSnowball(snowball, data);
        } else {
            updateFiredSnowball(snowball, data);
        }
    }
}

// Create a new snowball instance
function createNewSnowball(scene, data) {
    const radius = data.size || 10;
    const snowball = createSnowball(
        scene,
        data.position?.x || 0,
        data.position?.y || 0,
        radius
    );
    snowball.id = data.id;
    return snowball;
}

// Update snowball status properties
function updateSnowballStatus(snowball, data) {
    snowball.isDead = data.isDead || false;
    snowball.expireDate = data.expireDate || null;
}

// Update a charging snowball's properties
function updateChargingSnowball(snowball, data) {
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
}

// Update a fired snowball's properties
function updateFiredSnowball(snowball, data) {
    snowball.x = data.position?.x || snowball.x;
    snowball.y = data.position?.y || snowball.y;
    if (snowball.body) {
        snowball.body.setVelocity(
            data.velocity?.x || 0,
            data.velocity?.y || 0
        );
    }
}
