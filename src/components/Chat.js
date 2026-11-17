import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";
import MessageList from "./MessageList";
import "./chat.css";

// =================================
// API AND SOCKET CONNECTION
// =================================

const API_URL = "https://chat-app-backend-red-sigma.vercel.app";

const socket = io(API_URL, {
  transports: ["websocket", "polling"],
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("Socket connected successfully:", socket.id);
});

socket.on("connect_error", (error) => {
  console.error("Socket connection error:", error.message);
});

socket.on("disconnect", (reason) => {
  console.log("Socket disconnected:", reason);
});

// =================================
// MESSAGE STATUS ORDER
// =================================

const statusOrder = {
  sent: 1,
  delivered: 2,
  read: 3,
};

// =================================
// GET USER ID
// =================================

const getUserId = (value) => {
  if (!value) return "";

  if (typeof value === "object") {
    return String(value._id || value.id || value.userId || "");
  }

  return String(value);
};

// =================================
// HELPERS
// =================================

const getInitials = (username = "") => {
  if (typeof username !== "string" || !username.trim()) {
    return "?";
  }

  return username
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

const formatTime = (date) => {
  if (!date) return "";

  return new Date(date).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const sortMessages = (items) => {
  return [...items].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
  );
};

const markAsDelivered = (messageId) => {
  if (!messageId || !socket.connected) return;

  socket.emit("message_delivered", { messageId });
};

const markAsRead = (messageId) => {
  if (!messageId || !socket.connected) return;

  socket.emit("message_read", { messageId });
};

// =================================
// CHAT COMPONENT
// =================================

export const Chat = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // ONLINE USERS
  const [onlineUsers, setOnlineUsers] = useState([]);

  const typingTimeoutRef = useRef(null);
  const fetchRequestRef = useRef(0);
  const messageInputRef = useRef(null);
  const currentChatRef = useRef(currentChat);

  currentChatRef.current = currentChat;

  const currentUserId = getUserId(user);

  // =================================
  // GENERATE ROOM ID
  // =================================

  const getRoomId = useCallback(
    (receiver) => [getUserId(user), getUserId(receiver)].sort().join("_"),
    [user],
  );

  // =================================
  // SOCKET CONNECTION
  // =================================

  useEffect(() => {
    const onConnect = () => {
      setIsConnected(true);
    };

    const onDisconnect = () => {
      setIsConnected(false);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);

    const token = localStorage.getItem("token");

    if (!token) {
      console.error("No auth token found. Please log in again.");
    } else {
      socket.auth = { token };

      if (!socket.connected) {
        socket.connect();
      }
    }

    setIsConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);

      clearTimeout(typingTimeoutRef.current);

      socket.disconnect();
    };
  }, []);

  // =================================
  // ONLINE / OFFLINE PRESENCE
  // =================================

  useEffect(() => {
    if (!currentUserId) return;

    const token = localStorage.getItem("token");

    if (!token) {
      console.error("Presence: JWT token not found");
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    let isActive = true;
    let isRefreshing = false;

    const refreshPresence = async () => {
      if (!isActive || isRefreshing) return;

      isRefreshing = true;

      try {
        // STEP 1: Update current user's lastSeen
        const heartbeatResponse = await axios.post(
          `${API_URL}/presence/heartbeat`,
          {},
          { headers },
        );

        console.log("Heartbeat successful:", heartbeatResponse.data);

        if (!isActive) return;

        // STEP 2: Get all online users
        const presenceResponse = await axios.get(`${API_URL}/presence`, {
          headers,
        });

        if (!isActive) return;

        const receivedIds = presenceResponse.data?.onlineUserIds;

        if (!Array.isArray(receivedIds)) {
          console.error("Invalid presence response:", presenceResponse.data);
          return;
        }

        // STEP 3: Normalize MongoDB IDs
        const onlineIds = receivedIds
          .map((id) => getUserId(id))
          .filter(Boolean);

        setOnlineUsers(onlineIds);

        console.log("Current online user IDs:", onlineIds);
        console.log("Current user ID:", currentUserId);
      } catch (error) {
        console.error(
          "Presence error:",
          error.response?.status,
          error.response?.data || error.message,
        );
      } finally {
        isRefreshing = false;
      }
    };

    // Run immediately
    refreshPresence();

    // Refresh every 10 seconds
    const intervalId = setInterval(refreshPresence, 10000);

    // Refresh when browser tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshPresence();
      }
    };

    window.addEventListener("focus", refreshPresence);

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isActive = false;

      clearInterval(intervalId);

      window.removeEventListener("focus", refreshPresence);

      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentUserId]);

  // =================================
  // FETCH USERS
  // =================================

  useEffect(() => {
    if (!currentUserId) return;

    let isActive = true;
    let isFetching = false;

    const fetchUsers = async () => {
      if (isFetching) return;

      isFetching = true;

      try {
        const { data } = await axios.get(`${API_URL}/users`, {
          params: { currentUserId },
        });

        const userList = Array.isArray(data)
          ? data
          : data?.users || data?.data || [];

        if (!Array.isArray(userList)) return;

        const validUsers = userList.filter((u) => {
          const userId = getUserId(u);

          return (
            u &&
            userId &&
            userId !== currentUserId &&
            typeof u.username === "string" &&
            u.username.trim().length > 0
          );
        });

        if (isActive) {
          setUsers(validUsers);
        }
      } catch (error) {
        console.error(
          "Fetch users error:",
          error.response?.data || error.message,
        );
      } finally {
        isFetching = false;
      }
    };
    fetchUsers();

    // Automatically discover newly registered users
    const intervalId = setInterval(fetchUsers, 5000);

    return () => {
      isActive = false;
      clearInterval(intervalId);
    };
  }, [currentUserId]);

  // =================================
  // JOIN ALL CONVERSATION ROOMS
  // =================================

  useEffect(() => {
    if (!user || users.length === 0) return;

    const joinAllRooms = () => {
      users.forEach((otherUser) => {
        socket.emit("joinRoom", getRoomId(otherUser));
      });
    };

    socket.on("connect", joinAllRooms);

    if (socket.connected) {
      joinAllRooms();
    }

    return () => {
      socket.off("connect", joinAllRooms);
    };
  }, [users, user, getRoomId]);

  // =================================
  // MESSAGE STATUS UPDATES
  // =================================

  useEffect(() => {
    const handleMessageStatusUpdate = (updatedMessage) => {
      const messageId = updatedMessage._id || updatedMessage.messageId;

      if (!messageId) return;

      setMessages((previousMessages) =>
        previousMessages.map((message) => {
          if (String(message._id) !== String(messageId)) {
            return message;
          }

          const oldStatus = message.status || "sent";
          const newStatus = updatedMessage.status || oldStatus;

          const finalStatus =
            (statusOrder[newStatus] || 0) >= (statusOrder[oldStatus] || 0)
              ? newStatus
              : oldStatus;

          return {
            ...message,
            ...updatedMessage,
            status: finalStatus,
            deliveredAt: updatedMessage.deliveredAt || message.deliveredAt,
            readAt: updatedMessage.readAt || message.readAt,
          };
        }),
      );
    };

    socket.on("message_status_update", handleMessageStatusUpdate);

    return () => {
      socket.off("message_status_update", handleMessageStatusUpdate);
    };
  }, []);

  // =================================
  // RECEIVE MESSAGES
  // =================================

  useEffect(() => {
    if (!user) return;

    const handleReceiveMessage = (data) => {
      console.log("========== MESSAGE RECEIVED ==========");
      console.log("Received message:", data);
      console.log("Sender:", getUserId(data.sender));
      console.log("Receiver:", getUserId(data.receiver));
      console.log("Current user:", currentUserId);
      console.log("======================================");

      const senderId = getUserId(data.sender);
      const receiverId = getUserId(data.receiver);

      const activeChat = currentChatRef.current;
      const activeChatId = getUserId(activeChat);

      const isReceivedMessage =
        receiverId === currentUserId && senderId !== currentUserId;

      if (isReceivedMessage && data._id) {
        markAsDelivered(data._id);
      }

      const isCurrentConversation =
        activeChat &&
        ((senderId === currentUserId && receiverId === activeChatId) ||
          (senderId === activeChatId && receiverId === currentUserId));

      if (!isCurrentConversation) return;

      setMessages((previousMessages) => {
        const exists = previousMessages.some(
          (msg) => msg._id && data._id && String(msg._id) === String(data._id),
        );

        if (exists) return previousMessages;

        return sortMessages([...previousMessages, data]);
      });
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [user, currentUserId]);

  // =================================
  // TYPING EVENTS
  // =================================

  useEffect(() => {
    const handleUserTyping = ({ username } = {}) => {
      if (username === currentChatRef.current?.username) {
        setTypingUser(username);
      }
    };

    const handleUserStoppedTyping = () => {
      setTypingUser("");
    };

    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);

    return () => {
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
    };
  }, []);

  // =================================
  // FETCH PREVIOUS MESSAGES
  // =================================

  const fetchMessages = async (receiver) => {
    const receiverId = getUserId(receiver);
    const senderId = currentUserId;

    if (!senderId || !receiverId) {
      console.error("Sender or receiver ID is missing");
      return;
    }

    if (senderId === receiverId) {
      console.error("Cannot open a conversation with yourself");
      return;
    }

    const requestId = ++fetchRequestRef.current;

    clearTimeout(typingTimeoutRef.current);

    if (currentChat) {
      socket.emit("stopTyping", {
        roomId: getRoomId(currentChat),
      });
    }

    setCurrentChat(receiver);
    setMessages([]);
    setCurrentMessage("");
    setTypingUser("");
    setShowEmojiPicker(false);
    setLoadingMessages(true);

    try {
      const { data } = await axios.get(`${API_URL}/messages`, {
        params: {
          sender: senderId,
          receiver: receiverId,
        },
      });

      if (requestId !== fetchRequestRef.current) return;

      const fetchedMessages = Array.isArray(data)
        ? data
        : data.messages || data.data || [];

      const sortedMessages = sortMessages(fetchedMessages);

      setMessages(sortedMessages);

      sortedMessages.forEach((msg) => {
        const isReceivedMessage =
          getUserId(msg.sender) === receiverId &&
          getUserId(msg.receiver) === senderId;

        if (isReceivedMessage && msg.status === "sent") {
          markAsDelivered(msg._id);
        }
      });
    } catch (error) {
      console.error(
        "Error fetching messages:",
        error.response?.data || error.message,
      );

      if (requestId === fetchRequestRef.current) {
        setMessages([]);
      }
    } finally {
      if (requestId === fetchRequestRef.current) {
        setLoadingMessages(false);
      }
    }
  };

  // =================================
  // MARK DELIVERED MESSAGES AS READ
  // =================================

  useEffect(() => {
    if (!currentChat || !user) return;

    const markConversationAsRead = () => {
      if (document.visibilityState !== "visible" || !socket.connected) {
        return;
      }

      messages.forEach((msg) => {
        const isReceivedMessage =
          getUserId(msg.sender) === getUserId(currentChat) &&
          getUserId(msg.receiver) === currentUserId;

        if (isReceivedMessage && msg.status === "delivered") {
          markAsRead(msg._id);
        }
      });
    };

    markConversationAsRead();

    document.addEventListener("visibilitychange", markConversationAsRead);

    return () => {
      document.removeEventListener("visibilitychange", markConversationAsRead);
    };
  }, [messages, currentChat, user, currentUserId]);

  // =================================
  // HANDLE TYPING
  // =================================

  const handleTyping = (e) => {
    const value = e.target.value;

    setCurrentMessage(value);

    if (!currentChat) return;

    const roomId = getRoomId(currentChat);

    clearTimeout(typingTimeoutRef.current);

    if (value.trim().length > 0) {
      socket.emit("typing", {
        roomId,
        username: user.username,
      });

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stopTyping", { roomId });
      }, 2000);
    } else {
      socket.emit("stopTyping", { roomId });
    }
  };

  // =================================
  // EMOJI PICKER
  // =================================

  const handleEmojiClick = (emojiData) => {
    setCurrentMessage((previous) => previous + emojiData.emoji);

    if (currentChat) {
      const roomId = getRoomId(currentChat);

      clearTimeout(typingTimeoutRef.current);

      socket.emit("typing", {
        roomId,
        username: user.username,
      });

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit("stopTyping", { roomId });
      }, 2000);
    }

    setShowEmojiPicker(false);
    messageInputRef.current?.focus();
  };

  // =================================
  // SEND MESSAGE
  // =================================

  const sendMessage = (e) => {
    e?.preventDefault();

    const trimmedMessage = currentMessage.trim();

    if (!trimmedMessage) return;

    if (!currentChat) {
      console.log("Please select a conversation first");
      return;
    }

    if (!socket.connected) {
      console.log("Socket is not connected");
      return;
    }

    const senderId = currentUserId;
    const receiverId = getUserId(currentChat);

    // DEBUG LOGS - ADD HERE
    console.log("Current logged-in user:", user);
    console.log("Current sender ID:", senderId);
    console.log("Selected receiver:", currentChat);
    console.log("Receiver ID:", receiverId);

    if (!senderId || !receiverId) {
      console.error("Sender or receiver ID is missing");
      return;
    }

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      message: trimmedMessage,
    };

    socket.emit("send_message", messageData, (response) => {
      if (response?.success) {
        if (response.message && response.message._id) {
          setMessages((previousMessages) => {
            const exists = previousMessages.some(
              (msg) => String(msg._id) === String(response.message._id),
            );

            if (exists) return previousMessages;

            return sortMessages([...previousMessages, response.message]);
          });
        }

        setCurrentMessage("");
        setShowEmojiPicker(false);

        clearTimeout(typingTimeoutRef.current);

        socket.emit("stopTyping", {
          roomId: getRoomId(currentChat),
        });

        messageInputRef.current?.focus();
      } else {
        console.error("Message sending failed:", response);
      }
    });
  };

  // =================================
  // CLOSE CHAT
  // =================================

  const closeChat = () => {
    if (currentChat) {
      socket.emit("stopTyping", {
        roomId: getRoomId(currentChat),
      });
    }

    fetchRequestRef.current++;

    setCurrentChat(null);
    setMessages([]);
    setCurrentMessage("");
    setTypingUser("");
    setShowEmojiPicker(false);
    setLoadingMessages(false);
  };

  // =================================
  // SEARCH USERS
  // =================================

  const filteredUsers = users.filter((u) => {
    const username = typeof u?.username === "string" ? u.username.trim() : "";

    return username.toLowerCase().includes(searchTerm.trim().toLowerCase());
  });

  // =================================
  // ONLINE STATUS CHECK
  // =================================

  const isUserOnline = (userId) => {
    return onlineUsers.includes(String(userId));
  };

  const isCurrentChatOnline =
    !!currentChat && isUserOnline(getUserId(currentChat));

  // =================================
  // UI
  // =================================

  return (
    <div className="chat-container">
      {/* SIDEBAR */}

      <aside className="chat-sidebar">
        <div className="sidebar-top">
          <div className="my-profile">
            <div className="avatar my-avatar">
              {getInitials(user?.username)}
            </div>

            <h3>My Chat</h3>

            <span className="profile-status">
              {isConnected ? "● Online" : "● Connecting..."}
            </span>
          </div>
        </div>

        <div className="sidebar-title">
          <h2>Chats</h2>
        </div>

        <div className="search-container">
          <span>⌕</span>

          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* USERS LIST */}

        <div className="users-list">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => {
              const userId = getUserId(u);
              const isOnline = isUserOnline(userId);
              const isSelected = getUserId(currentChat) === userId;

              return (
                <div
                  key={userId}
                  className={`chat-user ${isSelected ? "active" : ""}`}
                  onClick={() => fetchMessages(u)}
                >
                  <div className="avatar user-avatar">
                    {getInitials(u.username)}
                  </div>

                  <div className="user-info">
                    <h4>{u.username.trim()}</h4>

                    <div
                      className={`user-status ${
                        isOnline ? "status-online" : "status-offline"
                      }`}
                    >
                      <span
                        className={`status-dot ${
                          isOnline ? "online" : "offline"
                        }`}
                      ></span>

                      <span>{isOnline ? "Online" : "Offline"}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="no-users">No users found</p>
          )}
        </div>
      </aside>

      {/* CHAT WINDOW */}

      <main className="chat-window">
        {currentChat ? (
          <>
            {/* CHAT HEADER */}

            <div className="chat-header">
              <div className="avatar user-avatar">
                {getInitials(currentChat.username)}
              </div>

              <div className="chat-user-info">
                <h4>{currentChat.username}</h4>

                <p
                  className={
                    isCurrentChatOnline ? "status-online" : "status-offline"
                  }
                >
                  {typingUser === currentChat.username
                    ? "typing..."
                    : isCurrentChatOnline
                      ? "online"
                      : "offline"}
                </p>
              </div>

              <div className="chat-header-actions">
                <span title="Search">⌕</span>
                <span title="More options">⋮</span>

                <button onClick={closeChat} title="Close chat">
                  ✕
                </button>
              </div>
            </div>

            {/* MESSAGE LIST */}

            <div className="message-list">
              {loadingMessages ? (
                <p className="text-center mt-3">Loading messages...</p>
              ) : (
                <MessageList
                  messages={messages}
                  user={user}
                  formatTime={formatTime}
                />
              )}
            </div>

            {/* TYPING INDICATOR */}

            <div className="typing-container">
              {typingUser === currentChat.username && (
                <p className="typing-indicator">
                  <span className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                  {typingUser} is typing...
                </p>
              )}
            </div>

            {/* MESSAGE INPUT */}

            <div className="message-field">
              <button
                type="button"
                className="emoji-toggle-btn"
                onClick={() => setShowEmojiPicker((previous) => !previous)}
                title="Choose emoji"
              >
                😊
              </button>

              {showEmojiPicker && (
                <div className="emoji-picker-popup">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width="100%"
                    height={400}
                    previewConfig={{
                      showPreview: false,
                    }}
                  />
                </div>
              )}

              <input
                ref={messageInputRef}
                type="text"
                placeholder="Type a message..."
                value={currentMessage}
                onChange={handleTyping}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(e);
                  }
                }}
              />

              <button
                type="button"
                onClick={sendMessage}
                disabled={!currentMessage.trim() || !isConnected}
                title={isConnected ? "Send message" : "Connecting..."}
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          <div className="welcome-screen">
            <div className="welcome-icon">💬</div>

            <h2>Welcome to My Chat</h2>

            <p>Select a conversation from the sidebar to start messaging.</p>
          </div>
        )}
      </main>
    </div>
  );
};
