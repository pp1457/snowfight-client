import {
    CHARGE_OFFSET_DISTANCE,
    INITIAL_SNOWBALL_RADIUS,
    CHARGE_MAX_TIME,
    MAX_SNOWBALL_RADIUS,
    SNOWBALL_LIFE_LENGTH
} from "./constants.js";

export function anyKeyIsDown(keys) {
    return keys.some(key => key.isDown);
}

function getInputDirection(cursors, keyA, keyD, keyW, keyS) {
    const leftKeys = [cursors.left, keyA];
    const rightKeys = [cursors.right, keyD];
    const upKeys = [cursors.up, keyW];
    const downKeys = [cursors.down, keyS];

    let velocityX = 0;
    let velocityY = 0;

    if (anyKeyIsDown(leftKeys)) {
        velocityX = -1;
    } else if (anyKeyIsDown(rightKeys)) {
        velocityX = 1;
    }

    if (anyKeyIsDown(upKeys)) {
        velocityY = -1;
    } else if (anyKeyIsDown(downKeys)) {
        velocityY = 1;
    }

    return { velocityX, velocityY };
}

export function updateMovement(scene, cursors, keyA, keyD, keyW, keyS, player) {
    player.container.body.setVelocity(0);

    const { velocityX, velocityY } = getInputDirection(cursors, keyA, keyD, keyW, keyS);

    let finalVx = velocityX;
    let finalVy = velocityY;

    if (velocityX !== 0 && velocityY !== 0) {
        const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
        finalVx /= magnitude;
        finalVy /= magnitude;
    }

    const speed = scene.registry.get("PLAYER_SPEED");
    finalVx *= speed;
    finalVy *= speed;
    player.container.body.setVelocity(finalVx, finalVy);

    return { velocityX: finalVx, velocityY: finalVy };
}

export function updateChargingIndicator(scene, player, chargeStartTime, isCharging) {
    if (!isCharging || !player.snowball) return;

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
            timeUpdate: Date.now() + (scene.serverTimeOffset || 0),
            lifeLength: SNOWBALL_LIFE_LENGTH,
            charging: true
        }));
    }
}
