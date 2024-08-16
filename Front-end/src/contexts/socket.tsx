import { io, Socket } from "socket.io-client";
import React from "react";
import config from "~/config/config";

const URL = config.apiUrl;
export const socket = io(URL.replace(/\/api$/, ''), { transports: ['websocket'] });
export const SocketContext = React.createContext<Socket | null>(null);
