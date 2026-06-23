require("dotenv").config();
const express  = require("express");
const cors     = require("cors");
const http     = require("http");
const { Server } = require("socket.io");
const path     = require("path");

// Initialise Firebase Admin (must be required before any controller)
require("./config/firebase");

const app        = express();
const httpServer = http.createServer(app);

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Attach io instance to every request so controllers can emit events
app.use((req, _res, next) => { req.io = io; next(); });

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Each logged-in user joins their own room (user_<uid>) so the backend
  // can push notifications directly to them
  socket.on("joinRoom", (uid) => {
    socket.join(`user_${uid}`);
    console.log(`Socket ${socket.id} joined room user_${uid}`);
  });

  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve the frontend from the /client directory
app.use(express.static(path.join(__dirname, "..", "client")));

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",     require("./routes/auth"));
app.use("/api/crops",    require("./routes/crops"));
app.use("/api/contacts", require("./routes/contacts"));
app.use("/api/admin",    require("./routes/admin"));
app.use("/api/prices",   require("./routes/prices"));

// ─── SPA catch-all: send index.html for any non-API route ────────────────────
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`FarmConnect server running on http://localhost:${PORT}`);
  console.log(`Database: Firebase Firestore`);
  console.log(`Auth:     Firebase Authentication`);
});
