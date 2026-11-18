import React, { useEffect, useRef } from "react";

const MessageList = ({ messages, user, formatTime, searchTerm = "" }) => {
  const messagesEndRef = useRef(null);

  // GET USER ID
  const getId = (value) => {
    if (!value) return "";

    if (typeof value === "object") {
      return String(value._id || value.id || value.userId || "");
    }

    return String(value);
  };

  // SEARCH MESSAGES
  const filteredMessages = messages.filter((msg) =>
    String(msg.message || "")
      .toLowerCase()
      .includes(searchTerm.trim().toLowerCase()),
  );

  // AUTO SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, searchTerm]);

  const currentUserId = getId(user);

  return (
    <div className="messages-container">
      {filteredMessages.length === 0 ? (
        <p className="no-messages-found">
          {searchTerm.trim() ? "No messages found" : "No messages yet"}
        </p>
      ) : (
        filteredMessages.map((msg, index) => {
          const senderId = getId(msg.sender);
          const isOwnMessage = senderId === currentUserId;

          const status = ["sent", "delivered", "read"].includes(msg.status)
            ? msg.status
            : "sent";

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

                  {isOwnMessage && (
                    <span
                      className={`message-status ${status}`}
                      title={
                        status === "read"
                          ? "Read"
                          : status === "delivered"
                            ? "Delivered"
                            : "Sent"
                      }
                      aria-label={`Message ${status}`}
                    >
                      {status === "sent" ? "✓" : "✓✓"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
