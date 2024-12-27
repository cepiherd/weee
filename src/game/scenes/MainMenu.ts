import { GameObjects, Scene } from 'phaser';

import { EventBus } from '../EventBus';

export class MainMenu extends Scene
{
    background: GameObjects.Image;
    logo: GameObjects.Image;
    title: GameObjects.Text;
    logoTween: Phaser.Tweens.Tween | null;
    loginInput: HTMLInputElement | null;
    characterButtons: GameObjects.Text[];

    constructor ()
    {
        super('MainMenu');
        this.logoTween = null;
        this.loginInput = null;
        this.characterButtons = [];
    }

    
    create() {
        const username = localStorage.getItem("username");
        const character = localStorage.getItem("character");
    
        console.log("Loaded username:", username); // Debug log
        console.log("Loaded character:", character); // Debug log
        console.log(username,"cek username")
        if (username && character) {
            this.scene.start("MeetingScene");
            return;
        }
    
        this.background = this.add.image(512, 384, 'background');
    
        this.title = this.add.text(512, 200, 'Daily Stand Up', {
            fontFamily: 'Arial Black', fontSize: 38, color: '#ffffff',
            stroke: '#000000', strokeThickness: 8,
            align: 'center'
        }).setOrigin(0.5).setDepth(100);
    
        this.addLoginUI();

        this.add.text(10, 10, "Reset Data", {
            fontFamily: "Arial",
            fontSize: 16,
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
        })  
            .setInteractive()
            .on("pointerdown", () => {
                localStorage.clear();
                console.log("Local storage cleared.");
                this.scene.restart(); // Restart scene
            });
        EventBus.emit('current-scene-ready', this);

        
    }

    
    addLoginUI() {
        // Input login menggunakan DOM
        const loginInput = document.createElement("input");
        loginInput.type = "text";
        loginInput.placeholder = "Enter your username";
        loginInput.style.position = "absolute";
        loginInput.style.top = "50%";
        loginInput.style.left = "45%";
        loginInput.style.transform = "translate(-50%, -50%)";
        loginInput.style.padding = "10px";
        loginInput.style.fontSize = "16px";
        loginInput.style.borderRadius = "5px";

        loginInput.addEventListener("keydown", (event) => {
            event.stopPropagation(); // Prevent Phaser's input system from handling the event

            if (event.key === "Enter" && loginInput.value.trim() !== "") {
                const username = loginInput.value.trim();
                localStorage.setItem("username", username); // Save the username
                loginInput.remove();
                this.displayCharacterSelection(); // Proceed to character selection
            }
        });

        document.body.appendChild(loginInput);

        // Tambahkan tombol login
        const loginButton = this.add.text(512, 460, "Login", {
            fontFamily: "Arial Black",
            fontSize: 24,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4,
            align: "center",
        })
            .setInteractive()
            .setOrigin(0.5)
            .on("pointerdown", () => {
                if (loginInput.value.trim()) {
                    localStorage.setItem("username", loginInput.value.trim());
                    loginInput.remove();
                    this.displayCharacterSelection();
                }
            });
    }

    displayCharacterSelection() {
        const characters = ["Warrior", "Mage", "Archer"];
        this.add.text(512, 200, "Choose Your Character", {
            fontFamily: "Arial Black",
            fontSize: 38,
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 8,
            align: "center",
        }).setOrigin(0.5);
    
        characters.forEach((character, index) => {
            this.add.text(512, 300 + index * 50, character, {
                fontFamily: "Arial Black",
                fontSize: 24,
                color: "#ffffff",
                stroke: "#000000",
                strokeThickness: 4,
                align: "center",
            })
                .setInteractive()
                .setOrigin(0.5)
                .on("pointerdown", () => {
                    localStorage.setItem("character", character); // Simpan karakter
                    console.log("Character selected:", character); // Debug log
                    this.scene.start("MeetingScene");
                });
        });
    }

    changeScene ()
    {
        if (this.logoTween)
        {
            this.logoTween.stop();
            this.logoTween = null;
        }
    
        // Ambil karakter yang dipilih dari localStorage
        const selectedCharacter = localStorage.getItem('character') || 'Warrior';
    
        // Pindah ke MeetingScene dengan data karakter
        this.scene.start('MeetingScene', { character: selectedCharacter });
    }
}
