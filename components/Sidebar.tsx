import React, { useState } from 'react';
import { Feed } from '../types';

interface SidebarProps {
  feeds: Feed[];
  onAddFeed: (url: string) => void;
  onRemoveFeed: (id: string) => void;
  isLoading: boolean;
  refreshInterval: number;
  onSetRefreshInterval: (interval: number) => void;
  onClearHistory: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  feeds, 
  onAddFeed, 
  onRemoveFeed, 
  isLoading,
  refreshInterval,
  onSetRefreshInterval,
  onClearHistory,
  notificationsEnabled,
  onToggleNotifications
}) => {
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newFeedUrl.trim()) {
      setIsAdding(true);
      await onAddFeed(newFeedUrl.trim());
      setNewFeedUrl('');
      setIsAdding(false);
    }
  };

  const demoFeeds = [
      { name: 'iRozhlas', url: 'https://www.irozhlas.cz/rss/irozhlas' },
      { name: 'Lupa.cz', url: 'https://www.lupa.cz/rss/clanky/' },
      { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' }
  ];

  return (
    <div className="w-full md:w-80 bg-slate-900 text-slate-300 flex flex-col h-full border-r border-slate-800 shrink-0">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-orange-500">
            <path fillRule="evenodd" d="M3.75 4.5a.75.75 0 01.75-.75h.75c8.284 0 15 6.716 15 15v.75a.75.75 0 01-.75.75h-.75a.75.75 0 01-.75-.75v-.75C18 11.708 13.292 7 7.5 7H6.75a.75.75 0 01-.75-.75V4.5zm0 6a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75v-.75zm0 6a.75.75 0 01.75-.75h.75a.75.75 0 01.75.75v.75a.75.75 0 01-.75.75H4.5a.75.75 0 01-.75-.75v-.75z" clipRule="evenodd" />
          </svg>
          RSS Reader AI
        </h1>
      </div>

      <div className="p-4">
        <form onSubmit={handleSubmit} className="mb-4">
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Přidat nový zdroj</label>
            <div className="flex gap-2">
                <input
                    type="url"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                />
                <button 
                    type="submit" 
                    disabled={isAdding || isLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-2 flex items-center justify-center transition-colors disabled:opacity-50"
                >
                    {isAdding ? (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                    )}
                </button>
            </div>
        </form>

        {feeds.length === 0 && (
            <div className="mb-6">
                 <p className="text-xs text-slate-500 mb-2">Zkuste rychlé přidání:</p>
                 <div className="flex flex-wrap gap-2">
                     {demoFeeds.map(feed => (
                         <button 
                            key={feed.name}
                            onClick={() => onAddFeed(feed.url)}
                            disabled={isLoading}
                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded transition-colors"
                         >
                             + {feed.name}
                         </button>
                     ))}
                 </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Vaše zdroje</label>
        {feeds.length === 0 ? (
            <p className="text-slate-600 text-sm italic">Zatím žádné zdroje.</p>
        ) : (
            <ul className="space-y-1">
            {feeds.map((feed) => (
                <li key={feed.id} className="group flex items-center justify-between p-2 rounded hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></div>
                        <span className="text-sm font-medium truncate" title={feed.title}>{feed.title}</span>
                    </div>
                    <button 
                        onClick={() => onRemoveFeed(feed.id)}
                        className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Odstranit"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
                </li>
            ))}
            </ul>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-800 space-y-4">
         <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">Interval aktualizace</label>
            <select 
                value={refreshInterval} 
                onChange={(e) => onSetRefreshInterval(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 cursor-pointer"
            >
                <option value={0}>Manuálně (Vypnuto)</option>
                <option value={300000}>Každých 5 minut</option>
                <option value={900000}>Každých 15 minut</option>
                <option value={1800000}>Každých 30 minut</option>
                <option value={3600000}>Každou hodinu</option>
            </select>
         </div>

         <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-slate-500">Upozornění na novinky</label>
            <button 
                onClick={onToggleNotifications}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${notificationsEnabled ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
                <span
                    className={`${
                    notificationsEnabled ? 'translate-x-5' : 'translate-x-1'
                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                />
            </button>
         </div>

         <div>
            <button 
                onClick={onClearHistory}
                className="w-full text-xs text-red-400 hover:text-red-300 hover:bg-slate-800 py-2 rounded transition-colors flex items-center justify-center gap-2 border border-slate-800 hover:border-red-900"
            >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                Vymazat historii přečtených
            </button>
         </div>
      </div>

      <div className="p-4 text-xs text-slate-600 text-center">
        Powered by Gemini API
      </div>
    </div>
  );
};