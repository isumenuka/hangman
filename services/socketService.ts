import { io, Socket } from "socket.io-client";

// Define the structure of an action if strictly needed, or keep generic
// Matching the existing "NetworkAction" from types.ts is ideal.
import { NetworkAction } from '../types';

class SocketService {
    public socket: Socket | null = null;

    public connect(url: string, roomId?: string) {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io(url, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });

        this.socket.on("connect", () => {
            console.log("Socket connected:", this.socket?.id);
            if (roomId) {
                this.joinRoom(roomId);
            }
        });

        this.socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason);
        });

        this.socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });
    }

    public joinRoom(roomId: string) {
        if (this.socket) {
            this.socket.emit("join_room", roomId);
        }
    }

    public createRoom(roomId: string) {
        if (this.socket) {
            this.socket.emit("create_room", roomId);
        }
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    public emitAction(roomId: string, action: NetworkAction) {
        if (this.socket) {
            this.socket.emit("game_action", { roomId, action });
        }
    }

    public onAction(callback: (action: NetworkAction) => void) {
        if (this.socket) {
            this.socket.on("game_action", callback);
        }
    }

    public offAction() {
        if (this.socket) {
            this.socket.off("game_action");
        }
    }
}

export const socketService = new SocketService();
