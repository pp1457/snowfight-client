import {
    PLAYER_SPEED,
    CHARGE_MAX_TIME,
    INITIAL_SNOWBALL_RADIUS,
    MAX_SNOWBALL_RADIUS,
    CHARGE_OFFSET_DISTANCE,
    SNOWBALL_SPEED,
    SNOWBALL_LIFE_LENGTH,
    MAX_SNOWBALL_SPEED,
    INITIAL_SNOWBALL_DAMAGE,
    MAX_SNOWBALL_DAMAGE,
    FIXED_VIEW_WIDTH,
    FIXED_VIEW_HEIGHT,
    SNOWBALL_COOLDOWN
} from "./constants.js";
import { createPlayer } from "./player.js";
import { createSnowball } from "./snowball.js";
import { checkAlive } from "./updater.js";
import { updateMovement, updateChargingIndicator } from "./input.js";
import { sendPositionUpdate, handleServerMessage } from "./network.js";

export class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: "GameScene" });
        this.serverTimeOffset = 0;
    }

    preload() {
        this.load.image("tiles", localStorage.getItem("assets/tiny-ski.png") || "assets/tiny-ski.png");
        this.load.tilemapTiledJSON("map", localStorage.getItem("assets/small-ski.tmj") || "assets/small-ski.tmj");
    }

    create() {
        this.registry.set("PLAYER_SPEED", PLAYER_SPEED);

        const map = this.make.tilemap({ key: "map" });
        const tileset = map.addTilesetImage("tiny-ski", "tiles");
        map.createLayer("Ground", tileset);
        const treeLayer = map.createLayer("Trees", tileset);
        treeLayer.setCollisionByProperty({ collides: true });

        this.mapWidth = map.widthInPixels;
        this.mapHeight = map.heightInPixels;
        this.physics.world.setBounds(0, 0, this.mapWidth, this.mapHeight);
        this.cameras.main.setBounds(0, 0, this.mapWidth, this.mapHeight);
        this.cameras.main.roundPixels = true;

        const spawnMargin = 20;
        const randomX = Phaser.Math.Between(spawnMargin, this.mapWidth - spawnMargin);
        const randomY = Phaser.Math.Between(spawnMargin, this.mapHeight - spawnMargin);
        const username = sessionStorage.getItem("playerName") || "Unknown";
        const serverIP = sessionStorage.getItem("serverIP") || "localhost:12345";
        const player = createPlayer(this, randomX, randomY, username);
        player.id = crypto.randomUUID();
        this.cameras.main.startFollow(player.container, true);

        this.player = player;
        this.players = {};
        this.isAlive = true;
        this.currentHealth = 100;
        this.lastFireTime = 0;

        this.cursors = this.input.keyboard.createCursorKeys();
        this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);

        this.snowballs = this.physics.add.group();

        this.socket = new WebSocket(`${serverIP}`);
        this.socket.onopen = () => {
            console.log("Connected to server");
            this.socket.send(JSON.stringify({
                type: "join",
                id: this.player.id,
                position: { x: this.player.container.x, y: this.player.container.y },
                timeUpdate: Date.now() + (this.serverTimeOffset || 0),
                username: username
            }));
            const pingMsg = { type: "ping", clientTime: Date.now() };
            this.socket.send(JSON.stringify(pingMsg));
            this.pingInterval = setInterval(() => {
                const pingMsg = { type: "ping", clientTime: Date.now() };
                this.socket.send(JSON.stringify(pingMsg));
            }, 5000);
        };
        this.socket.onmessage = handleServerMessage.bind(this);

        this.input.on("pointerdown", this.startCharging, this);
        this.input.on("pointerup", this.fireSnowball, this);

        this.adjustCameraZoom();
    }

    update() {
        if (!this.isAlive) return;

        const { velocityX, velocityY } = updateMovement(
            this,
            this.cursors,
            this.keyA,
            this.keyD,
            this.keyW,
            this.keyS,
            this.player
        );
        sendPositionUpdate(this, this.socket, this.player, velocityX, velocityY);
        updateChargingIndicator(this, this.player, this.chargeStartTime, this.isCharging);
        checkAlive(this);
    }

    startCharging() {
        const currentTime = this.time.now;
        if (!this.isAlive || this.isCharging || currentTime - this.lastFireTime < SNOWBALL_COOLDOWN) return;
        this.isCharging = true;
        this.chargeStartTime = currentTime;
        const pointer = this.input.activePointer;
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const direction = new Phaser.Math.Vector2(
            worldPoint.x - this.player.container.x,
            worldPoint.y - this.player.container.y
        ).normalize();
        this.player.chargingDirection = direction;

        const snowballId = "snowball_" + this.player.id + "_" + Date.now();
        this.player.snowball = this.add
            .circle(
                this.player.container.x + direction.x * CHARGE_OFFSET_DISTANCE,
                this.player.container.y + direction.y * CHARGE_OFFSET_DISTANCE,
                INITIAL_SNOWBALL_RADIUS,
                0x000000
            )
            .setAlpha(0.8);

        this.player.snowball.id = snowballId;
        this.player.snowball.charging = true;

        this.physics.world.enable(this.player.snowball);
        this.snowballs.add(this.player.snowball);

        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "movement",
                objectType: "snowball",
                id: snowballId,
                position: {
                    x: this.player.container.x + this.player.chargingDirection.x * CHARGE_OFFSET_DISTANCE,
                    y: this.player.container.y + this.player.chargingDirection.y * CHARGE_OFFSET_DISTANCE
                },
                size: INITIAL_SNOWBALL_RADIUS,
                charging: true
            }));
        }
    }

    fireSnowball() {
        const currentTime = this.time.now;
        if (!this.isCharging || !this.player.snowball || currentTime - this.lastFireTime < SNOWBALL_COOLDOWN) return;

        this.lastFireTime = currentTime;
        const chargeTime = currentTime - this.chargeStartTime;
        const chargeFactor = Math.min(chargeTime / CHARGE_MAX_TIME, 1);
        const finalRadius = Phaser.Math.Linear(INITIAL_SNOWBALL_RADIUS, MAX_SNOWBALL_RADIUS, chargeFactor);
        const finalSpeed = Phaser.Math.Linear(SNOWBALL_SPEED, MAX_SNOWBALL_SPEED, chargeFactor);
        const finalDamage = Phaser.Math.Linear(INITIAL_SNOWBALL_DAMAGE, MAX_SNOWBALL_DAMAGE, chargeFactor);
        const direction = this.player.chargingDirection || new Phaser.Math.Vector2(1, 0);
        const fireX = this.player.container.x + (this.player.snowball.x - this.player.container.x);
        const fireY = this.player.container.y + (this.player.snowball.y - this.player.container.y);
        const snowballId = this.player.snowball.id;

        if (!this.player.snowball.body) {
            this.physics.world.enable(this.player.snowball);
            this.snowballs.add(this.player.snowball);
        }

        this.player.snowball.body.setVelocity(direction.x * finalSpeed, direction.y * finalSpeed);
        this.player.snowball.setRadius(finalRadius);
        this.player.snowball.charging = false;
        this.player.snowball.setAlpha(1);

        if (this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                type: "movement",
                objectType: "snowball",
                id: snowballId,
                position: { x: fireX, y: fireY },
                velocity: { x: direction.x * finalSpeed, y: direction.y * finalSpeed },
                size: finalRadius,
                damage: finalDamage,
                charging: false,
                timeUpdate: Date.now() + (this.serverTimeOffset || 0),
                lifeLength: SNOWBALL_LIFE_LENGTH - 100
            }));
        }

        this.isCharging = false;
        this.player.snowball = null;
    }

    adjustCameraZoom() {
        const zoomX = window.innerWidth / FIXED_VIEW_WIDTH;
        const zoomY = window.innerHeight / FIXED_VIEW_HEIGHT;
        let newZoom = Math.max(zoomX, zoomY);
        newZoom = Math.round(newZoom * 100) / 100;
        this.cameras.main.setZoom(newZoom);
    }
}
