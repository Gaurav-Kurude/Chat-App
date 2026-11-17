import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const Register = ({ setCurrentPage }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    // Validate input fields
    if (!username.trim() || !password.trim()) {
      toast.error("Please enter username and password.", {
        position: "top-right",
      });
      return;
    }

    try {
      const response = await axios.post(
        "https://chat-app-backend-red-sigma.vercel.app/auth/register",
        {
          username: username.trim(),
          password,
        },
      );

      if (response.data?.alreadyExists) {
        toast.error(
          response.data.message || "User already exist. Please login.",
          {
            position: "top-right",
            autoClose: 3000,
          },
        );
        return;
      }

      toast.success("Registration successful!", {
        position: "top-right",
        autoClose: 3000,
      });

      // Clear input fields
      setUsername("");
      setPassword("");

      // Navigate to login page
      if (setCurrentPage) {
        setCurrentPage("login");
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        "Registration failed. Please try again.";

      // Error toast
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 3000,
      });
    }
  };

  return (
    <div className="card py-5 text-center">
      <div className="card-body px-5">
        <h2>Register</h2>
        <p>Not a user yet? Register here</p>

        <input
          type="text"
          placeholder="Username"
          value={username}
          className="form-control form-control-lg mt-3"
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          className="form-control form-control-lg mt-3"
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          className="btn btn-success btn-lg mt-3"
          onClick={handleRegister}
        >
          Register
        </button>
      </div>
    </div>
  );
};

export default Register;
