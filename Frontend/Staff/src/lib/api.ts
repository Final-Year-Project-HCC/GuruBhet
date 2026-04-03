import axios from "axios";

// Build API base URL from environment variable or default to production

const apiClient = axios.create({
  baseURL: "https://api.gurubhet.tech/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  // Enable sending cookies with cross-origin requests
  withCredentials: true,
});

export default apiClient;
