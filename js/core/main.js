import { GameScene } from "../scenes/GameScene.js";
import { FIXED_VIEW_WIDTH, FIXED_VIEW_HEIGHT } from "./constants.js";

const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    render: { antialias: false },
    physics: {
        default: "arcade",
        arcade: { debug: false, gravity: { y: 0 } },
    },
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    dom: { createContainer: true },
    parent: "game-container",
};

const game = new Phaser.Game(config);

// Handle screen size changes
const handleScreenSizeChange = () => {
    game.scale.resize(
        Math.min(window.innerWidth, FIXED_VIEW_WIDTH),
        Math.min(window.innerHeight, FIXED_VIEW_HEIGHT)
    );
    const scene = game.scene.getScene("GameScene");
    if (scene) {
        scene.adjustCameraZoom();
    }
};

window.addEventListener("resize", handleScreenSizeChange);

// Fullscreen change events
const fullscreenEvents = [
    "fullscreenchange",
    "webkitfullscreenchange",
    "mozfullscreenchange",
    "MSFullscreenChange"
];
fullscreenEvents.forEach(eventName => {
    document.addEventListener(eventName, handleScreenSizeChange);
});

window.addEventListener("orientationchange", handleScreenSizeChange);

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        handleScreenSizeChange();
    }
});

// Cleanup function (call when destroying the game)
const cleanupScreenHandlers = () => {
    window.removeEventListener("resize", handleScreenSizeChange);
    fullscreenEvents.forEach(eventName => {
        document.removeEventListener(eventName, handleScreenSizeChange);
    });
    window.removeEventListener("orientationchange", handleScreenSizeChange);
    document.removeEventListener("visibilitychange", handleScreenSizeChange);
};
