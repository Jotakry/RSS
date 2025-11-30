import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { ArticleList } from './components/ArticleList';
import { Feed, Article } from './types';
import { fetchFeed } from './services/rssService';

const DEFAULT_FEEDS: Feed[] = [
  { id: 'default-irozhlas', title: 'iRozhlas', url: 'https://www.irozhlas.cz/rss/irozhlas' },
  { id: 'default-lupa', title: 'Lupa.cz', url: 'https://www.lupa.cz/rss/clanky/' },
  { id: 'default-verge', title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { id: 'default-cc', title: 'CzechCrunch', url: 'https://cc.cz/feed/' }
];

const DEFAULT_TOPICS = [
  'AI', 'Apple', 'Google', 'Microsoft', 'Tesla', 'Česko', 'Politika', 'Věda', 'Byznys', 'Startupy'
];

export default function App() {
  const [feeds, setFeeds] = useState<Feed[]>(() => {
    try {
      const saved = localStorage.getItem('rss_feeds');
      return saved ? JSON.parse(saved) : DEFAULT_FEEDS;
    } catch (e) {
      console.error("Failed to parse feeds from storage", e);
      return DEFAULT_FEEDS;
    }
  });
  
  const [topics, setTopics] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('rss_topics');
      if (!saved) return DEFAULT_TOPICS;
      const parsed = JSON.parse(saved);
      // Validace, že jde o pole stringů
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
        return parsed;
      }
      return DEFAULT_TOPICS;
    } catch (e) {
      return DEFAULT_TOPICS;
    }
  });

  // Load refresh interval from storage, default to 0 (manual/off)
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('rss_refresh_interval');
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  // Load visited links
  const [visitedLinks, setVisitedLinks] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('rss_visited');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('rss_notifications_enabled');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  // Reference to track known articles for notification diffing
  // We use a ref so we can update it without triggering re-renders or stale closures in the interval
  const knownArticleLinksRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  // Toggle for hiding read articles
  const [hideRead, setHideRead] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [filterKeywords, setFilterKeywords] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // States for adding new topic inline
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [newTopicInput, setNewTopicInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist feeds
  useEffect(() => {
    localStorage.setItem('rss_feeds', JSON.stringify(feeds));
  }, [feeds]);

  // Persist topics
  useEffect(() => {
    localStorage.setItem('rss_topics', JSON.stringify(topics));
  }, [topics]);

  // Persist refresh interval
  useEffect(() => {
    localStorage.setItem('rss_refresh_interval', refreshInterval.toString());
  }, [refreshInterval]);

  // Persist notifications setting
  useEffect(() => {
    localStorage.setItem('rss_notifications_enabled', notificationsEnabled.toString());
  }, [notificationsEnabled]);

  // Focus input when adding topic
  useEffect(() => {
    if (isAddingTopic && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isAddingTopic]);

  const markAsVisited = (link: string) => {
    setVisitedLinks(prev => {
      const newSet = new Set(prev);
      newSet.add(link);
      localStorage.setItem('rss_visited', JSON.stringify(Array.from(newSet)));
      return newSet;
    });
  };

  const clearVisitedHistory = () => {
    setVisitedLinks(new Set());
    localStorage.removeItem('rss_visited');
  };

  const toggleNotifications = async () => {
    if (!notificationsEnabled) {
      // Trying to enable
      if (!("Notification" in window)) {
        alert("Váš prohlížeč nepodporuje notifikace.");
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotificationsEnabled(true);
        new Notification("Upozornění zapnuta", { body: "Nyní budete dostávat zprávy o nových článcích." });
      } else {
        alert("Notifikace byly zamítnuty. Povolte je prosím v nastavení prohlížeče.");
        setNotificationsEnabled(false);
      }
    } else {
      setNotificationsEnabled(false);
    }
  };

  // Refresh articles when feeds change
  const refreshFeeds = useCallback(async () => {
    if (feeds.length === 0) {
      setArticles([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    let allArticles: Article[] = [];
    
    try {
      const promises = feeds.map(feed => fetchFeed(feed.url, feed.id));
      const results = await Promise.allSettled(promises);
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          // Update feed title if it was placeholder or changed
          const feedId = feeds[index].id;
          const { title, articles } = result.value;
          
          setFeeds(currentFeeds => 
            currentFeeds.map(f => f.id === feedId && f.title !== title ? { ...f, title } : f)
          );
          
          allArticles = [...allArticles, ...articles];
        } else {
          console.error(`Failed to fetch feed ${feeds[index].url}:`, result.reason);
        }
      });
      
      // Remove duplicates based on link
      const uniqueArticles = Array.from(new Map(allArticles.map(item => [item.link, item])).values());
      
      // NOTIFICATION LOGIC
      if (!isFirstLoad.current && notificationsEnabled) {
         // Determine truly new articles by checking against the known set
         const newItems = uniqueArticles.filter(a => !knownArticleLinksRef.current.has(a.link));
         
         if (newItems.length > 0) {
             if (newItems.length === 1) {
                 new Notification("Nový článek", { 
                     body: newItems[0].title,
                     icon: newItems[0].thumbnail 
                 });
             } else {
                 new Notification("Nové články", { 
                     body: `Přibylo ${newItems.length} nových článků.` 
                 });
             }
         }
      }

      // Update the known articles ref
      uniqueArticles.forEach(a => knownArticleLinksRef.current.add(a.link));
      
      setArticles(uniqueArticles);
      isFirstLoad.current = false;

    } catch (err) {
      console.error(err);
      setError('Chyba při načítání článků. Zkontrolujte své připojení.');
    } finally {
      setIsLoading(false);
    }
  }, [feeds, notificationsEnabled]);

  // Auto-refresh Interval Effect
  useEffect(() => {
    if (refreshInterval > 0) {
      const intervalId = setInterval(() => {
        refreshFeeds();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, refreshFeeds]);

  // Initial load
  useEffect(() => {
    // Populate the ref with what we have initially (if any) to avoid stale checks if state was hydrated
    if (articles.length > 0) {
         articles.forEach(a => knownArticleLinksRef.current.add(a.link));
         isFirstLoad.current = false;
    }
    refreshFeeds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const addFeed = async (url: string) => {
    const normalizedUrl = url.replace(/\/$/, '');
    
    if (feeds.some(f => f.url.replace(/\/$/, '') === normalizedUrl)) {
      alert('Tento zdroj již máte v seznamu.');
      return;
    }

    setIsLoading(true);
    try {
      const newId = crypto.randomUUID();
      const { title, articles: newArticles } = await fetchFeed(url, newId);
      
      const newFeed: Feed = { id: newId, url, title };
      setFeeds(prev => [...prev, newFeed]);
      
      // Update articles immediately
      setArticles(prev => {
         const combined = [...prev, ...newArticles];
         const unique = Array.from(new Map(combined.map(item => [item.link, item])).values());
         // Update reference
         unique.forEach(a => knownArticleLinksRef.current.add(a.link));
         return unique;
      });
      
    } catch (err: any) {
      console.error(err);
      let msg = 'Nepodařilo se přidat zdroj.';
      if (err.message && err.message.includes('HTML')) {
          msg = 'Chyba: Zadaná URL vrací webovou stránku (HTML), nikoliv RSS feed. Zkuste najít přímý odkaz na RSS/XML.';
      } else if (err.message && err.message.includes('XML')) {
          msg = 'Chyba: Zdroj neposkytuje platné XML.';
      } else if (err.message) {
          msg = `Chyba: ${err.message}`;
      }
      alert(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const removeFeed = (id: string) => {
    setFeeds(prev => prev.filter(f => f.id !== id));
    setArticles(prev => prev.filter(a => a.feedId !== id));
  };

  const toggleFilter = (keyword: string) => {
    if (filterKeywords === keyword) {
      setFilterKeywords('');
    } else {
      setFilterKeywords(keyword);
    }
  };

  const saveNewTopic = () => {
      const trimmed = newTopicInput.trim();
      if (trimmed) {
          if (!topics.includes(trimmed)) {
            setTopics(prev => [...prev, trimmed]);
            setFilterKeywords(trimmed);
          }
      }
      setNewTopicInput("");
      setIsAddingTopic(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          saveNewTopic();
      } else if (e.key === 'Escape') {
          setIsAddingTopic(false);
          setNewTopicInput("");
      }
  };

  const removeTopic = (topicToRemove: string) => {
      setTopics(prev => prev.filter(t => t !== topicToRemove));
      if (filterKeywords === topicToRemove) {
          setFilterKeywords('');
      }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - responsive visibility */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar 
          feeds={feeds} 
          onAddFeed={addFeed} 
          onRemoveFeed={removeFeed}
          isLoading={isLoading} 
          refreshInterval={refreshInterval}
          onSetRefreshInterval={setRefreshInterval}
          onClearHistory={clearVisitedHistory}
          notificationsEnabled={notificationsEnabled}
          onToggleNotifications={toggleNotifications}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col gap-3 sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4 w-full">
             <button 
                className="md:hidden p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                onClick={() => setIsSidebarOpen(true)}
             >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
             </button>
             
             <div className="relative flex-1">
               <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                 </svg>
               </div>
               <input
                 type="text"
                 placeholder="Hledat..."
                 className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg leading-5 bg-slate-50 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors"
                 value={filterKeywords}
                 onChange={(e) => setFilterKeywords(e.target.value)}
               />
             </div>

             <div className="flex items-center gap-1">
                <button
                    onClick={() => setHideRead(!hideRead)}
                    className={`p-2 rounded-full transition-all shrink-0 ${hideRead ? 'bg-blue-100 text-blue-600' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'}`}
                    title={hideRead ? "Zobrazit přečtené" : "Skrýt přečtené"}
                >
                    {hideRead ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    )}
                </button>

                 <button 
                    onClick={refreshFeeds} 
                    disabled={isLoading}
                    className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-full transition-all shrink-0"
                    title="Obnovit"
                 >
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={`w-6 h-6 ${isLoading ? 'animate-spin' : ''}`}>
                     <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                   </svg>
                 </button>
             </div>
          </div>

          {/* Quick Filters (Dynamic Topics) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 w-full px-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">Témata:</span>
            {topics.map(topic => {
              const isActive = filterKeywords === topic;
              return (
                <div
                  key={topic}
                  className={`
                    inline-flex items-center rounded-full border transition-all shrink-0 select-none
                    ${isActive 
                      ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:bg-blue-50'}
                  `}
                >
                  <button
                    type="button"
                    onClick={() => toggleFilter(topic)}
                    className="px-3 py-1 text-xs font-medium focus:outline-none cursor-pointer"
                  >
                    {topic}
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        removeTopic(topic);
                    }}
                    className={`
                      mr-1 p-1 rounded-full transition-colors flex items-center justify-center w-5 h-5 cursor-pointer
                      ${isActive ? 'text-blue-200 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'}
                    `}
                    title="Odebrat téma"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                </div>
              );
            })}
            
            {isAddingTopic ? (
                <div className="flex items-center bg-white border border-blue-500 rounded-full px-3 py-1 shrink-0 h-[26px]">
                    <input 
                        ref={inputRef}
                        type="text"
                        className="text-xs border-none focus:ring-0 w-24 p-0 text-slate-700 placeholder-slate-400 outline-none bg-transparent"
                        placeholder="Nové téma..."
                        value={newTopicInput}
                        onChange={e => setNewTopicInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={saveNewTopic}
                    />
                </div>
            ) : (
                <button
                   type="button"
                   onClick={() => setIsAddingTopic(true)}
                   className="px-2 py-1 text-xs font-bold rounded-full border border-dashed border-slate-300 text-slate-500 hover:bg-slate-100 hover:text-blue-600 hover:border-blue-300 transition-colors shrink-0 focus:outline-none h-[26px] min-w-[30px]"
                   title="Přidat téma"
                >
                  +
                </button>
            )}
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden relative">
           {error && (
             <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-20 shadow-lg">
               <strong className="font-bold">Chyba: </strong>
               <span className="block sm:inline">{error}</span>
             </div>
           )}
           
           <ArticleList 
              articles={articles} 
              feeds={feeds} 
              filterKeywords={filterKeywords}
              visitedLinks={visitedLinks}
              onMarkVisited={markAsVisited}
              hideRead={hideRead}
           />
        </main>
      </div>
    </div>
  );
}