import { PLAYER_RADIUS, PLAYER_SIZE } from "./constants.js";

export function createPlayer(scene, x, y, username = "") {
    const circle = scene.add.circle(0, 0, PLAYER_RADIUS, 0x00ff00);
    const container = scene.add.container(x, y, [circle]);
    scene.physics.add.existing(container);
    container.body.setSize(PLAYER_SIZE, PLAYER_SIZE);
    container.body.setOffset(-PLAYER_RADIUS, -PLAYER_RADIUS);
    container.body.setCollideWorldBounds(true);

    const healthBarBg = scene.add.rectangle(0, -30, PLAYER_SIZE, 5, 0x555555);
    healthBarBg.setOrigin(0.5, 0.5);
    container.add(healthBarBg);

    const healthBar = scene.add.rectangle(-PLAYER_RADIUS, -30, PLAYER_SIZE, 5, 0x00ff00);
    healthBar.setOrigin(0, 0.5);
    container.add(healthBar);

    const usernameText = scene.add.text(0, 30, username, {
        fontSize: "15px",
        fill: "#000000",
        align: "center"
    });
    usernameText.setOrigin(0.5, 0.5);
    container.add(usernameText);

    const playerObj = {
        container,
        circle,
        healthBar,
        healthBarBg,
        usernameText,
        health: 100,
        updateHealth(newHealth) {
            this.health = newHealth;
            const healthPercentage = Math.max(newHealth / 100, 0);
            this.healthBar.width = PLAYER_SIZE * healthPercentage;
            if (healthPercentage > 0.5) {
                this.healthBar.fillColor = 0x00ff00;
            } else if (healthPercentage > 0.25) {
                this.healthBar.fillColor = 0xffff00;
            } else {
                this.healthBar.fillColor = 0xff0000;
            }
        }
    };

    playerObj.updateHealth(100);
    return playerObj;
}
