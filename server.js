const { Server } = require("socket.io");

const io = new Server(3001, {
    cors: {
        origin: "*", // Ganti dengan URL aplikasi Anda jika perlu
    },
});

let onlineUsers = []; // Menyimpan daftar pengguna online
const usernameToSocketMap = {}; // Maps usernames to socket IDs


io.on("connection", (socket) => {
    console.log("User connected:", socket.id);
    // console.log(socket,"cek connect")   
    const userTasks = {};

    // Tangani event "joinMeeting"
    socket.on("joinMeeting", (data) => {
        if (
            !data ||
            typeof data !== "object" ||
            !data.username ||
            !data.position ||
            !data.character
        ) {
            console.error(
                `Invalid data received for joinMeeting: ${JSON.stringify(data)}`
            );
            return;
        }
    
        const { username, position, character } = data;
    
        if (username) {
            usernameToSocketMap[username] = socket.id;
        }
    
        // Initialize tasks for the user
        userTasks[socket.id] = userTasks[socket.id] || [];
    
        // Add the user to the onlineUsers list
        onlineUsers.push({ id: socket.id, username, position, character });
        console.log(
            `User joined: ${username}, Position: ${JSON.stringify(
                position
            )}, Character: ${character}`
        );
    
        // Send the current online users list to the new user
        socket.emit("updateUsers", onlineUsers);
    
        // Notify others about the new user
        socket.broadcast.emit("user-joined", {
            id: socket.id,
            username,
            position,
            character,
        });
    });
    

    socket.on("taskStatusUpdate", (data) => {
      const { id, taskId, status, username } = data;

      if (!taskId || typeof status !== "boolean") {
          console.error("Invalid task status update data:", data);
          return;
      }

      console.log(`Task ${taskId} marked as ${status ? "done" : "not done"} by ${username}`);

      // Broadcast task status to all users
      io.emit("taskStatusUpdated", {
          taskId,
          status,
          username,
      });
  });

  socket.on("taskCompleted", (data) => {
    const { username, task } = data;

    if (!username || !task) {
        console.error("Invalid task completion data:", data);
        return;
    }

    console.log(`Task completed by ${username}: ${task}`);

    // Broadcast the task completion message to all players
    io.emit("taskNotification", {
        username,
        task,
        message: `${username} has completed the task: "${task}"`,
    });
});

    // Handle sharing tasks
    socket.on("shareTask", (data) => {
        const { task, sender, recipient } = data;

        if (!task || !sender || !recipient) {
            console.error("Invalid shareTask data:", data);
            return;
        }

        const recipientSocketId = usernameToSocketMap[recipient];

        if (recipientSocketId) {
            io.to(recipientSocketId).emit("taskShared", {
                sender,
                task,
            });
            console.log(`Task shared from ${sender} to ${recipient}`);
        } else {
            console.error(`Recipient username not found: ${recipient}`);
        }
    });

    // Tangani update posisi
    socket.on("updatePosition", (data) => {
        console.log("Position update received:", data);

        const { id, position } = data;

        // Validate the data
        if (
            !id ||
            !position ||
            typeof position.x !== "number" ||
            typeof position.y !== "number"
        ) {
            console.error(`Invalid position data: ${JSON.stringify(data)}`);
            return;
        }

        // Update position in the onlineUsers array
        onlineUsers = onlineUsers.map((user) =>
            user.id === id ? { ...user, position } : user
        );

        console.log("Updated online users:", onlineUsers);

        // Broadcast updated position to all other clients
        socket.broadcast.emit("updatePosition", data);
    });

    // Tangani pesan chat
    socket.on("sendMessage", ({ id, message }) => {
        if (!id || !message) {
            console.error(
                `Invalid data received for sendMessage: id=${id}, message=${message}`
            );
            return;
        }

        io.emit("chatMessage", { id, message });
    });

    // Tangani sinyal WebRTC
    socket.on("webrtc-signal", (data) => {
        if (!data || !data.target || !data.signal) {
            console.error(
                `Invalid data received for webrtc-signal: ${JSON.stringify(
                    data
                )}`
            );
            return;
        }

        io.to(data.target).emit("webrtc-signal", {
            sender: socket.id,
            signal: data.signal,
        });
    });

    socket.on("updateTasks", (data) => {
        const { tasks } = data;
        if (!Array.isArray(tasks)) {
            console.error(`Invalid tasks data: ${JSON.stringify(data)}`);
            return;
        }
    
        // Update the tasks for the current user
        userTasks[socket.id] = tasks;
        console.log(`Tasks updated for user ${socket.id}:`, tasks);
    });

    // Send tasks of a specific user
    socket.on("getTasks", (data) => {
        console.log("getTasks event received:", data);
    
        const { targetId } = data;
    
        if (!targetId) {
            console.error("Invalid targetId for getTasks");
            return;
        }
    
        if (!userTasks[targetId]) {
            console.error(`No tasks found for user ID: ${targetId}`);
            return;
        }
    
        console.log(`Sending tasks for user ${targetId}:`, userTasks[targetId]);
    
        // Emit the tasks back to the requesting client
        socket.emit("receiveTasks", {
            targetId,
            tasks: userTasks[targetId],
        });
    });

    

    // Tangani disconnect
    socket.on("disconnect", () => {
        // Remove disconnected user from the mapping
        for (const [username, socketId] of Object.entries(
            usernameToSocketMap
        )) {
            if (socketId === socket.id) {
                delete usernameToSocketMap[username];
                console.log(`User ${username} disconnected`);
                break;
            }
        }
    });
});

console.log("WebSocket server running on port 3001");

