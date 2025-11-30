import React, { useState } from 'react';
import { Article, Feed } from '../types';
import { summarizeContent } from '../services/geminiService';

interface ArticleListProps {
  articles: Article[];
  feeds: Feed[];
  filterKeywords: string;
  visitedLinks: Set<string>;
  onMarkVisited: (link: string) => void;
  hideRead: boolean;
}

export const ArticleList: React.FC<ArticleListProps> = ({ 
  articles, 
  feeds, 
  filterKeywords,
  visitedLinks,
  onMarkVisited,
  hideRead
}) => {
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});

  // Sorting: Newest first
  const sortedArticles = [...articles].sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

  // Filtering
  const filteredArticles = sortedArticles.filter((article) => {
    // Keyword filter
    if (filterKeywords.trim()) {
        const keywords = filterKeywords.toLowerCase().split(' ').filter(k => k);
        const textToSearch = (article.title + ' ' + article.contentSnippet).toLowerCase();
        const matches = keywords.every(k => textToSearch.includes(k));
        if (!matches) return false;
    }

    // Hide read filter
    if (hideRead && visitedLinks.has(article.link)) {
        return false;
    }

    return true;
  });

  const handleSummarize = async (article: Article) => {
    if (summaries[article.id]) return; // Already summarized
    setSummarizingId(article.id);
    const summary = await summarizeContent(article.content || article.contentSnippet);
    setSummaries(prev => ({ ...prev, [article.id]: summary }));
    setSummarizingId(null);
  };

  const getFeedName = (feedId: string) => {
    return feeds.find(f => f.id === feedId)?.title || 'Neznámý zdroj';
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('cs-CZ', {
        day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (filteredArticles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-16 h-16 mb-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-lg font-medium">Žádné články k zobrazení</p>
        <p className="text-sm">
            {hideRead && visitedLinks.size > 0 
                ? 'Máte skryté přečtené články.' 
                : 'Zkuste přidat zdroj nebo změnit filtr.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 pb-20 overflow-y-auto h-full">
      {filteredArticles.map((article) => {
        const isVisited = visitedLinks.has(article.link);

        return (
          <div key={article.id} className={`bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col h-full overflow-hidden ${isVisited ? 'bg-slate-50/50' : ''}`}>
            {article.thumbnail && (
              <a 
                href={article.link} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="h-40 w-full overflow-hidden bg-slate-100 block group relative"
                onClick={() => onMarkVisited(article.link)}
              >
                <img 
                  src={article.thumbnail} 
                  alt="" 
                  className={`w-full h-full object-cover transition-all duration-500 hover:scale-105 ${isVisited ? 'opacity-80 grayscale-[0.2]' : ''}`} 
                />
              </a>
            )}
            <div className="p-5 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">{getFeedName(article.feedId)}</span>
                  <span className="text-xs text-slate-400 whitespace-nowrap ml-2">{formatDate(article.pubDate)}</span>
              </div>
              
              <a 
                href={article.link} 
                target="_blank" 
                rel="noopener noreferrer" 
                className={`text-lg transition-colors mb-2 leading-tight ${isVisited ? 'text-slate-500 font-medium' : 'font-bold text-slate-800 hover:text-blue-700'}`}
                onClick={() => onMarkVisited(article.link)}
              >
                {article.title}
              </a>
              
              <p className={`text-sm mb-4 line-clamp-3 flex-1 ${isVisited ? 'text-slate-400' : 'text-slate-600'}`}>
                {article.contentSnippet}
              </p>

              {summaries[article.id] && (
                 <div className="mb-4 p-3 bg-indigo-50 rounded-lg text-sm text-indigo-900 border border-indigo-100">
                    <div className="flex items-center gap-2 mb-1 text-indigo-700 font-semibold text-xs uppercase">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576l.813-2.846A.75.75 0 019 4.5zM6 20.25a.75.75 0 01.75.75v.008c0 .414-.336.75-.75.75h-.008a.75.75 0 01-.75-.75V21c0-.414.336-.75.75-.75H6zm13.5-2.25a.75.75 0 01.75.75v.008c0 .414-.336.75-.75.75h-.008a.75.75 0 01-.75-.75V18.75c0-.414.336-.75.75-.75h.008zM19.5 9a.75.75 0 01.75.75v.008c0 .414-.336.75-.75.75h-.008a.75.75 0 01-.75-.75V9.75c0-.414.336-.75.75-.75h.008z" clipRule="evenodd" />
                        </svg>
                        AI Shrnutí
                    </div>
                    <div className="whitespace-pre-line leading-relaxed">{summaries[article.id]}</div>
                 </div>
              )}

              <div className="flex gap-2 mt-auto pt-4 border-t border-slate-100">
                 <button 
                  onClick={() => handleSummarize(article)}
                  disabled={!!summaries[article.id] || summarizingId === article.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors
                    ${summaries[article.id] 
                      ? 'bg-slate-100 text-slate-400 cursor-default' 
                      : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                 >
                   {summarizingId === article.id ? (
                     <>
                      <svg className="animate-spin h-4 w-4 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Generuji...</span>
                     </>
                   ) : (
                     <>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                      </svg>
                      <span>{summaries[article.id] ? 'Shrnuto' : 'Shrnout AI'}</span>
                     </>
                   )}
                 </button>
                 <a 
                  href={article.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  onClick={() => onMarkVisited(article.link)}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm shadow-sm
                    ${isVisited 
                        ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                 >
                   <span>{isVisited ? 'Navštíveno' : 'Číst článek'}</span>
                   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                 </a>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};