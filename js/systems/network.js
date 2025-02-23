import { updateGameObject } from "./updater.js";

export function handleServerMessage(event) {
    const data = JSON.parse(event.data);
    switch (data.messageType) {
        case "pong": {
            const T3 = Date.now();
            const T1 = data.clientTime;
            const T2 = data.serverTime;
            const rtt = T3 - T1;
            const offset = T2 - (T1 + rtt / 2);
            this.serverTimeOffset = offset;
            console.log("Calculated server time offset:", offset);
            return;
        }
        case "movement":
            break;
        case "hit":
            handleHit(this, data);
            break;
        case "death":
            handleDeath(this, data);
            break;
        case "respawn":
            handleRespawn(this, data);
            break;
        default:
            console.warn("Unknown message type:", data.type);
    }
    updateGameObject(this, data);
}

function handleHit(scene, data) {
    if (data.id === scene.player.id) {
        scene.player.updateHealth(data.newHealth);
        scene.cameras.main.shake(100, 0.01);
    }
}

function handleDeath(scene, data) {
    if (data.id === scene.player.id) {
        scene.isAlive = false;
        scene.player.container.setAlpha(0.5);
        scene.time.delayedCall(3000, () => {
            scene.socket.send(JSON.stringify({
                type: "respawn",
                id: scene.player.id,
            }));
        });
    }
}

function handleRespawn(scene, data) {
    if (data.id === scene.player.id) {
        scene.isAlive = true;
        scene.currentHealth = 100;
        scene.player.container.setAlpha(1);
        scene.player.container.setPosition(data.position.x, data.position.y);
        scene.player.updateHealth(100);
    }
}
