import { updateGameObject } from "./updater.js";
import { decode } from "https://cdn.skypack.dev/@msgpack/msgpack";

export function sendPositionUpdate(scene, socket, player, velocityX, velocityY) {
    if (!scene.lastSentPosition) {
        scene.lastSentPosition = { x: player.container.x, y: player.container.y };
    }
    const posChanged =
         Math.abs(player.container.x - scene.lastSentPosition.x) > 0.5 ||
         Math.abs(player.container.y - scene.lastSentPosition.y) > 0.5;

    if (posChanged && socket.readyState === WebSocket.OPEN) {
        const updateMsg = {
            type: "movement",
            objectType: "player",
            id: player.id,
            position: { x: player.container.x, y: player.container.y },
            velocity: { x: velocityX, y: velocityY },
            timeUpdate: Date.now() + (scene.serverTimeOffset || 0),
        };
        socket.send(JSON.stringify(updateMsg));
        scene.lastSentPosition = { x: player.container.x, y: player.container.y };
    }
}

export function handleServerMessage(event) {
    console.log("Message received, type:", typeof event.data, "instanceof ArrayBuffer:", event.data instanceof ArrayBuffer, "instanceof Blob:", event.data instanceof Blob);
    
    // Check if this is a binary message (MessagePack)
    if (event.data instanceof ArrayBuffer) {
        console.log("Detected ArrayBuffer");
        handleBinaryMessage.call(this, event.data);
        return;
    }
    
    // Check if this is a Blob (WebSocket might send binary as Blob)
    if (event.data instanceof Blob) {
        console.log("Detected Blob");
        event.data.arrayBuffer().then(buffer => {
            handleBinaryMessage.call(this, buffer);
        }).catch(err => {
            console.error("Error converting Blob to ArrayBuffer:", err);
        });
        return;
    }
    
    // Handle JSON messages (for backwards compatibility)
    try {
        console.log("Attempting to parse as JSON");
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
            case "batch_update":
                // Handle batched updates - process all updates at once
                if (data.updates && Array.isArray(data.updates)) {
                    data.updates.forEach(update => {
                        updateGameObject(this, update);
                    });
                }
                return;
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
                console.warn("Unknown message type:", data.messageType);
                return;
        }
        // After handling special events, update the game object state
        updateGameObject(this, data);
    } catch (error) {
        console.error("Error parsing message:", error);
        console.log("Raw message data:", event.data);
    }
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

// Handle binary MessagePack messages
function handleBinaryMessage(arrayBuffer) {
    console.log("Received binary message, size:", arrayBuffer.byteLength);
    
    // Debug: Show first bytes
    const bytes = new Uint8Array(arrayBuffer);
    console.log("First 40 bytes:", Array.from(bytes.slice(0, 40)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
    
    try {
        // Decode the MessagePack binary data
        console.log("About to decode, buffer length:", bytes.length);
        const data = decode(bytes);
        console.log("Successfully decoded! Data:", data);
        
        // Check message type
        if (data.messageType === "batch_update") {
            // Process all updates in the batch
            if (data.updates && Array.isArray(data.updates)) {
                console.log("Processing", data.updates.length, "updates");
                data.updates.forEach((update, index) => {
                    console.log(`Update ${index}:`, update);
                    updateGameObject(this, update);
                });
            }
        } else {
            console.warn("Unknown binary message type:", data.messageType);
        }
    } catch (error) {
        console.error("Error decoding MessagePack:", error);
        console.error("Error stack:", error.stack);
        console.log("ArrayBuffer size:", arrayBuffer.byteLength);
        console.log("First 100 bytes:", Array.from(bytes.slice(0, 100)).map(b => b.toString(16).padStart(2, '0')).join(' '));
        console.log("Full hex dump:", Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
}
