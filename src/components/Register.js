import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const Register = ({ setCurrentPage }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const response = await axios.post("http://localhost:5001/auth/register", {
        username,
        password,
      });

      toast.success("You are registered successfully. Proceed to login.");

      // Redirect to Login after successful registration
      setTimeout(() => {
        setCurrentPage("login");
      }, 1500);
    } catch (error) {
      console.error(error);

      toast.error(error.response?.data?.message || "Error registering user");
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
