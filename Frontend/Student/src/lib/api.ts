import axios from "axios";

const apiClient = axios.create({
  baseURL: "https://api.gurubhet.tech/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export default apiClient;
