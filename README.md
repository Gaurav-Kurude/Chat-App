# Chat App

A real-time chat application that allows users to register, log in, and communicate with other users instantly. Built using React, Node.js, Express.js, MongoDB, and Socket.IO, with features like real-time messaging, typing indicators, timestamps, read receipts, and emoji support.

---
## Demo Link
[Live Demo](https://chat-app-frontend-ashen-five.vercel.app/)

---

## Login

> **Guest**
> Username: `Gaurav`
> Password: `gaurav123`

---
## Quick Start

```
git clone https://github.com/Gaurav-Kurude/Chat-App.git
cd Chat App
npm install
npm start
```

---
## Technologies
- React JS
- React Router
- Node JS
- Express JS
- Mongo DB
- JWT

---

## Demo Video
Watch a Walkthrough (3-5 minutes) of all major features of this app:
[Loom Video](https://drive.google.com/file/d/17xZL0tfYEEaEFf8GEXDrgJSDrb5WfCcd/view?usp=sharing)

---

## Features
**Chat App**
- User Registration & Login (JWT Authentication)
- Real-Time Messaging (Socket.IO)
- Online User Listing
- Live Typing Indicators
- Message Timestamps
- Message Read Receipts
- Emoji Support
- Responsive UI (Mobile & Desktop)

---
## API Reference

### **Post /api/auth/register**<br>
Register user<br>
Sample Response:<br>
```
{
    "message": "User created successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YWY1Nzg3YmU2ZDMyZTc2ZTk1NDUyMDkiLCJpYXQiOjE3OTQ0NzIwNTksImV4cCI6MTc5NDU1ODQ1OX0.ok__URX6epVFkZm7oMEA_A-wW_N1O0YpYR-iuqLVA9Q",
    "username": "Joe"
}
```

### **Post /api/auth/login**<br>
Login user<br>
Sample Response:<br>
```
{
    "message": "Login successful",
    "username": "Joe"
}
```

## Contact
For bugs or feature request, please reach out to gauravkurude.sitmech@gmail.com
