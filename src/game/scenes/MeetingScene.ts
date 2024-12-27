import { GameObjects, Scene } from "phaser";
import { io, Socket } from "socket.io-client";
import Peer from "simple-peer";

export class MeetingScene extends Scene {
    player: GameObjects.Image;
    otherPlayers: Map<string, GameObjects.Image>; // Untuk menyimpan avatar pemain lain
    socket: Socket;
    username: string;
    playerTitle: GameObjects.Text;
    peers: Map<string, Peer.Instance>;
    localStream: MediaStream | null;
    backgroundMusic: Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound;


    constructor() {
        super("MeetingScene");
        this.otherPlayers = new Map();
        this.socket = io("http://localhost:3001"); // Ganti dengan URL server Anda
        this.username = "";
        this.peers = new Map();
        this.localStream = null;


    }

    preload() {
        this.load.image("background", "/assets/background.png");
        this.load.image("warrior", "/assets/warrior.png");
        this.load.image("mage", "/assets/mage.png");
        this.load.image("archer", "/assets/archer.png");
        this.load.image("npc", "/assets/npc.png");
        this.load.audio("backgroundMusic" , "/assets/dungeon-song.mp3")
    }

   async create() {
        // Ambil data login
        // Ambil data dari localStorage

         // Play background music
     // Play background music
     const music = this.sound.add("backgroundMusic", {
        volume: 0.5,
        loop: true,
    });
    music.play();
    this.backgroundMusic = music;

    // Add music controls
    this.createMusicControls();
    
    const username = localStorage.getItem("username") || "Guest";
    const character = localStorage.getItem("character") || "Warrior";
    const savedPosition = JSON.parse(localStorage.getItem("playerPosition") || "null");

    // Hitung posisi default
        const defaultX = Math.floor(Math.random() * 800) + 100; // Random antara 100 dan 900
        const defaultY = 410;

        // Tentukan posisi awal
        const startPosition = savedPosition || { x: defaultX, y: defaultY };

        // Tambahkan background
        this.add.image(512, 384, "background");

        // Tambahkan avatar pemain
        this.player = this.add.image(startPosition.x, startPosition.y, character.toLowerCase()).setScale(0.3);

        // Tambahkan title pemain
        this.playerTitle = this.add.text(this.player.x, this.player.y - 100, username, {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
        }).setOrigin(0.5);

        // Setup player movement and other logic
        this.setupPlayerMovement();

        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Hubungkan ke WebSocket
        this.setupWebRTC();

        // Tampilkan tombol mute/unmute
        this.createAudioControls();

        // Hubungkan ke server WebSocket
        this.setupWebSocket();

        // Tambahkan input keyboard untuk menggerakkan pemain
        this.setupPlayerMovement();

        this.createTaskButton();
        
        this.displayTasks();

         // Tambahkan input DOM untuk pesan chat
        const chatInput = document.createElement("input");
        chatInput.type = "text";
        chatInput.placeholder = "Type a message...";
        chatInput.style.position = "absolute";
        chatInput.style.bottom = "40px";
        chatInput.style.left = "23%";
        chatInput.style.transform = "translateX(-50%)";
        chatInput.style.width = "300px";
        chatInput.style.padding = "10px";
        document.body.appendChild(chatInput);
        this.createLogoutButton(); // Tambahkan tombol logout

        // Kirim pesan ketika menekan Enter
        chatInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && chatInput.value.trim() !== "") {
                const message = chatInput.value.trim();

                // Kirim pesan ke server
                this.socket.emit("sendMessage", { id: this.socket.id, message });

                // Tampilkan pesan di atas kepala pemain utama
                this.showMessage(this.player, message);

                // Kosongkan input
                chatInput.value = "";
            }
        });

        // Terima pesan dari server
        this.socket.on("chatMessage", ({ id, message }) => {
            if (id !== this.socket.id) {
                const otherPlayer = this.otherPlayers.get(id);
                if (otherPlayer) {
                    this.showMessage(otherPlayer, message);
                }
            }
        });

        this.socket.emit("joinMeeting", {
            username,
            position: { x: this.player.x, y: this.player.y },
            character,
        });
    }

    logout() {
        // Emit event ke server jika diperlukan
        this.socket.emit("leaveMeeting");
    
        // Hapus data dari localStorage
        localStorage.removeItem("username");
        localStorage.removeItem("character");
        localStorage.removeItem("playerPosition");
    
        // Kembali ke MainMenu
        this.scene.start("MainMenu");
    }

    setupWebRTC() {
        // Ketika menerima sinyal WebRTC dari pengguna lain
        this.socket.on("webrtc-signal", ({ sender, signal }) => {
            if (!this.peers.has(sender)) {
                const peer = this.createPeer(sender, false);
                peer.signal(signal);
            } else {
                const peer = this.peers.get(sender);
                peer?.signal(signal);
            }
        });

        // Tambahkan diri ke room audio
        this.socket.emit("joinMeeting");

        // Kirim sinyal WebRTC ke pengguna baru
        this.socket.on("user-joined", (userId: string) => {
            const peer = this.createPeer(userId, true);
        });
    }

    createMusicControls() {
        const musicToggleButton = this.add.text(10, 10, "Mute", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
        })
            .setInteractive()
            .on("pointerdown", () => {
                if (this.backgroundMusic?.isPlaying) {
                    this.backgroundMusic.pause();
                    musicToggleButton.setText("Unmute");
                } else {
                    this.backgroundMusic?.resume();
                    musicToggleButton.setText("Mute");
                }
            });
    }

    createPeer(target: string, initiator: boolean) {
        const peer = new Peer({
            initiator,
            trickle: false,
            stream: this.localStream!,
        });

        peer.on("signal", (signal) => {
            this.socket.emit("webrtc-signal", { target, signal });
        });

        peer.on("stream", (stream) => {
            this.addAudioStream(stream);
        });

        this.peers.set(target, peer);
        return peer;
    }

    addAudioStream(stream: MediaStream) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play();
    }

    createAudioControls() {
        const muteButton = this.add.text(10, 10, "Mute", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
        })
            .setInteractive()
            .on("pointerdown", () => {
                if (this.localStream) {
                    const audioTrack = this.localStream.getAudioTracks()[0];
                    audioTrack.enabled = !audioTrack.enabled;
                    muteButton.setText(audioTrack.enabled ? "Mute" : "Unmute");
                }
            });
    }

    showMessage(player: GameObjects.Image, message: string) {
        const messageText = this.add.text(player.x, player.y - 50, message, {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5);
    
        // Update posisi teks agar mengikuti pemain
        const updatePosition = () => {
            messageText.setPosition(player.x, player.y - 50);
        };
    
        // Lacak posisi pemain
        const interval = setInterval(updatePosition, 16);
    
        // Hapus teks setelah beberapa detik
        this.time.delayedCall(3000, () => {
            messageText.destroy();
            clearInterval(interval);
        });
    }

    

    setupWebSocket() {
        
        this.socket.emit("joinMeeting", {
            username: localStorage.getItem("username") || "Guest",
            position: { x: this.player.x, y: this.player.y },
            character: localStorage.getItem("character") || "Warrior",
        });

        this.socket.on("taskNotification", (data: { username: string; task: string; message: string }) => {
            console.log(data.message);
    
            // Display the message on the game screen
            this.showNotification(data.message);
        });

        this.socket.on("receiveTasks", (data: { targetId: string; tasks: { id: number; task: string; done: boolean }[] }) => {
            console.log("Tasks received from server:", data);
        
            if (!data || !data.tasks) {
                console.error("No tasks received or invalid data format:", data);
                return;
            }
        
            this.showTasksPopup(data.tasks);
        });
    
        // Handle other users joining
        this.socket.on("user-joined", (user: { id: string; username: string; position: { x: number, y: number }, character: string }) => {
            console.log("User joined:", user);
    
            if (!this.otherPlayers.has(user.id)) {
                const newPlayer = this.add.image(user.position.x, user.position.y, user.character.toLowerCase()).setScale(0.3);
    
                const newTitle = this.add.text(user.position.x, user.position.y - 100, user.username, {
                    fontFamily: "Arial",
                    fontSize: "12px",
                    color: "#ffffff",
                }).setOrigin(0.5);
    
                newPlayer.setData("title", newTitle);
                this.otherPlayers.set(user.id, newPlayer);
    
                console.log(`Added new player: ${user.username}`);
            }
        });

        this.socket.on("taskShared", (data: { sender: string; task: string }) => {
            console.log(`Task received from ${data.sender}: ${data.task}`);
    
            // Save the shared task locally
            this.saveTaskToLocalStorage(`${data.task} (shared by ${data.sender})`);
    
            // Update the task display
            this.displayTasks();
        });
    
        this.socket.on("updatePosition", (data: { id: string; position: { x: number, y: number } }) => {
            console.log("Position update received:", data);
        
            const player = this.otherPlayers.get(data.id);
            if (player) {
                player.setPosition(data.position.x, data.position.y);
        
                // Update the title position as well
                const title = player.getData("title");
                if (title) {
                    title.setPosition(data.position.x, data.position.y - 100);
                }
            }
        });
    
        this.socket.on("user-disconnected", (id) => {
            const player = this.otherPlayers.get(id);
            if (player) {
                const title = player.getData("title");
                if (title) {
                    title.destroy();
                }
                player.destroy();
                this.otherPlayers.delete(id);
            }
            console.log(`Removed player: ${id}`);
        });
    
        this.socket.on("updateUsers", (users) => {
            console.log("Online users received:", users);
        
            users.forEach((user) => {
                if (user.id !== this.socket.id) {
                    this.updateOtherPlayer(user);
                }
            });
        
            // Hapus pemain yang tidak ada di daftar online
            const userIds = users.map((user) => user.id);
            this.otherPlayers.forEach((_, id) => {
                if (!userIds.includes(id)) {
                    const player = this.otherPlayers.get(id);
                    if (player) {
                        const title = player.getData("title");
                        if (title) {
                            title.destroy();
                        }
                        player.destroy();
                        this.otherPlayers.delete(id);
                    }
                }
            });
        });

        this.socket.on("taskStatusUpdated", (data: { taskId: number; status: boolean; username: string }) => {
            console.log(`Task ${data.taskId} marked as ${data.status ? "done" : "not done"} by ${data.username}`);
    
            // Update local task list
            const tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
            const updatedTasks = tasks.map((task: { id: number; task: string; done: boolean }) =>
                task.id === data.taskId ? { ...task, done: data.status } : task
            );
            localStorage.setItem("tasks", JSON.stringify(updatedTasks));
    
            // Update task display
            this.displayTasks();
        });

        this.socket.on("user-joined", (user) => {
            console.log("User joined:", user);
            this.updateOtherPlayer(user);
        });
    }
    

    updateOtherPlayer(user: { id: string; username: string; position: { x: number, y: number }, character: string }) {
        if (this.otherPlayers.has(user.id)) {
            const player = this.otherPlayers.get(user.id);
            player?.setPosition(user.position.x, user.position.y);
        } else {
            const newPlayer = this.add.image(user.position.x, user.position.y, user.character.toLowerCase()).setScale(0.3);
    
            const newTitle = this.add.text(user.position.x, user.position.y - 20, user.username, {
                fontFamily: "Arial",
                fontSize: "12px",
                color: "#ffffff",
            }).setOrigin(0.5);
    
            newPlayer.setData("title", newTitle);
    
            // Ensure the sprite is interactive
            newPlayer.setInteractive();
    
            // Attach pointerdown event
            newPlayer.on("pointerdown", () => {
                console.log(`Emitting getTasks for user ID: ${user.id}`);
                this.socket.emit("getTasks", { targetId: user.id });
                console.log("getTasks event emitted");
            });
    
            this.otherPlayers.set(user.id, newPlayer);
        }
    }

    

    showTasksPopup(tasks: { id: number; task: string; done: boolean }[]) {
        const popup = document.createElement("div");
        popup.style.position = "absolute";
        popup.style.top = "50%";
        popup.style.left = "50%";
        popup.style.transform = "translate(-50%, -50%)";
        popup.style.background = "#ffffff";
        popup.style.padding = "20px";
        popup.style.border = "1px solid #000";
        popup.style.borderRadius = "5px";
        popup.style.zIndex = "1000";
    
        const title = document.createElement("h3");
        title.textContent = "Tasks";
        popup.appendChild(title);
    
        tasks.forEach((task) => {
            const taskItem = document.createElement("div");
            taskItem.textContent = `${task.task} (${task.done ? "Done" : "Not Done"})`;
            popup.appendChild(taskItem);
        });
    
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        closeButton.style.marginTop = "10px";
        popup.appendChild(closeButton);
    
        closeButton.addEventListener("click", () => {
            document.body.removeChild(popup);
        });
    
        document.body.appendChild(popup);
    }

    createLogoutButton() {
        const logoutButton = this.add.text(10, 50, "Logout", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
        })
            .setInteractive()
            .on("pointerdown", () => {
                this.logout();
            });
    }

    setupPlayerMovement() {
        this.input.keyboard.on("keydown", (event: KeyboardEvent) => {
            const speed = 10;
    
            switch (event.key) {
                case "ArrowUp":
                    this.player.y -= speed;
                    break;
                case "ArrowDown":
                    this.player.y += speed;
                    break;
                case "ArrowLeft":
                    this.player.x -= speed;
                    break;
                case "ArrowRight":
                    this.player.x += speed;
                    break;
            }
    
            // Perbarui posisi title pemain
            this.playerTitle.setPosition(this.player.x, this.player.y - 100);
    
            // Simpan posisi terakhir ke localStorage
            localStorage.setItem("playerPosition", JSON.stringify({ x: this.player.x, y: this.player.y }));

            this.socket.emit("updatePosition", {
                id: this.socket.id,
                position: { x: this.player.x, y: this.player.y },
            });
    
            // Debugging log for position updates
            console.log("Position emitted:", { id: this.socket.id, x: this.player.x, y: this.player.y });
        });

        
    }

    

    createTaskButton() {
        const taskButton = this.add.text(10, 100, "Task", {
            fontFamily: "Arial",
            fontSize: "16px",
            color: "#ffffff",
            backgroundColor: "#000000",
            padding: { x: 10, y: 5 },
        })
            .setInteractive()
            .on("pointerdown", () => {
                this.showTodoForm();
            });
    }

    

    saveTaskToLocalStorage(task: string) {
        const tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
        const newTask = { id: Date.now(), task, done: false };
        tasks.push(newTask);
        localStorage.setItem("tasks", JSON.stringify(tasks));
    
        // Emit updated tasks to the server
        this.socket.emit("updateTasks", { tasks });
        console.log(`Tasks updated and sent to server:`, tasks);
    }

    updateTaskStatus(taskId: number, status: boolean) {
        const username = localStorage.getItem("username") || "Unknown User";
    
        // Update localStorage
        const tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
        const updatedTasks = tasks.map((task: { id: number; task: string; done: boolean }) =>
            task.id === taskId ? { ...task, done: status } : task
        );
        localStorage.setItem("tasks", JSON.stringify(updatedTasks));
    
        // Emit task status update to the server
        if (status) {
            const task = updatedTasks.find((t: { id: number; task: string }) => t.id === taskId);
            this.socket.emit("taskCompleted", {
                username,
                task: task.task,
            });
            console.log(`Task ${taskId} marked as done and notified to others`);
        }
    
        console.log(`Task ${taskId} status updated to ${status}`);
    }

    

    displayTasks() {
        let container = document.getElementById("tasks-container");
    
        // If container doesn't exist, create it
        if (!container) {
            container = document.createElement("div");
            container.id = "tasks-container";
            container.style.position = "absolute";
            container.style.top = "10px";
            container.style.right = "100px";
            container.style.background = "rgba(0, 0, 0, 0.8)";
            container.style.color = "#ffffff";
            container.style.padding = "10px";
            container.style.borderRadius = "5px";
            container.style.zIndex = "1000";
            document.body.appendChild(container);
        }
    
        // Update tasks list
        const tasks = JSON.parse(localStorage.getItem("tasks") || "[]");
        container.innerHTML = "<h3>Tasks:</h3>";
    
        tasks.forEach((task: { id: number; task: string; done: boolean }) => {
            const taskDiv = document.createElement("div");
    
            // Checkbox
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.checked = task.done;
            checkbox.style.marginRight = "10px";
    
            // Task Label
            const label = document.createElement("span");
            label.textContent = task.task;
            label.style.textDecoration = task.done ? "line-through" : "none";
    
            // Checkbox Listener
            checkbox.addEventListener("change", () => {
                this.updateTaskStatus(task.id, checkbox.checked);
                label.style.textDecoration = checkbox.checked ? "line-through" : "none";
            });
    
            taskDiv.appendChild(checkbox);
            taskDiv.appendChild(label);
            container.appendChild(taskDiv);
        });
    }
    


    showTodoForm() {
        const formContainer = document.createElement("div");
        formContainer.style.position = "absolute";
        formContainer.style.top = "50%";
        formContainer.style.left = "50%";
        formContainer.style.transform = "translate(-50%, -50%)";
        formContainer.style.background = "#ffffff";
        formContainer.style.padding = "20px";
        formContainer.style.border = "1px solid #000";
        formContainer.style.borderRadius = "5px";
        formContainer.style.zIndex = "1000";
    
        const taskInput = document.createElement("input");
        taskInput.type = "text";
        taskInput.placeholder = "Enter your task";
        taskInput.style.width = "100%";
        taskInput.style.marginBottom = "10px";
        formContainer.appendChild(taskInput);
    
        const recipientInput = document.createElement("input");
        recipientInput.type = "text";
        recipientInput.placeholder = "Mention recipient username";
        recipientInput.style.width = "100%";
        recipientInput.style.marginBottom = "10px";
        formContainer.appendChild(recipientInput);
    
        const saveButton = document.createElement("button");
        saveButton.textContent = "Save";
        saveButton.style.marginRight = "10px";
        formContainer.appendChild(saveButton);
    
        const shareButton = document.createElement("button");
        shareButton.textContent = "Share";
        shareButton.style.marginRight = "10px";
        formContainer.appendChild(shareButton);
    
        const closeButton = document.createElement("button");
        closeButton.textContent = "Close";
        formContainer.appendChild(closeButton);
    
        document.body.appendChild(formContainer);
    
        saveButton.addEventListener("click", () => {
            const task = taskInput.value.trim();
            if (task) {
                this.saveTaskToLocalStorage(task);
                this.displayTasks();
            }
            document.body.removeChild(formContainer);
        });
    
        shareButton.addEventListener("click", () => {
            const task = taskInput.value.trim();
            const recipient = recipientInput.value.trim();
            if (task && recipient) {
                this.shareTask(task, recipient);
            }
            document.body.removeChild(formContainer);
        });
    
        closeButton.addEventListener("click", () => {
            document.body.removeChild(formContainer);
        });
    }

    shareTask(task: string, recipient: string) {
        const sender = this.socket.id;
        this.socket.emit("shareTask", { task, sender, recipient });
        console.log(`Task shared: ${task} to ${recipient}`);
    }

    showNotification(message: string) {
        const notification = this.add.text(512, 50, message, {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#ffffff",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            padding: { x: 10, y: 5 },
        }).setOrigin(0.5);
    
        // Remove the notification after 3 seconds
        this.time.delayedCall(3000, () => {
            notification.destroy();
        });
    }
}


