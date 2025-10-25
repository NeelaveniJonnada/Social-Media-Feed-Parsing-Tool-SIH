// public/firebase/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyASbSLUeoPI_DB7Uq4NdGSTNR6gUR2rELQ",
  authDomain: "social-media-feed-parsing-tool.firebaseapp.com",
  projectId: "social-media-feed-parsing-tool",
  storageBucket: "social-media-feed-parsing-tool.firebasestorage.app",
  messagingSenderId: "68383745531",
  appId: "1:68383745531:web:4e3b1c79842c7dadd1175e",
  measurementId: "G-QLCB50Y6ZF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
