# 🎲 City Conquest (Eraser Wars)

A turn-based 4-player multiplayer isometric strategy web game inspired by the classic school desk eraser-flipping and territory conquest game. Built with **React (Vite + Tailwind CSS)**, **Three.js (React Three Fiber)**, **Rapier 3D Physics Engine**, and **Node.js (Socket.io)**.

---

## 🎮 How to Play

- **4-Player Turn-Based Conquest:** Players take turns competing on a procedurally generated paper map.
- **Starting Phase:** Each player freely picks an unclaimed territory to establish their initial base.
- **On Your Turn:** Select one of your territories, then pick an adjacent territory to make a move:
  - **Claim Unowned Land (Eraser Toss):** Roll the 3D eraser (3 faces are **Win**, 3 faces are **Lose**). Landing on **W** claims the land; **L** leaves it unclaimed.
  - **Attack Enemy Territory (Rock-Paper-Scissors):** Duel the defending player in a live Rock-Paper-Scissors match. If you win, you conquer their territory. If you lose, you surrender your adjacent launching territory to them!
- **Winning Condition:** A player wins by capturing **80% of the map** or by being the **last player standing**. Eliminated players can stay and watch in Spectator mode.
- **CK3-Style Camera & Mobile View:** 
  - Zoom in/out to switch smoothly between a 3D isometric desk view and a top-down paper map overview.
  - Includes a lightweight 2D SVG paper mode optimized for mobile browsers.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/KandemirKerem/city-conquest.git
   cd city-conquest
   ```

2. **Install dependencies:**
   ```bash
   npm run install:all
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in your browser:**
   - Client: `http://localhost:5173`
   - Server: `http://localhost:3001`
