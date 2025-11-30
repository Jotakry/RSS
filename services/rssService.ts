import { Article, Feed } from '../types';

// Custom error to handle HTML responses that might contain feed links
class FeedDiscoveryError extends Error {
  htmlContent: string;
  originalUrl: string;
  constructor(message: string, htmlContent: string, originalUrl: string) {
    super(message);
    this.name = "FeedDiscoveryError";
    this.htmlContent = htmlContent;
    this.originalUrl = originalUrl;
  }
}

// List of CORS proxies to try in order for raw XML fetching.
const PROXIES = [
  // AllOrigins - usually most reliable
  (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}&t=${Date.now()}`,
  // CodeTabs
  (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  // Yacdn
  (url: string) => `https://yacdn.org/proxy/${url}`,
  // ThingProxy
  (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
];

/**
 * Attempts to fetch raw text content using a rotation of CORS proxies.
 */
async function fetchRawText(url: string): Promise<string> {
  let lastError: any;

  for (const createProxyUrl of PROXIES) {
    try {
      const proxyUrl = createProxyUrl(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch(proxyUrl, { 
        signal: controller.signal,
        headers: { 
            'Accept': 'application/rss+xml, application/xml, text/xml, text/html, */*',
            'User-Agent': 'RSS-Reader-App/1.0'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const text = await response.text();
      
      if (!text || text.trim().length === 0) {
          throw new Error('Empty response');
      }

      return text;
    } catch (err) {
      lastError = err;
    }
  }
  
  throw lastError || new Error('Failed to fetch feed from all proxies');
}

/**
 * Parses raw XML string into Article objects.
 * Throws FeedDiscoveryError if HTML is detected.
 */
function parseXmlFeed(text: string, feedId: string, originalUrl: string): { title: string; articles: Article[] } {
    // Remove Byte Order Mark (BOM)
    text = text.replace(/^\uFEFF/, '');
    const trimmed = text.trim();

    // STRICT VALIDATION: Check if content is HTML
    const lowerText = trimmed.toLowerCase();
    const isHtml = lowerText.startsWith('<!doctype html') || lowerText.startsWith('<html');
    const isRss = lowerText.includes('<rss') || lowerText.includes('<feed') || lowerText.includes('<rdf:rdf'); 
    
    // If it is HTML and definitely not RSS/Atom
    if (isHtml && !isRss) {
         throw new FeedDiscoveryError('Received HTML page instead of XML', text, originalUrl);
    }

    try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(text, 'text/xml');
        
        const errorNode = xml.querySelector('parsererror');
        if (errorNode) {
             // If parser failed, it might still be HTML disguised
             if (trimmed.includes('<html') || trimmed.includes('<body')) {
                throw new FeedDiscoveryError('XML Parsing failed, content looks like HTML', text, originalUrl);
             }
             throw new Error(`XML Parser Error: ${errorNode.textContent}`);
        }

        const title = xml.querySelector('channel > title, feed > title')?.textContent || 'Neznámý zdroj';
        
        const items = Array.from(xml.querySelectorAll('item, entry'));
        
        const articles: Article[] = items.map(item => {
            const itemTitle = item.querySelector('title')?.textContent || 'Bez názvu';
            
            // Link handling (RSS vs Atom)
            let link = item.querySelector('link')?.textContent || '';
            if (!link) {
                const linkNode = item.querySelector('link');
                if (linkNode && linkNode.getAttribute('href')) {
                    link = linkNode.getAttribute('href')!;
                }
            }

            const pubDate = item.querySelector('pubDate, published, updated, date')?.textContent || new Date().toISOString();
            
            // Content handling
            const contentEncoded = item.getElementsByTagNameNS('*', 'encoded')[0]?.textContent;
            const description = item.querySelector('description, summary')?.textContent || '';
            const content = contentEncoded || description || '';

            // Plain text snippet
            const doc = new DOMParser().parseFromString(content, 'text/html');
            const contentSnippet = doc.body.textContent?.slice(0, 300).trim() + (doc.body.textContent && doc.body.textContent.length > 300 ? '...' : '') || '';

            // Thumbnail extraction
            let thumbnail = '';
            const mediaContent = item.getElementsByTagNameNS('*', 'content')[0];
            const enclosure = item.querySelector('enclosure');
            const imgInContent = doc.querySelector('img');
            
            if (mediaContent && mediaContent.getAttribute('url')) {
                thumbnail = mediaContent.getAttribute('url')!;
            } else if (enclosure && enclosure.getAttribute('type')?.startsWith('image')) {
                thumbnail = enclosure.getAttribute('url')!;
            } else if (imgInContent) {
                thumbnail = imgInContent.getAttribute('src')!;
            }

            return {
                id: crypto.randomUUID(),
                feedId,
                title: itemTitle,
                link,
                pubDate,
                content,
                contentSnippet,
                thumbnail,
                author: item.querySelector('author, creator')?.textContent || undefined
            };
        });

        return { title, articles };
    } catch (e: any) {
        if (e.name === 'FeedDiscoveryError') throw e;
        throw new Error(`Chyba při parsování XML: ${e.message}`);
    }
}

/**
 * Helper to extract RSS/Atom URLs from an HTML page.
 */
function getFeedUrlFromHtml(html: string, baseUrl: string): string | null {
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const links = doc.querySelectorAll('link[type="application/rss+xml"], link[type="application/atom+xml"]');
        
        if (links.length > 0) {
            const href = links[0].getAttribute('href');
            if (href) {
                // Handle relative URLs
                try {
                    return new URL(href, baseUrl).href;
                } catch {
                    return href;
                }
            }
        }
    } catch (e) {
        console.error("Error parsing HTML for feed discovery", e);
    }
    return null;
}

/**
 * Fallback: Use RSS2JSON API if direct access fails (CORS/Blocking)
 */
async function fetchWithRss2Json(url: string, feedId: string): Promise<{ title: string; articles: Article[] }> {
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl);
    
    if (!res.ok) throw new Error(`RSS2JSON failed with status ${res.status}`);
    
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(`RSS2JSON failed: ${data.message}`);
    
    return {
        title: data.feed.title,
        articles: data.items.map((item: any) => ({
            id: crypto.randomUUID(),
            feedId,
            title: item.title,
            link: item.link,
            pubDate: item.pubDate,
            content: item.content || item.description || '',
            contentSnippet: (item.description || item.content || '').replace(/<[^>]*>/g, '').slice(0, 300),
            thumbnail: item.thumbnail || item.enclosure?.link,
            author: item.author
        }))
    };
}

/**
 * Main function to fetch a feed. 
 * Strategies:
 * 1. Try raw XML fetch via proxies.
 * 2. If HTML is returned, try to discover RSS link inside it.
 * 3. If standard fetch fails, try RSS2JSON API as fallback.
 */
export async function fetchFeed(url: string, feedId: string): Promise<{ title: string; articles: Article[] }> {
    try {
        // Strategy 1: Direct Proxy Fetch
        const text = await fetchRawText(url);
        
        // Parse (throws FeedDiscoveryError if it looks like HTML)
        return parseXmlFeed(text, feedId, url);

    } catch (error: any) {
        console.warn(`Primary fetch failed for ${url}:`, error.message);

        // Strategy 2: Feed Discovery (if we got HTML instead of XML)
        if (error.name === "FeedDiscoveryError") {
             const discoveredUrl = getFeedUrlFromHtml(error.htmlContent, url);
             if (discoveredUrl && discoveredUrl !== url) {
                 console.log(`Discovered feed URL: ${discoveredUrl}`);
                 // Recursive call with new URL
                 return fetchFeed(discoveredUrl, feedId);
             }
        }

        // Strategy 3: Fallback to RSS2JSON
        // We do this if proxy failed (network) OR if parsing failed (bad XML/Cloudflare block)
        console.log(`Attempting RSS2JSON fallback for ${url}`);
        return fetchWithRss2Json(url, feedId);
    }
}