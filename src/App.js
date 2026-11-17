import React, { useState } from "react";
import Login from "./components/Login";
import Register from "./components/Register";
import { Chat } from "./components/Chat";

import "bootstrap/dist/js/bootstrap.min.js";
import "bootstrap/dist/css/bootstrap.min.css";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const App = () => {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState("register");

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setCurrentPage("login");

    toast.success("Logged out successfully!");
  };

  return (
    <div className="app">
      {!user ? (
        <div className="container mt-5 text-center">
          <div className="row justify-content-center">
            <div className="col-md-6">
              {currentPage === "register" ? (
                <Register setCurrentPage={setCurrentPage} />
              ) : (
                <Login setUser={setUser} />
              )}

              {currentPage === "register" ? (
                <p className="mt-3">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setCurrentPage("login")}
                    className="btn btn-link"
                  >
                    Login
                  </button>
                </p>
              ) : (
                <p className="mt-3">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setCurrentPage("register")}
                    className="btn btn-link"
                  >
                    Register
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <Chat user={user} onLogout={handleLogout} />
      )}

      {/* Global Toast Notifications */}
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="colored"
      />
    </div>
  );
};

export default App;
