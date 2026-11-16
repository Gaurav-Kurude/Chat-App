import React, { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";
import axios from "axios";
import EmojiPicker from "emoji-picker-react";
import MessageList from "./MessageList";
import "./chat.css";

// SOCKET CONNECTION
const socket = io("https://chat-app-backend-red-sigma.vercel.app", {
  transports: ["websocket", "polling"],
  autoConnect: true,
});

const API_URL = "https://chat-app-backend-red-sigma.vercel.app";

export const Chat = ({ user }) => {
  const [users, setUsers] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [typingUser, setTypingUser] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);

  // EMOJI PICKER STATE
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const typingTimeoutRef = useRef(null);
  const fetchRequestRef = useRef(0);
  const messageInputRef = useRef(null);

  // Keep latest selected conversation available to socket listeners
  const currentChatRef = useRef(currentChat);
  currentChatRef.current = currentChat;

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
  // GET INITIALS
  // =================================

  const getInitials = (username = "") => {
    return username
      .split(" ")
      .map((word) => word[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  // =================================
  // GENERATE ROOM ID
  // =================================

  const getRoomId = (receiver) => {
    return [getUserId(user), getUserId(receiver)].sort().join("_");
  };

  // =================================
  // FORMAT TIME
  // =================================

  const formatTime = (date) => {
    if (!date) return "";

    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  // =================================
  // SORT MESSAGES
  // =================================

  const sortMessages = (items) => {
    return [...items].sort(
      (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0),
    );
  };

  // =================================
  // MESSAGE STATUS ORDER
  // =================================

  const statusOrder = {
    sent: 1,
    delivered: 2,
    read: 3,
  };

  // =================================
  // MARK AS DELIVERED
  // =================================

  const markAsDelivered = (messageId) => {
    if (!messageId || !socket.connected) {
      console.log("Cannot mark delivered:", {
        messageId,
        connected: socket.connected,
      });
      return;
    }

    console.log("Sending delivery receipt:", messageId);

    socket.emit("message_delivered", { messageId });
  };

  // =================================
  // MARK AS READ
  // =================================

  const markAsRead = (messageId) => {
    if (!messageId || !socket.connected) return;

    console.log("Marking message as read:", messageId);

    socket.emit("message_read", { messageId });
  };

  // =================================
  // SOCKET CONNECTION
  // =================================

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      clearTimeout(typingTimeoutRef.current);
      socket.disconnect();
    };
  }, []);

  // =================================
  // FETCH USERS
  // =================================

  useEffect(() => {
    if (!user) return;

    const fetchUsers = async () => {
      try {
        const { data } = await axios.get(`${API_URL}/users`, {
          params: {
            currentUser: user.username,
          },
        });

        const userList = Array.isArray(data)
          ? data
          : data.users || data.data || [];

        setUsers(userList.filter((u) => getUserId(u) !== getUserId(user)));
      } catch (error) {
        console.error(
          "Error fetching users:",
          error.response?.data || error.message,
        );
      }
    };

    fetchUsers();
  }, [user]);

  // =================================
  // JOIN ALL CONVERSATION ROOMS
  // =================================

  useEffect(() => {
    if (!user || users.length === 0) return;

    const joinAllRooms = () => {
      users.forEach((otherUser) => {
        const roomId = getRoomId(otherUser);

        console.log("Joining conversation room:", roomId);

        socket.emit("joinRoom", roomId);
      });
    };

    socket.on("connect", joinAllRooms);

    if (socket.connected) {
      joinAllRooms();
    }

    return () => {
      socket.off("connect", joinAllRooms);
    };
  }, [users, user]);

  // =================================
  // MESSAGE STATUS UPDATES
  // =================================

  useEffect(() => {
    const handleMessageStatusUpdate = (updatedMessage) => {
      console.log("MESSAGE STATUS RECEIVED:", updatedMessage);

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

          console.log("Updating message:", {
            id: messageId,
            oldStatus,
            newStatus: finalStatus,
          });

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
  // WORKS EVEN ON WELCOME SCREEN
  // =================================

  useEffect(() => {
    if (!user) return;

    const handleReceiveMessage = (data) => {
      const senderId = getUserId(data.sender);
      const receiverId = getUserId(data.receiver);
      const currentUserId = getUserId(user);

      const activeChat = currentChatRef.current;
      const activeChatId = getUserId(activeChat);

      console.log("NEW MESSAGE RECEIVED:", data);

      const isReceivedMessage =
        receiverId === currentUserId && senderId !== currentUserId;

      // Mark as delivered even on welcome screen
      if (isReceivedMessage && data._id) {
        markAsDelivered(data._id);
      }

      const isCurrentConversation =
        activeChat &&
        ((senderId === currentUserId && receiverId === activeChatId) ||
          (senderId === activeChatId && receiverId === currentUserId));

      if (!isCurrentConversation) {
        console.log("Message received while another screen is active.");
        return;
      }

      // Avoid duplicate messages
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
  }, [user]);

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
    const senderId = getUserId(user);

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

      console.log("Previous messages loaded:", sortedMessages);

      sortedMessages.forEach((msg) => {
        const messageSenderId = getUserId(msg.sender);
        const messageReceiverId = getUserId(msg.receiver);

        const isReceivedMessage =
          messageSenderId === receiverId && messageReceiverId === senderId;

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
        const senderId = getUserId(msg.sender);
        const receiverId = getUserId(msg.receiver);

        const isReceivedMessage =
          senderId === getUserId(currentChat) && receiverId === getUserId(user);

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
  }, [messages, currentChat, user]);

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
    const updatedMessage = currentMessage + emojiData.emoji;

    setCurrentMessage(updatedMessage);

    // Trigger the existing typing indicator
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

    // Return focus to message input
    messageInputRef.current?.focus();
  };

  // =================================
  // SEND MESSAGE
  // =================================

  const sendMessage = () => {
    if (!currentMessage.trim() || !currentChat || !socket.connected) {
      return;
    }

    const senderId = getUserId(user);
    const receiverId = getUserId(currentChat);

    if (!senderId || !receiverId) {
      console.error("Sender or receiver ID missing");
      return;
    }

    const messageData = {
      sender: senderId,
      receiver: receiverId,
      message: currentMessage.trim(),
    };

    console.log("Sending message:", messageData);

    socket.emit("send_message", messageData, (response) => {
      console.log("Server response:", response);

      if (!response?.success) {
        console.error("Message sending failed:", response?.message);
        return;
      }

      setCurrentMessage("");
      setShowEmojiPicker(false);
      messageInputRef.current?.focus();
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

  const filteredUsers = users.filter((u) =>
    u?.username?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

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

            <span className="profile-status">● Online</span>
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

        <div className="users-list">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((u) => (
              <div
                key={getUserId(u)}
                className={`chat-user ${
                  getUserId(currentChat) === getUserId(u) ? "active" : ""
                }`}
                onClick={() => fetchMessages(u)}
              >
                <div className="avatar user-avatar">
                  {getInitials(u.username)}
                </div>

                <div className="user-info">
                  <h4>{u.username}</h4>

                  <p>
                    {getUserId(currentChat) === getUserId(u)
                      ? "Conversation selected"
                      : "Start a conversation"}
                  </p>
                </div>
              </div>
            ))
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

                <p>
                  {typingUser === currentChat.username
                    ? "typing..."
                    : "Chat conversation"}
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
              {/* EMOJI BUTTON */}

              <button
                type="button"
                className="emoji-toggle-btn"
                onClick={() => setShowEmojiPicker((previous) => !previous)}
                title="Choose emoji"
              >
                😊
              </button>

              {/* EMOJI PICKER POPUP */}

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

              {/* MESSAGE INPUT */}

              <input
                ref={messageInputRef}
                type="text"
                placeholder="Type a message..."
                value={currentMessage}
                onChange={handleTyping}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage();
                  }
                }}
              />

              {/* SEND BUTTON */}

              <button
                type="button"
                onClick={sendMessage}
                disabled={!currentMessage.trim() || !socket.connected}
                title="Send message"
              >
                ➤
              </button>
            </div>
          </>
        ) : (
          /* WELCOME SCREEN */

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
