// Lesemodus: henter artikkelen og plukker ut selve teksten, uten meny, reklame og annet rot.
'use strict';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', aring: 'å', Aring: 'Å', oslash: 'ø', Oslash: 'Ø', aelig: 'æ', AElig: 'Æ', eacute: 'é', shy: '' };
const decode = s => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e] ?? m);
const strip = s => decode(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const JUNK = /^(les også|les mer|annonse|abonner|bli abonnent|logg inn|del (saken|artikkelen)|publisert|oppdatert|foto:|faksimile|kilde:|this article|sign up|subscribe|advertisement|read more|related:|share this|copyright|©)/i;
const PAY = /(for abonnenter|kun for abonnenter|bli abonnent for å lese|denne artikkelen er for abonnenter|subscribe to (continue|read)|to continue reading|this content is for subscribers)/i;

function jsonLd(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const j = JSON.parse(m[1].trim()); const walk = x => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { out.push(x); if (x['@graph']) walk(x['@graph']); } }; walk(j); } catch {}
  }
  return out.find(x => /Article|NewsArticle|BlogPosting|Report/i.test([].concat(x['@type'] || []).join(' '))) || null;
}
const meta = (html, k) => { const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${k}["'][^>]*>`, 'i')); return m ? decode((m[0].match(/content=["']([^"']*)["']/i) || [])[1] || '') : ''; };

// HTML → artikkel { title, byline, date, img, blocks: [{ t: 'p'|'h'|'q'|'li', text }], paywall }
function extract(html, url) {
  html = String(html).slice(0, 3e6);
  const ld = jsonLd(html);
  const title = strip((ld && ld.headline) || meta(html, 'og:title') || (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const desc = strip((ld && ld.description) || meta(html, 'og:description') || meta(html, 'description'));
  let img = meta(html, 'og:image') || (ld && ld.image && (ld.image.url || (Array.isArray(ld.image) ? (ld.image[0].url || ld.image[0]) : ld.image))) || '';
  if (typeof img !== 'string') img = '';
  if (img.startsWith('//')) img = 'https:' + img;
  if (!/^https:\/\//.test(img)) img = '';
  const author = ld && ld.author ? [].concat(ld.author).map(a => typeof a === 'string' ? a : a && a.name).filter(Boolean).slice(0, 3).join(', ') : meta(html, 'author');
  const date = (ld && (ld.datePublished || ld.dateModified)) || meta(html, 'article:published_time') || null;
  let blocks = [];
  // 1) mange nyhetssider legger hele teksten i strukturerte data
  const body = ld && typeof ld.articleBody === 'string' ? ld.articleBody : '';
  if (body.length > 600) blocks = body.split(/\n+/).map(s => s.trim()).filter(s => s.length > 1).map(text => ({ t: 'p', text: decode(text) }));
  // 2) ellers: tekst fra <article> (eller <main>/hele siden) uten meny, skript og annet
  if (!blocks.length) {
    let h = html.replace(/<(script|style|noscript|svg|iframe|form|nav|header|footer|aside|button|figcaption|template|select)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
    const arts = [...h.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map(m => m[0]);
    const main = (h.match(/<main\b[\s\S]*?<\/main>/i) || [])[0];
    const score = x => (x.match(/<p\b/gi) || []).length;
    h = arts.length ? arts.sort((a, b) => score(b) - score(a))[0] : main || h;
    for (const m of h.matchAll(/<(p|h2|h3|blockquote|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const tg = m[1].toLowerCase(), text = strip(m[2]);
      if (!text || JUNK.test(text)) continue;
      if (tg === 'p' && text.length < 30) continue;
      if (tg === 'li' && text.length < 40) continue;
      if ((tg === 'h2' || tg === 'h3') && (text.length > 140 || text.length < 3)) continue;
      blocks.push({ t: tg === 'h2' || tg === 'h3' ? 'h' : tg === 'blockquote' ? 'q' : tg === 'li' ? 'li' : 'p', text });
    }
  }
  // fjern dobbelt tekst og tittelen gjentatt
  const seen = new Set(); blocks = blocks.filter(b => { const k = b.text.slice(0, 80); if (seen.has(k) || b.text === title) return false; seen.add(k); return true; }).slice(0, 160);
  const words = blocks.reduce((a, b) => a + b.text.split(' ').length, 0);
  const paywall = PAY.test(html.slice(0, 400000)) && words < 400 || words < 60;
  return { url, title, desc, byline: author || '', date, img, blocks, words, paywall };
}

const cache = new Map();
async function read(url, UA) {
  const hit = cache.get(url); if (hit && Date.now() - hit.at < 30 * 60e3) return hit.data;
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'nb-NO,nb;q=0.9,en;q=0.8' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    if (!/html/i.test(r.headers.get('content-type') || 'text/html')) throw new Error('ikke en nettside');
    const data = extract(await r.text(), r.url || url);
    cache.set(url, { at: Date.now(), data }); if (cache.size > 60) cache.delete(cache.keys().next().value);
    return data;
  } finally { clearTimeout(t); }
}

module.exports = { read, extract };
