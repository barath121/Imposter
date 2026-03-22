
import React, { useState, useCallback, useEffect } from 'react';
import { GameState, Player, Category } from './types';
import { DEFAULT_CATEGORIES, MIN_PLAYERS, MAX_PLAYERS } from './constants';

const Header = () => (
  <header className="py-8 text-center animate-in fade-in zoom-in duration-700">
    <div className="inline-block relative">
      <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500 drop-shadow-xl">
        IMPOSTER
      </h1>
      <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-lg blur opacity-10 animate-pulse"></div>
    </div>
    <p className="text-slate-500 mt-2 uppercase tracking-[0.3em] text-[10px] font-extrabold opacity-70">
      Trust No One • Find The Spy
    </p>
  </header>
);

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.SETUP);
  const [playerCount, setPlayerCount] = useState<number>(4);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(['games']);
  const [wordOverrides, setWordOverrides] = useState<Record<string, string[]>>({});
  const [activePickingCategory, setActivePickingCategory] = useState<string | null>(null);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState<number>(0);
  const [isWordVisible, setIsWordVisible] = useState<boolean>(false);
  const [customWordsInput, setCustomWordsInput] = useState<string>('');
  const [isChaosMode, setIsChaosMode] = useState<boolean>(false);
  const [showChaosInfo, setShowChaosInfo] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const validIds = categories.map(c => c.id);
    setSelectedCategoryIds(prev => prev.filter(id => validIds.includes(id)));
    setWordOverrides(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(id => {
        if (!validIds.includes(id)) delete next[id];
      });
      return next;
    });
  }, [categories]);

  const installApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const startGame = useCallback(() => {
    if (selectedCategoryIds.length === 0) {
      alert("Select at least one category!");
      return;
    }

    const allPlayableWords: string[] = [];
    selectedCategoryIds.forEach(id => {
      const category = categories.find(c => c.id === id);
      if (category) {
        const overrides = wordOverrides[id];
        if (overrides && overrides.length > 0) {
          allPlayableWords.push(...overrides);
        } else {
          allPlayableWords.push(...category.words);
        }
      }
    });
    
    if (allPlayableWords.length === 0) {
      alert("No words available in current selection.");
      return;
    }

    const secretWord = allPlayableWords[Math.floor(Math.random() * allPlayableWords.length)];
    let imposterIndices: number[] = [];

    if (isChaosMode && Math.random() < 0.02) {
      const chaosType = Math.random() < 0.5 ? 'ALL' : 'NONE';
      imposterIndices = chaosType === 'ALL' 
        ? Array.from({ length: playerCount }, (_, i) => i) 
        : [];
    } else {
      imposterIndices = [Math.floor(Math.random() * playerCount)];
    }

    const newPlayers: Player[] = Array.from({ length: playerCount }, (_, i) => ({
      id: i + 1,
      name: `Player ${i + 1}`,
      word: imposterIndices.includes(i) ? 'YOU ARE THE IMPOSTER' : secretWord,
      isImposter: imposterIndices.includes(i),
      hasSeenWord: false
    }));

    setPlayers(newPlayers);
    setCurrentPlayerIndex(0);
    setGameState(GameState.PRE_REVEAL);
    setIsWordVisible(false);
  }, [playerCount, selectedCategoryIds, categories, isChaosMode, wordOverrides]);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(cid => cid !== id);
      }
      return [...prev, id];
    });
  };

  const handleAddCustomWords = () => {
    const newWords = customWordsInput.split(',')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (newWords.length === 0) {
      alert("Enter some words separated by commas!");
      return;
    }

    setCategories(prev => {
      const customIdx = prev.findIndex(c => c.id === 'custom_words_added');
      if (customIdx > -1) {
        const updated = [...prev];
        updated[customIdx] = {
          ...updated[customIdx],
          words: [...new Set([...updated[customIdx].words, ...newWords])]
        };
        return updated;
      } else {
        const newCat: Category = {
          id: 'custom_words_added',
          name: 'Custom',
          words: newWords,
          isCustom: true
        };
        return [...prev, newCat];
      }
    });

    setSelectedCategoryIds(prev => {
      if (!prev.includes('custom_words_added')) return [...prev, 'custom_words_added'];
      return prev;
    });

    setCustomWordsInput('');
  };

  const removeCustomWord = (wordToRemove: string) => {
    setCategories(prev => {
      const updated = prev.map(cat => {
        if (cat.id === 'custom_words_added') {
          return {
            ...cat,
            words: cat.words.filter(w => w !== wordToRemove)
          };
        }
        return cat;
      });
      return updated.filter(cat => cat.id !== 'custom_words_added' || cat.words.length > 0);
    });
    setWordOverrides(prev => {
      const current = prev['custom_words_added'] || [];
      return {
        ...prev,
        'custom_words_added': current.filter(w => w !== wordToRemove)
      };
    });
  };

  const enterWordPicking = (categoryId: string) => {
    setActivePickingCategory(categoryId);
    setGameState(GameState.PICK_WORDS);
  };

  const renderPickWords = () => {
    const category = categories.find(c => c.id === activePickingCategory);
    if (!category) return null;
    const currentSelection = wordOverrides[category.id] || category.words;

    const toggleWord = (word: string) => {
      setWordOverrides(prev => {
        const existing = prev[category.id] || [...category.words];
        if (existing.includes(word)) {
          const next = existing.filter(w => w !== word);
          return { ...prev, [category.id]: next };
        } else {
          return { ...prev, [category.id]: [...existing, word] };
        }
      });
    };

    return (
      <div className="max-w-md mx-auto space-y-6 px-4 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between py-2">
          <button onClick={() => setGameState(GameState.SETUP)} className="text-slate-500 font-black uppercase text-xs tracking-widest transition-colors flex items-center gap-2">
            <span>←</span> Back
          </button>
          <h2 className="text-white font-black text-sm uppercase tracking-widest">{category.name}</h2>
        </div>
        <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-xl shadow-2xl">
          <div className="flex justify-between items-center mb-6 px-1">
            <span className="text-xs font-black uppercase text-slate-500">{currentSelection.length} / {category.words.length} Selected</span>
            <div className="flex gap-4">
              <button onClick={() => setWordOverrides(prev => ({ ...prev, [category.id]: [...category.words] }))} className="text-xs font-black text-orange-500 uppercase">All</button>
              <button onClick={() => setWordOverrides(prev => ({ ...prev, [category.id]: [] }))} className="text-xs font-black text-slate-500 uppercase">Clear</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {category.words.map((word, idx) => {
              const isSelected = currentSelection.includes(word);
              return (
                <button key={`${word}-${idx}`} onClick={() => toggleWord(word)} className={`p-3 rounded-xl border text-xs font-bold text-left transition-all ${isSelected ? 'bg-orange-500/10 border-orange-500 text-white shadow-lg' : 'bg-slate-900/50 border-slate-800 text-slate-600'}`}>
                  {word}
                </button>
              );
            })}
          </div>
        </div>
        <button onClick={() => setGameState(GameState.SETUP)} className="w-full py-5 rounded-3xl bg-white text-slate-950 font-black text-sm uppercase tracking-[0.3em] shadow-xl">DONE</button>
      </div>
    );
  };

  const renderManageCustom = () => {
    const customCategory = categories.find(c => c.id === 'custom_words_added');
    const words = customCategory?.words || [];
    return (
      <div className="max-w-md mx-auto space-y-6 px-4 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between py-2">
          <button onClick={() => setGameState(GameState.SETUP)} className="text-slate-500 font-black uppercase text-xs tracking-widest flex items-center gap-2">
            <span>←</span> Back
          </button>
          <h2 className="text-white font-black text-sm uppercase tracking-widest">Database</h2>
        </div>
        <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-xl shadow-2xl">
          {words.length === 0 ? (
            <div className="py-12 text-center"><p className="text-slate-600 text-xs font-black uppercase">Database Empty</p></div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
              {words.map((word, idx) => (
                <div key={`${word}-${idx}`} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-2xl border border-slate-800/80">
                  <span className="text-slate-200 font-bold text-sm">{word}</span>
                  <button onClick={() => removeCustomWord(word)} className="w-8 h-8 rounded-xl bg-red-900/20 text-red-500 font-black flex items-center justify-center transition-transform active:scale-90 hover:bg-red-600 hover:text-white">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSetup = () => (
    <div className="max-w-md mx-auto space-y-4 pb-12 px-4">
      {/* Player Selection */}
      <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-xl shadow-xl">
        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-4 text-center">Operation Size</label>
        <div className="flex items-center justify-between px-4">
          <button onClick={() => setPlayerCount(Math.max(MIN_PLAYERS, playerCount - 1))} className="w-12 h-12 rounded-2xl bg-slate-900/80 text-xl font-black text-white active:scale-90 border border-slate-700/50 shadow-inner">-</button>
          <div className="text-center">
            <span className="text-5xl font-black text-white tabular-nums drop-shadow-lg leading-none">{playerCount}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Players</p>
          </div>
          <button onClick={() => setPlayerCount(Math.min(MAX_PLAYERS, playerCount + 1))} className="w-12 h-12 rounded-2xl bg-slate-900/80 text-xl font-black text-white active:scale-90 border border-slate-700/50 shadow-inner">+</button>
        </div>
      </div>

      {/* Standard Categories */}
      <div className="bg-slate-800/40 p-6 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-xl shadow-xl">
        <div className="flex justify-between items-center mb-5 px-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Categories</label>
          <div className="flex gap-4">
            <button onClick={() => setSelectedCategoryIds(categories.map(c => c.id))} className="text-[10px] font-black text-orange-500 uppercase hover:underline">Select All</button>
            <button onClick={() => setSelectedCategoryIds([])} className="text-[10px] font-black text-slate-500 uppercase hover:underline">Clear</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {categories.map(cat => {
            const isSelected = selectedCategoryIds.includes(cat.id);
            const hasOverrides = wordOverrides[cat.id] && wordOverrides[cat.id].length < cat.words.length;
            return (
              <div key={cat.id} className="relative group">
                <button
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full p-4 pr-12 rounded-2xl border-2 transition-all text-left h-20 flex flex-col justify-center overflow-hidden ${
                    isSelected ? 'bg-orange-500/10 border-orange-500 text-white shadow-xl shadow-orange-500/5' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-700'
                  }`}
                >
                  <span className="text-sm font-bold truncate block w-full leading-tight">{cat.name}</span>
                  {isSelected && (
                    <span className="text-[8px] opacity-60 uppercase mt-1 font-black tracking-widest block truncate">
                      {wordOverrides[cat.id]?.length ?? cat.words.length} Words
                    </span>
                  )}
                </button>
                {isSelected && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); enterWordPicking(cat.id); }} 
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-orange-500/20 text-xs flex items-center justify-center transition-all z-10 hover:bg-orange-500 hover:text-white"
                  >
                    ⚙️
                  </button>
                )}
                {hasOverrides && isSelected && (
                  <div className="absolute top-2 left-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse shadow-lg shadow-orange-500/50"></div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Words */}
      <div className="bg-gradient-to-br from-indigo-900/20 to-violet-900/20 p-6 rounded-[2.5rem] border border-indigo-500/20 backdrop-blur-xl shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Custom Words</p>
          <button onClick={() => setGameState(GameState.MANAGE_CUSTOM)} className="text-[10px] font-black uppercase text-violet-400 bg-violet-500/10 px-3 py-1 rounded-full border border-violet-500/20">Edit Data →</button>
        </div>
        <div className="flex flex-col gap-3">
          <textarea
            value={customWordsInput}
            onChange={(e) => setCustomWordsInput(e.target.value)}
            placeholder="Word, word, word..."
            className="w-full bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 text-xs font-medium outline-none text-slate-100 placeholder:text-slate-700 min-h-[64px] max-h-[100px] resize-none focus:ring-1 focus:ring-indigo-500/50"
          />
          <button onClick={handleAddCustomWords} className="w-full py-4 bg-indigo-600 rounded-2xl text-xs font-black text-white uppercase active:scale-95 shadow-lg shadow-indigo-950/50">Append Words</button>
        </div>
      </div>

      {/* Chaos Mode */}
      <div className="space-y-2">
        <div className={`p-5 rounded-3xl border transition-all flex items-center justify-between cursor-pointer shadow-lg ${isChaosMode ? 'bg-red-950/20 border-red-500/50 shadow-red-500/10' : 'bg-slate-800/40 border-slate-700/50'}`} onClick={() => setIsChaosMode(!isChaosMode)}>
          <div className="flex items-center gap-3">
             <span className={`text-xs font-black uppercase tracking-widest ${isChaosMode ? 'text-red-400' : 'text-slate-500'}`}>Chaos Mode</span>
             <button onClick={(e) => { e.stopPropagation(); setShowChaosInfo(!showChaosInfo); }} className="w-5 h-5 rounded-full bg-slate-700/50 text-[10px] flex items-center justify-center font-bold text-slate-300">?</button>
          </div>
          <div className={`w-12 h-6 rounded-full relative border transition-colors ${isChaosMode ? 'bg-red-600 border-red-400' : 'bg-slate-900 border-slate-700'}`}>
            <div className={`absolute top-1 bottom-1 w-4 rounded-full transition-all ${isChaosMode ? 'right-1 bg-white' : 'left-1 bg-slate-600'}`} />
          </div>
        </div>
        {showChaosInfo && (
          <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-300">
            <p className="text-[10px] font-bold text-slate-400 leading-relaxed uppercase tracking-tight">
              A 2% chance per game that either <span className="text-red-400">EVERYONE is the imposter</span> or <span className="text-orange-400">NO ONE is the imposter</span>. The secret word remains hidden from the non-imposters. Trust no one!
            </p>
          </div>
        )}
      </div>

      <button onClick={startGame} className="w-full py-6 rounded-[2.5rem] bg-gradient-to-r from-red-600 via-orange-600 to-orange-500 text-white font-black text-2xl active:scale-95 shadow-2xl shadow-orange-950/40 border-t border-white/20 uppercase tracking-tighter">START GAME</button>
    </div>
  );

  const renderPreReveal = () => (
    <div className="max-w-md mx-auto text-center space-y-10 animate-in fade-in zoom-in-95 mt-8 px-4">
      <div className="space-y-4">
        <p className="text-slate-500 uppercase tracking-[0.4em] text-xs font-black opacity-60">Pass the phone to</p>
        <h2 className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl">{players[currentPlayerIndex].name}</h2>
      </div>
      <div className="relative p-16 bg-slate-800/20 rounded-full border-2 border-dashed border-slate-700/50 w-fit mx-auto shadow-2xl">
        <span className="text-8xl block animate-bounce drop-shadow-2xl">📱</span>
        <div className="absolute inset-0 bg-orange-500/5 blur-3xl rounded-full -z-10"></div>
      </div>
      <button onClick={() => setGameState(GameState.REVEALING)} className="w-full py-7 rounded-[2.5rem] bg-white text-slate-950 font-black text-2xl shadow-2xl active:scale-95 transition-transform">I AM READY</button>
    </div>
  );

  const renderRevealing = () => (
    <div className="max-w-md mx-auto text-center space-y-10 animate-in fade-in mt-8 px-4">
      <div className="space-y-2">
        <h3 className="text-orange-500 font-black uppercase text-xs tracking-[0.3em]">{players[currentPlayerIndex].name}</h3>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest opacity-60">Tap to reveal identity</p>
      </div>
      <div onClick={() => setIsWordVisible(!isWordVisible)} className={`relative h-[26rem] rounded-[3.5rem] cursor-pointer transition-all duration-500 flex items-center justify-center overflow-hidden border-2 shadow-2xl ${isWordVisible ? 'bg-white border-white' : 'bg-slate-900 border-slate-800 hover:border-slate-700'}`}>
        {isWordVisible ? (
          <div className="text-center p-8 animate-in zoom-in-90 duration-300">
            <p className="text-[10px] font-black uppercase tracking-[0.6em] text-slate-400 mb-6 opacity-60">Assignment</p>
            <span className={`text-5xl font-black leading-tight tracking-tighter ${players[currentPlayerIndex].isImposter ? 'text-red-600' : 'text-slate-950'}`}>{players[currentPlayerIndex].word}</span>
          </div>
        ) : (
          <div className="text-center opacity-30 group">
            <div className="text-9xl mb-6 grayscale group-hover:grayscale-0 transition-all duration-700 transform group-hover:scale-110">🕵️</div>
            <p className="font-black text-sm uppercase tracking-[0.5em]">Hold to Reveal</p>
          </div>
        )}
      </div>
      {isWordVisible && (
        <button onClick={() => {
          if (currentPlayerIndex < playerCount - 1) {
            setCurrentPlayerIndex(prev => prev + 1);
            setGameState(GameState.PRE_REVEAL);
            setIsWordVisible(false);
          } else {
            setGameState(GameState.DISCUSSION);
          }
        }} className="w-full py-6 rounded-[2.5rem] bg-orange-600 text-white font-black text-xl shadow-2xl active:scale-95 transition-transform animate-in slide-in-from-bottom-4">I'VE SEEN IT</button>
      )}
    </div>
  );

  const renderDiscussion = () => (
    <div className="max-w-md mx-auto text-center space-y-10 animate-in fade-in zoom-in-95 mt-8 px-4">
      <div className="space-y-4">
        <div className="inline-block px-4 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black tracking-widest uppercase mb-2">Live Mission</div>
        <h2 className="text-5xl font-black text-white tracking-tighter">DISCUSSION</h2>
        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest leading-relaxed px-6">Find the spy before they figure out the secret word.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {players.map(p => (
          <div key={p.id} className="p-6 bg-slate-900/60 rounded-[1.8rem] border border-slate-800/80 text-slate-300 font-black text-sm transition-all hover:bg-slate-800 shadow-lg">
            <span className="text-[9px] block opacity-40 uppercase mb-1 tracking-widest">Agent {p.id}</span>
            {p.name}
          </div>
        ))}
      </div>
      <div className="pt-8">
        <button onClick={() => setGameState(GameState.SETUP)} className="w-full py-5 rounded-[2rem] bg-slate-800/50 text-slate-500 font-black text-xs uppercase tracking-[0.4em] border border-slate-700/50 hover:bg-slate-800 hover:text-white transition-all">FINISH MISSION</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative overflow-x-hidden pb-12 selection:bg-orange-500/30">
      <div className="max-w-md mx-auto relative z-20 px-2">
        <Header />
        <main>
          {gameState === GameState.SETUP && renderSetup()}
          {gameState === GameState.PRE_REVEAL && renderPreReveal()}
          {gameState === GameState.REVEALING && renderRevealing()}
          {gameState === GameState.DISCUSSION && renderDiscussion()}
          {gameState === GameState.MANAGE_CUSTOM && renderManageCustom()}
          {gameState === GameState.PICK_WORDS && renderPickWords()}
        </main>
      </div>
      {/* Immersive Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 -left-20 w-[400px] h-[400px] bg-red-600/5 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-0 -right-20 w-[400px] h-[400px] bg-orange-600/5 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '1s'}}></div>
        <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '40px 40px'}}></div>
      </div>
    </div>
  );
};

export default App;
