import React, { useEffect, useRef } from "react";

const MessageList = ({ messages, user, formatTime }) => {
  const messagesEndRef = useRef(null);

  // GET USER ID
  const getId = (value) => {
    if (!value) return "";

    if (typeof value === "object") {
      return String(value._id || value.id || value.userId || "");
    }

    return String(value);
  };

  // AUTO SCROLL TO LATEST MESSAGE
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  const currentUserId = getId(user);

  return (
    <div className="messages-container">
      {messages.map((msg, index) => {
        const senderId = getId(msg.sender);
        const isOwnMessage = senderId === currentUserId;

        const status = ["sent", "delivered", "read"].includes(msg.status)
          ? msg.status
          : "sent";

        // DEBUG MESSAGE STATUS
        if (isOwnMessage) {
          console.log("MESSAGE RENDER:", {
            id: msg._id,
            databaseStatus: msg.status,
            displayedStatus: status,
          });
        }

        return (
          <div
            key={msg._id || index}
            className={`message-row ${isOwnMessage ? "sent" : "received"}`}
          >
            <div
              className={`message-bubble ${
                isOwnMessage ? "sent-bubble" : "received-bubble"
              }`}
            >
              <p className="message-text">{msg.message}</p>

              <div className="message-meta">
                <span className="message-time">
                  {formatTime(msg.createdAt)}
                </span>

                {/* MESSAGE STATUS */}
                {isOwnMessage && (
                  <span className={`message-status ${status}`} title={status}>
                    {status === "sent" ? "✓" : "✓✓"}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
