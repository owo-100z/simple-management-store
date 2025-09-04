import React, { useState } from "react";
import { BrowserRouter as Router } from 'react-router-dom';
import Header from "@/assets/layout/Header";
import AppRouter from "@/assets/layout/Router";

export default function App() {
  return (
    <Router>
      <Header />
      <div id="loading-overlay" className="fixed bg-black/50 z-50 flex items-center justify-center inset-0 hidden">
        <span className="loading loading-spinner loading-lg text-white"></span>
      </div>
      <main className="flex p-6 justify-center">
        <AppRouter/>
      </main>
    </Router>
  );
}