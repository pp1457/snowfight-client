import { CHARGE_OFFSET_DISTANCE, INITIAL_SNOWBALL_RADIUS, CHARGE_MAX_TIME, MAX_SNOWBALL_RADIUS } from "../core/constants.js";

export function anyKeyIsDown(keys) {
    return keys.some(key => key.isDown);
}

export function updateMovement(scene, cursors, keyA, keyD, keyW, keyS, player) {
    const inputState = {
        left: cursors.left.isDown || keyA.isDown,
        right: cursors.right.isDown || keyD.isDown,
        up: cursors.up.isDown || keyW.isDown,
        down: cursors.down.isDown || keyS.isDown
    };

    // Send input to server with timestamp adjusted by time offset
    if (scene.socket.readyState === WebSocket.OPEN) {
        scene.socket.send(JSON.stringify({
            type: "movement",
            objectType: "player"
            id: player.id,
            direction: inputState,
            timestamp: Date.now() + (scene.serverTimeOffset || 0)
        }));
    }
}

export function updateChargingIndicator(scene, player, chargeStartTime, isCharging) {
    if (isCharging && player.snowball) {
        const pointer = scene.input.activePointer;
        const worldPoint = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const direction = new Phaser.Math.Vector2(
            worldPoint.x - player.container.x,
            worldPoint.y - player.container.y
        ).normalize();

        player.chargingDirection = direction;

        const newX = player.container.x + direction.x * CHARGE_OFFSET_DISTANCE;
        const newY = player.container.y + direction.y * CHARGE_OFFSET_DISTANCE;
        const chargeTime = scene.time.now - chargeStartTime;
        const newRadius = Phaser.Math.Linear(
            INITIAL_SNOWBALL_RADIUS,
            MAX_SNOWBALL_RADIUS,
            Math.min(chargeTime / CHARGE_MAX_TIME, 1)
        );

        player.snowball.setPosition(newX, newY);
        player.snowball.setRadius(newRadius);

        if (scene.socket.readyState === WebSocket.OPEN) {
            scene.socket.send(JSON.stringify({
                type: "movement",
                objectType: "snowball",
                id: player.snowball.id,
                position: { x: newX, y: newY },
                size: newRadius,
                charging: true
            }));
        }
    }
}
