# Hyper Hangman 3D: Cursed 💀

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-red.svg)
![Status](https://img.shields.io/badge/status-live-green.svg)

> **"Choose your fate... before the gallows verify it."**

A next-generation, horror-themed reinvention of the classic Hangman game. Built with **React** and **Three.js**, this project merges immersive 3D visuals with competitive multiplayer mechanics, powered by a real-time "Curse" system.

## 🌟 Features

### 🎮 Immersive 3D Gameplay
- **Dynamic 3D Environment**: A fully rendered, atmospheric gallows scene using **React Three Fiber**.
- **Responsive Camera**: Smart camera positioning that adapts to Mobile, Tablet, and Desktop views automatically.

### ⚔️ Competitive Multiplayer
- **Live Lobbies**: Host or join rituals (games) instantly with room codes.
- **Real-time Synchronization**: Instant updates on guesses, health, and player status.

### 🔮 The Curse System (Points & Powers)
Strategic layers beyond simple guessing:
- **Earn Curse Points (CP)**:
    - **+3 CP** for Correct Guesses.
    - **+3 CP** for Streaks (2+ correct in a row).
    - **+4 CP** for Multi-Hits (revealing multiple letters at once).
- **Cast Dark Powers**:
    - **FOG (15 CP)**: Blind your opponents with a visual fog for 5 seconds.
    - **MIX (20 CP)**: Scramble an opponent's keyboard layout.
    - **HEAL (20 CP)**: Remove a mistake from your tally to stay alive.
    - **SCARE (Winner Only)**: Unleash a jumpscare on the losers.

### 📱 Responsive Design
- Fully optimized for Mobile and Desktop.
- Touch-friendly interfaces and adaptive layouts.

---

## 🛠️ Tech Stack

- **Frontend Framework**: React 18 (Vite)
- **3D Graphics**: Three.js, React Three Fiber, Drei
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **State/Logic**: Custom Hooks for Game Logic & Multiplayer Synchronization
- **Language**: TypeScript

---

## 🚀 Getting Started

Follow these steps to summon the game locally.

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hyper-hangman-cursed.git
   cd hyper-hangman-cursed
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```

4. **Play**
   Open your browser and navigate to `http://localhost:3000`.

---

## 📖 The Ritual Guide (How to Play)

1. **Enter the Ritual**: Choose "ENTER RITUAL" from the main menu.
2. **Host or Join**: Create a new lobby or paste a code to join a friend.
3. **Survive**:
    - You have **6 Mistakes** before the game ends.
    - Guess letters to reveal the hidden word.
    - Use your **Curse Points** wisely to sabotage rivals or heal yourself.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any features, bug fixes, or dark rituals you'd like to add.

---

*Verified by the Council of the Cursed.* 🩸
