
import React, { useState, useCallback } from 'react';
import { HorrorShortsGenerator } from './components/HorrorShortsGenerator';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center bg-[#050505] overflow-x-hidden">
      {/* Header */}
      <header className="w-full py-12 px-6 flex flex-col items-center justify-center border-b border-red-950/30 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <h1 className="horror-title text-4xl md:text-6xl text-red-600 tracking-tighter mb-2 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]">
          HORROR SHORTS FORGE
        </h1>
        <p className="text-gray-500 font-light tracking-widest text-sm uppercase">
          Artificial Intelligence / Sinister Cinema / Vertical Nightmares
        </p>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl flex-grow px-4 py-8">
        <HorrorShortsGenerator />
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-red-950/20 text-center text-gray-600 text-xs tracking-widest">
        <p>© 2024 NOCTURNAL ALGORITHMS INC. // POWERED BY GEMINI</p>
      </footer>
    </div>
  );
};

export default App;
