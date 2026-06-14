import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import AuthPage from "./AuthPage";

// ── Helpers ────────────────────────────────────────────────────────────────

function getSourceBadges(item) {
  const badges = [];
  if (item.content_score > 0.1) badges.push("Content");
  if (item.item_collab_score !== null) badges.push("Item CF");
  if (item.user_collab_score !== null) badges.push("User CF");
  return badges;
}

function getSourceBadgeClass(badges) {
  const hasContent = badges.includes("Content");
  const hasCollab = badges.some((b) => b.includes("CF"));
  if (hasContent && hasCollab) return "source-hybrid";
  if (hasContent) return "source-content";
  return "source-collab";
}

function getSourceLabel(badges) {
  const hasContent = badges.includes("Content");
  const hasCollab = badges.some((b) => b.includes("CF"));
  if (hasContent && hasCollab) return "Hybrid";
  if (hasContent) return "Content";
  return "Collab";
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, icon, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <i className={`ti ti-${icon}`} aria-hidden="true" />
      {message}
    </div>
  );
}

// ── MovieCard ──────────────────────────────────────────────────────────────

function MovieCard({ movie, onSave, onFeedback, savedIds, feedbackMap }) {
  const [expanded, setExpanded] = useState(false);
  const [posterUrl, setPosterUrl] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const [loadingPoster, setLoadingPoster] = useState(false);

  const isSaved = savedIds.has(movie.tmdb_id ?? movie.title);
  const feedback = feedbackMap[movie.tmdb_id ?? movie.title] ?? null; // "like" | "dislike" | null

  useEffect(() => {
    if (!movie.tmdb_id) return;
    setLoadingPoster(true);
    let mounted = true;
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${API_KEY}`)
      .then((r) => r.json())
      .then((d) => { if (mounted && d.poster_path) setPosterUrl(`https://image.tmdb.org/t/p/w500${d.poster_path}`); })
      .catch(() => { });

    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/videos?api_key=${API_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (!mounted || !d.results) return;
        const t = d.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
        if (t) setTrailerUrl(`https://www.youtube.com/watch?v=${t.key}`);
      })
      .catch(() => { })
      .finally(() => { if (mounted) setLoadingPoster(false); });

    return () => { mounted = false; };
  }, [movie.tmdb_id]);

  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : (movie.genres ?? "").split("|").filter(Boolean);

  const castDisplay = Array.isArray(movie.cast)
    ? movie.cast.join(", ")
    : movie.cast;

  const badges = getSourceBadges(movie);
  const key = movie.tmdb_id ?? movie.title;

  return (
    <div className="card">
      {/* ── Poster ── */}
      {posterUrl ? (
        <img src={posterUrl} alt={movie.title} className="card-poster" />
      ) : (
        <div className="poster-placeholder">
          {loadingPoster
            ? <i className="ti ti-loader-2 spin" aria-hidden="true" />
            : <i className="ti ti-movie" aria-hidden="true" />}
        </div>
      )}

      {/* ── Source badge (top-left) ── */}
      <span className={`poster-source-badge ${getSourceBadgeClass(badges)}`}>
        {getSourceLabel(badges)}
      </span>

      {/* ── Hover action buttons (top-right) ── */}
      <div className="poster-actions">
        {/* Bookmark / Save */}
        <button
          className={`poster-action-btn btn-bookmark ${isSaved ? "saved" : ""}`}
          onClick={() => onSave(movie)}
          title={isSaved ? "Remove from watchlist" : "Save to watchlist"}
          aria-label={isSaved ? "Remove from watchlist" : "Save to watchlist"}
        >
          <i className={`ti ${isSaved ? "ti-bookmark-filled" : "ti-bookmark"}`} aria-hidden="true" />
        </button>

        {/* Thumbs up */}
        <button
          className={`poster-action-btn btn-like ${feedback === "like" ? "active" : ""}`}
          onClick={() => onFeedback(movie, "like")}
          title="I'd watch this"
          aria-label="Like this recommendation"
        >
          <i className="ti ti-thumb-up" aria-hidden="true" />
        </button>

        {/* Thumbs down */}
        <button
          className={`poster-action-btn btn-dislike ${feedback === "dislike" ? "active" : ""}`}
          onClick={() => onFeedback(movie, "dislike")}
          title="Not for me"
          aria-label="Dislike this recommendation"
        >
          <i className="ti ti-thumb-down" aria-hidden="true" />
        </button>
      </div>

      {/* ── Card body ── */}
      <div className="card-body">
        <div className="card-title">{movie.title}</div>

        {/* Inline action row: Watch Later + Like / Pass */}
        <div className="feedback-row">
          {/* Watch Later bookmark — always visible */}
          <button
            className={`feedback-btn ${isSaved ? "saved-btn" : ""}`}
            onClick={() => onSave(movie)}
            aria-pressed={isSaved}
            title={isSaved ? "Remove from watchlist" : "Save to Watch Later"}
          >
            <i className={`ti ${isSaved ? "ti-bookmark-filled" : "ti-bookmark"}`} aria-hidden="true" />
            <span>{isSaved ? "Saved" : "Later"}</span>
          </button>

          <span className="feedback-divider" aria-hidden="true" />

          <button
            className={`feedback-btn ${feedback === "like" ? "liked" : ""}`}
            onClick={() => onFeedback(movie, "like")}
            aria-pressed={feedback === "like"}
          >
            <i className="ti ti-thumb-up" aria-hidden="true" />
            <span>Like</span>
          </button>
          <button
            className={`feedback-btn ${feedback === "dislike" ? "disliked" : ""}`}
            onClick={() => onFeedback(movie, "dislike")}
            aria-pressed={feedback === "dislike"}
          >
            <i className="ti ti-thumb-down" aria-hidden="true" />
            <span>Pass</span>
          </button>
        </div>

        {/* compact genre subtitle */}
        <div className="card-genre-line">
          {genres.slice(0, 3).join(' · ')}
        </div>

        {/* Score bars in crimson / gold / purple */}
        <div className="rating-bar-wrap">
          <div className="rating-bar-label">
            <span>Content</span>
            <span>{movie.content_score != null ? movie.content_score.toFixed(2) : '—'}</span>
          </div>
          <div className="rating-bar-track">
            <div
              className="rating-bar-fill fill-crimson"
              style={{ width: `${Math.min(100, (movie.content_score ?? 0) * 100)}%` }}
            />
          </div>
        </div>

        {movie.item_collab_score != null && (
          <div className="rating-bar-wrap">
            <div className="rating-bar-label">
              <span>Item CF</span>
              <span>{movie.item_collab_score.toFixed(2)}</span>
            </div>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill fill-gold"
                style={{ width: `${Math.min(100, (movie.item_collab_score / 5) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {movie.user_collab_score != null && (
          <div className="rating-bar-wrap">
            <div className="rating-bar-label">
              <span>User CF</span>
              <span>{movie.user_collab_score.toFixed(2)}</span>
            </div>
            <div className="rating-bar-track">
              <div
                className="rating-bar-fill fill-purple"
                style={{ width: `${Math.min(100, (movie.user_collab_score / 5) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Star rating line */}
        <div className="card-star">
          <i className="ti ti-star-filled" aria-hidden="true" />
          {(movie.predicted_rating ?? 0).toFixed(2)} predicted
        </div>

        {/* Expand / collapse */}
        <button
          className="expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Show details"}
          <i className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`} aria-hidden="true" />
        </button>

        {expanded && (
          <div className="details">
            {castDisplay && (
              <div className="detail-row">
                <span className="detail-label">Cast</span>
                <span className="detail-value">{castDisplay}</span>
              </div>
            )}
            {movie.overview && (
              <div className="detail-row">
                <span className="detail-label">Plot</span>
                <span className="detail-value">{movie.overview}</span>
              </div>
            )}
            {trailerUrl && (
              <a href={trailerUrl} target="_blank" rel="noreferrer" className="trailer-btn">
                <i className="ti ti-brand-youtube" aria-hidden="true" />
                Watch trailer
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MovieDetailModal ────────────────────────────────────────────────────────

function MovieDetailModal({ movie, onClose, onSave, onFeedback, savedIds, feedbackMap }) {
  const [posterUrl, setPosterUrl] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState(null);
  const backdropRef = useRef(null);

  const key = movie.tmdb_id ?? movie.title;
  const isSaved = savedIds.has(key);
  const feedback = feedbackMap[key] ?? null;

  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : (movie.genres ?? "").split("|").filter(Boolean);

  const castDisplay = Array.isArray(movie.cast)
    ? movie.cast.join(", ")
    : movie.cast;

  useEffect(() => {
    if (!movie.tmdb_id) return;
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${API_KEY}`)
      .then((r) => r.json())
      .then((d) => { if (d.poster_path) setPosterUrl(`https://image.tmdb.org/t/p/w500${d.poster_path}`); })
      .catch(() => { });
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/videos?api_key=${API_KEY}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.results) return;
        const t = d.results.find((v) => v.site === "YouTube" && v.type === "Trailer");
        if (t) setTrailerUrl(`https://www.youtube.com/watch?v=${t.key}`);
      })
      .catch(() => { });
  }, [movie.tmdb_id]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={movie.title}
    >
      <div className="modal-card">
        {/* Close */}
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <i className="ti ti-x" aria-hidden="true" />
        </button>

        <div className="modal-inner">
          {/* Poster */}
          <div className="modal-poster-wrap">
            {posterUrl ? (
              <img src={posterUrl} alt={movie.title} className="modal-poster" />
            ) : (
              <div className="modal-poster-placeholder">
                <i className="ti ti-movie" aria-hidden="true" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="modal-info">
            <div className="modal-title">{movie.title}</div>

            {genres.length > 0 && (
              <div className="modal-genres">{genres.join(' · ')}</div>
            )}

            {/* Actions */}
            <div className="modal-actions">
              <button
                className={`feedback-btn ${isSaved ? "saved-btn" : ""}`}
                onClick={() => onSave(movie)}
                aria-pressed={isSaved}
              >
                <i className={`ti ${isSaved ? "ti-bookmark-filled" : "ti-bookmark"}`} aria-hidden="true" />
                <span>{isSaved ? "Saved" : "Save Later"}</span>
              </button>
              <button
                className={`feedback-btn ${feedback === "like" ? "liked" : ""}`}
                onClick={() => onFeedback(movie, "like")}
                aria-pressed={feedback === "like"}
              >
                <i className="ti ti-thumb-up" aria-hidden="true" /> <span>Like</span>
              </button>
              <button
                className={`feedback-btn ${feedback === "dislike" ? "disliked" : ""}`}
                onClick={() => onFeedback(movie, "dislike")}
                aria-pressed={feedback === "dislike"}
              >
                <i className="ti ti-thumb-down" aria-hidden="true" /> <span>Pass</span>
              </button>
            </div>

            {/* Score bars */}
            <div className="modal-scores">
              <div className="rating-bar-wrap">
                <div className="rating-bar-label">
                  <span>Content Sim</span>
                  <span>{movie.content_score != null ? movie.content_score.toFixed(2) : '—'}</span>
                </div>
                <div className="rating-bar-track">
                  <div className="rating-bar-fill fill-crimson" style={{ width: `${Math.min(100, (movie.content_score ?? 0) * 100)}%` }} />
                </div>
              </div>
              {movie.item_collab_score != null && (
                <div className="rating-bar-wrap">
                  <div className="rating-bar-label">
                    <span>Item CF</span>
                    <span>{movie.item_collab_score.toFixed(2)}</span>
                  </div>
                  <div className="rating-bar-track">
                    <div className="rating-bar-fill fill-gold" style={{ width: `${Math.min(100, (movie.item_collab_score / 5) * 100)}%` }} />
                  </div>
                </div>
              )}
              {movie.user_collab_score != null && (
                <div className="rating-bar-wrap">
                  <div className="rating-bar-label">
                    <span>User CF</span>
                    <span>{movie.user_collab_score.toFixed(2)}</span>
                  </div>
                  <div className="rating-bar-track">
                    <div className="rating-bar-fill fill-purple" style={{ width: `${Math.min(100, (movie.user_collab_score / 5) * 100)}%` }} />
                  </div>
                </div>
              )}
              <div className="card-star" style={{ marginTop: 8 }}>
                <i className="ti ti-star-filled" aria-hidden="true" />
                {(movie.predicted_rating ?? 0).toFixed(2)} predicted rating
              </div>
            </div>

            {/* Plot */}
            {movie.overview && (
              <div className="modal-section">
                <div className="detail-label">Plot</div>
                <div className="detail-value" style={{ fontSize: 12, lineHeight: 1.65, marginTop: 4 }}>{movie.overview}</div>
              </div>
            )}

            {/* Cast */}
            {castDisplay && (
              <div className="modal-section">
                <div className="detail-label">Cast</div>
                <div className="detail-value" style={{ fontSize: 12, marginTop: 4 }}>{castDisplay}</div>
              </div>
            )}

            {/* Trailer */}
            {trailerUrl && (
              <a href={trailerUrl} target="_blank" rel="noreferrer" className="trailer-btn">
                <i className="ti ti-brand-youtube" aria-hidden="true" />
                Watch trailer
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WatchlistView ────────────────────────────────────────────────────────

function WatchlistView({ watchlist, likedMovies, onRemove, onRemoveLiked, onSelect }) {
  return (
    <div className="watchlist-view">

      {/* ── My Watchlist ── */}
      <div className="watchlist-header">
        <div>
          <div className="watchlist-title">
            <i className="ti ti-bookmark-filled" aria-hidden="true" style={{ color: '#c8a040', marginRight: 8 }} />
            My Watchlist
          </div>
          <div className="watchlist-subtitle">
            {watchlist.length === 0 ? "Nothing saved yet" : `${watchlist.length} movie${watchlist.length > 1 ? "s" : ""} saved`}
          </div>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="watchlist-empty">
          <i className="ti ti-bookmark" aria-hidden="true" />
          <p>Tap “Later” on a recommendation card to save it here.</p>
        </div>
      ) : (
        <div className="watchlist-list">
          {watchlist.map((movie) => (
            <WatchlistItem
              key={movie.tmdb_id ?? movie.title}
              movie={movie}
              onRemove={onRemove}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}

      {/* ── Liked Movies ── */}
      <div className="watchlist-header" style={{ marginTop: '2rem' }}>
        <div>
          <div className="watchlist-title">
            <i className="ti ti-thumb-up-filled" aria-hidden="true" style={{ color: '#5DCAA5', marginRight: 8 }} />
            Liked Movies
          </div>
          <div className="watchlist-subtitle">
            {likedMovies.length === 0 ? "No likes yet" : `${likedMovies.length} movie${likedMovies.length > 1 ? "s" : ""} liked`}
          </div>
        </div>
      </div>

      {likedMovies.length === 0 ? (
        <div className="watchlist-empty">
          <i className="ti ti-thumb-up" aria-hidden="true" />
          <p>Movies you Like will appear here.</p>
        </div>
      ) : (
        <div className="watchlist-list">
          {likedMovies.map((movie) => (
            <WatchlistItem
              key={movie.tmdb_id ?? movie.title}
              movie={movie}
              onRemove={onRemoveLiked}
              onSelect={onSelect}
              accentColor="#5DCAA5"
              removeIcon="ti-thumb-down"
              removeLabel="Unlike"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WatchlistItem({ movie, onRemove, onSelect, accentColor, removeIcon = "ti-x", removeLabel }) {
  const [posterUrl, setPosterUrl] = useState(null);

  useEffect(() => {
    if (!movie.tmdb_id) return;
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${API_KEY}`)
      .then((r) => r.json())
      .then((d) => { if (d.poster_path) setPosterUrl(`https://image.tmdb.org/t/p/w92${d.poster_path}`); })
      .catch(() => { });
  }, [movie.tmdb_id]);

  const genres = Array.isArray(movie.genres)
    ? movie.genres.join(", ")
    : (movie.genres ?? "").replace(/\|/g, ", ");

  return (
    <div className="watchlist-item" onClick={() => onSelect(movie)} role="button" tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(movie)}
    >
      {posterUrl ? (
        <img src={posterUrl} alt={movie.title} className="watchlist-thumb" />
      ) : (
        <div className="watchlist-thumb-placeholder">
          <i className="ti ti-movie" aria-hidden="true" />
        </div>
      )}

      <div className="watchlist-info">
        <div className="watchlist-movie-title">{movie.title}</div>
        <div className="watchlist-movie-meta">{genres}</div>
        <div className="watchlist-open-hint">
          <i className="ti ti-arrow-right" aria-hidden="true" /> View details
        </div>
      </div>

      <div className="watchlist-rating" style={accentColor ? { color: accentColor } : {}}>
        {(movie.predicted_rating ?? 0).toFixed(1)} ★
      </div>

      <button
        className="watchlist-remove-btn"
        onClick={(e) => { e.stopPropagation(); onRemove(movie); }}
        aria-label={removeLabel ?? `Remove ${movie.title}`}
        title={removeLabel ?? "Remove"}
      >
        <i className={`ti ${removeIcon}`} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── AutocompleteInput ──────────────────────────────────────────────────────

function AutocompleteInput({ value, onChange, onSelect, placeholder, allTitles }) {
  const [suggestions, setSuggestions] = useState([]);
  const [focusedIdx, setFocusedIdx] = useState(-1);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Filter whenever the value changes
  useEffect(() => {
    if (value.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const q = value.toLowerCase();
    const matches = allTitles
      .filter((t) => t.toLowerCase().includes(q))
      .slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
    setFocusedIdx(-1);
  }, [value, allTitles]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleKey(e) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      if (focusedIdx >= 0) {
        e.preventDefault();
        onSelect(suggestions[focusedIdx]);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <input
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        autoComplete="off"
        spellCheck="false"
      />
      {open && (
        <div
          className="autocomplete-dropdown"
          role="listbox"
          onMouseLeave={() => setFocusedIdx(-1)}
        >
          {suggestions.map((title, idx) => (
            <div
              key={title}
              className={`autocomplete-item ${idx === focusedIdx ? "focused" : ""}`}
              role="option"
              aria-selected={idx === focusedIdx}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onSelect(title); setOpen(false); }}
              onMouseEnter={() => setFocusedIdx(idx)}
            >
              <i className="ti ti-movie" aria-hidden="true" />
              {title}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── All genres extracted from results ──────────────────────────────────────

function extractGenres(results) {
  const set = new Set();
  results.forEach((m) => {
    const gs = Array.isArray(m.genres) ? m.genres : (m.genres ?? "").split("|");
    gs.forEach((g) => g && set.add(g.trim()));
  });
  return Array.from(set).sort();
}

// ── localStorage helpers ───────────────────────────────────────────────

function lsKey(userId, type) {
  const uid = userId?.toString().trim() || "global";
  return `cinematch_${type}_${uid}`;
}

function loadFromStorage(userId, type, fallback) {
  try {
    const raw = localStorage.getItem(lsKey(userId, type));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage(userId, type, value) {
  try {
    localStorage.setItem(lsKey(userId, type), JSON.stringify(value));
  } catch { /* quota exceeded or private mode — silently ignore */ }
}

// ── App ────────────────────────────────────────────────────────────────

export default function App() {
  // ── Auth state ────────────────────────────────────────────────────────────
  const [authUser, setAuthUser] = useState(() => localStorage.getItem("auth_username") || null);

  function handleAuthSuccess(username) {
    setAuthUser(username);
  }

  function handleLogout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_username");
    setAuthUser(null);
  }

  // ── Movie/recommender state ───────────────────────────────────────────────
  const [movieInput, setMovieInput] = useState("");
  // userInput mirrors the logged-in username so recommendations are personalised
  const [userInput, setUserInput] = useState(() => localStorage.getItem("auth_username") || "");
  const [seedTitle, setSeedTitle] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("discover"); // "discover" | "watchlist"
  const [watchlist, setWatchlist] = useState([]);         // array of movie objects
  const [savedIds, setSavedIds] = useState(new Set());   // set of tmdb_id/title keys
  const [feedbackMap, setFeedbackMap] = useState({});    // { key: "like" | "dislike" }
  const [likedMovies, setLikedMovies] = useState([]);    // full movie objects the user liked
  const [activeGenres, setActiveGenres] = useState(new Set());
  const [toast, setToast] = useState(null);
  const [resultMode, setResultMode] = useState("popular");
  const [modalMovie, setModalMovie] = useState(null);    // movie to show in detail modal

  const [allTitles, setAllTitles] = useState([]);
  const [allAvailableGenres, setAllAvailableGenres] = useState([]);

  // ── Load titles, genres, and popular movies on mount ──────────────────
  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE_URL || "https://hybrid-recommender-system-z6m4.onrender.com";

    fetch(`${base}/movie_titles`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.titles)) setAllTitles(d.titles); })
      .catch(() => { });

    fetch(`${base}/genres`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.genres)) setAllAvailableGenres(d.genres); })
      .catch(() => { });

    fetch(`${base}/popular?n=12`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.movies)) { setResults(d.movies); setResultMode("popular"); } })
      .catch(() => { });
  }, []);

  // ── Load user-specific data from localStorage ────────────────────────────
  useEffect(() => {
    const savedWatchlist = loadFromStorage(userInput, "watchlist", []);
    const savedFeedback = loadFromStorage(userInput, "feedback", {});
    const savedLiked = loadFromStorage(userInput, "liked", []);
    setWatchlist(savedWatchlist);
    setSavedIds(new Set(savedWatchlist.map((m) => m.tmdb_id ?? m.title)));
    setFeedbackMap(savedFeedback);
    setLikedMovies(savedLiked);
  }, [userInput]);

  // ── Toast helper ────────────────────────────────────────────────────────

  const showToast = useCallback((message, icon, type) => {
    setToast({ message, icon, type });
  }, []);


  // ── Search ───────────────────────────────────────────────────────────────

  async function handleSearch() {
    if (!movieInput.trim() || !userInput.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setActiveGenres(new Set());

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "https://hybrid-recommender-system-z6m4.onrender.com";
      const res = await fetch(
        `${baseUrl}/hybrid_recommend?user_id=${encodeURIComponent(userInput)}&movie_title=${encodeURIComponent(movieInput)}&top_n=10`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong.");
      }
      const data = await res.json();
      setResults(data.recommendations);
      setSeedTitle(data.seed_movie);
      setResultMode("search");
      setActiveTab("discover");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  // ── Watchlist ─────────────────────────────────────────────────────────

  function handleSave(movie) {
    const key = movie.tmdb_id ?? movie.title;
    if (savedIds.has(key)) {
      // Remove
      const newSavedIds = new Set(savedIds);
      newSavedIds.delete(key);
      const newWatchlist = watchlist.filter((m) => (m.tmdb_id ?? m.title) !== key);
      setSavedIds(newSavedIds);
      setWatchlist(newWatchlist);
      saveToStorage(userInput, "watchlist", newWatchlist);
      showToast("Removed from watchlist", "bookmark", "remove");
    } else {
      // Add
      const newSavedIds = new Set(savedIds).add(key);
      const newWatchlist = [movie, ...watchlist];
      setSavedIds(newSavedIds);
      setWatchlist(newWatchlist);
      saveToStorage(userInput, "watchlist", newWatchlist);
      showToast("Saved to watchlist", "bookmark-filled", "save");
    }
  }

  function handleRemoveFromWatchlist(movie) {
    const key = movie.tmdb_id ?? movie.title;
    const newSavedIds = new Set(savedIds);
    newSavedIds.delete(key);
    const newWatchlist = watchlist.filter((m) => (m.tmdb_id ?? m.title) !== key);
    setSavedIds(newSavedIds);
    setWatchlist(newWatchlist);
    saveToStorage(userInput, "watchlist", newWatchlist);
    showToast("Removed from watchlist", "x", "remove");
  }

  // ── Feedback ──────────────────────────────────────────────────────────

  function handleFeedback(movie, type) {
    const key = movie.tmdb_id ?? movie.title;
    setFeedbackMap((prev) => {
      const current = prev[key];
      const next = current === type ? null : type;
      const newFeedbackMap = { ...prev, [key]: next };
      saveToStorage(userInput, "feedback", newFeedbackMap);

      // Keep likedMovies list in sync
      setLikedMovies((prevLiked) => {
        let updated;
        if (next === "like") {
          // Add if not already present
          const exists = prevLiked.some((m) => (m.tmdb_id ?? m.title) === key);
          updated = exists ? prevLiked : [movie, ...prevLiked];
        } else {
          // Remove from liked list (either toggled off or switched to dislike)
          updated = prevLiked.filter((m) => (m.tmdb_id ?? m.title) !== key);
        }
        saveToStorage(userInput, "liked", updated);
        return updated;
      });

      if (next === "like") showToast("Marked as a great pick", "thumb-up", "like");
      if (next === "dislike") showToast("Got it — we'll note that", "thumb-down", "dislike");
      return newFeedbackMap;
    });
  }

  function handleRemoveLiked(movie) {
    const key = movie.tmdb_id ?? movie.title;
    setLikedMovies((prev) => {
      const updated = prev.filter((m) => (m.tmdb_id ?? m.title) !== key);
      saveToStorage(userInput, "liked", updated);
      return updated;
    });
    // also clear the feedbackMap entry
    setFeedbackMap((prev) => {
      const updated = { ...prev, [key]: null };
      saveToStorage(userInput, "feedback", updated);
      return updated;
    });
    showToast("Removed from liked", "thumb-down", "remove");
  }

  // ── Genre filter ──────────────────────────────────────────────────────

  const availableGenres = resultMode === "popular" ? allAvailableGenres : extractGenres(results);

  function toggleGenre(genre) {
    setActiveGenres((prev) => {
      const s = new Set(prev);
      s.has(genre) ? s.delete(genre) : s.add(genre);
      return s;
    });
  }

  function clearGenres() {
    setActiveGenres(new Set());
  }

  const filteredResults = activeGenres.size === 0
    ? results
    : results.filter((m) => {
      const gs = Array.isArray(m.genres) ? m.genres : (m.genres ?? "").split("|");
      return gs.some((g) => activeGenres.has(g.trim()));
    });

  // ── Sync userInput with authUser ───────────────────────────────────────────

  useEffect(() => {
    if (authUser) setUserInput(authUser);
  }, [authUser]);

  // ── Render ─────────────────────────────────────────────────────────────────

  // Show the auth page if the user is not logged in
  if (!authUser) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="app">
      {/* ambient mid-orb */}
      <div className="orb-mid" aria-hidden="true" />

      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-logo">Cine<span>Match</span></div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === "discover" ? "active" : ""}`}
            onClick={() => setActiveTab("discover")}
          >
            <i className="ti ti-sparkles" aria-hidden="true" /> Discover
          </button>
          <button
            className={`nav-tab ${activeTab === "watchlist" ? "active" : ""}`}
            onClick={() => setActiveTab("watchlist")}
          >
            <i className="ti ti-bookmark" aria-hidden="true" /> Watchlist
            {watchlist.length > 0 && (
              <span className="nav-watchlist-count">{watchlist.length}</span>
            )}
          </button>
        </div>
        {/* User info + logout */}
        <div className="nav-user">
          <span className="nav-username">
            <i className="ti ti-user-circle" aria-hidden="true" /> {authUser}
          </span>
          <button
            id="logout-btn"
            className="nav-logout-btn"
            onClick={handleLogout}
            title="Sign out"
          >
            <i className="ti ti-logout" aria-hidden="true" /> Logout
          </button>
        </div>
      </nav>

      {/* ── Discover view ── */}
      {activeTab === "discover" && (
        <>
          {/* Hero / search */}
          <div className="hero">
            <div className="logo">Hybrid Recommender</div>
            <h1 className="hero-title">What should you watch next?</h1>

            <div className="search-wrap">
              <div className="search-row">
                {/* Autocomplete movie search */}
                <AutocompleteInput
                  value={movieInput}
                  onChange={setMovieInput}
                  onSelect={(t) => { setMovieInput(t); }}
                  placeholder="Seed movie — try Shawshank Redemption"
                  allTitles={allTitles}
                />

                {/* User ID is now the logged-in username — hidden from manual entry */}

                <button className="search-btn" onClick={handleSearch} disabled={loading}>
                  {loading
                    ? <i className="ti ti-loader-2 spin" aria-hidden="true" />
                    : <i className="ti ti-search" aria-hidden="true" />}
                  {loading ? "Finding…" : "Recommend"}
                </button>
              </div>
            </div>

            {seedTitle && (
              <p className="because-bar">
                <i className="ti ti-sparkles" aria-hidden="true" />
                Because you liked <span>{seedTitle}</span>
              </p>
            )}
          </div>

          {/* Error */}
          {error && <p className="error-msg" role="alert">{error}</p>}

          {/* Genre filter — visible as soon as genres load from backend */}
          {allAvailableGenres.length > 0 && (
            <div className="filter-panel">
              <span className="filter-label">Genre</span>
              <div className="filter-tags">
                {availableGenres.map((g) => (
                  <button
                    key={g}
                    className={`filter-tag ${activeGenres.has(g) ? "active" : ""}`}
                    onClick={() => toggleGenre(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {activeGenres.size > 0 && (
                <button className="filter-clear" onClick={clearGenres}>
                  <i className="ti ti-x" aria-hidden="true" />
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Results section header */}
          {results.length > 0 && (
            <div className="results-bar">
              <span className="results-section-label">
                {resultMode === "popular"
                  ? <><i className="ti ti-flame" aria-hidden="true" /> Popular Picks</>
                  : <><i className="ti ti-sparkles" aria-hidden="true" /> Recommended for You</>}
              </span>
              <span className="results-count">
                {activeGenres.size > 0
                  ? `${filteredResults.length} of ${results.length}`
                  : `${results.length} movies`}
              </span>
            </div>
          )}

          {/* Empty state — only show when no popular movies loaded yet */}
          {!loading && results.length === 0 && !error && (
            <div className="empty-state">
              <i className="ti ti-popcorn" aria-hidden="true" />
              <p>Enter a movie and your user ID to get recommendations</p>
            </div>
          )}

          {/* No results after filter */}
          {results.length > 0 && filteredResults.length === 0 && (
            <div className="empty-state">
              <i className="ti ti-filter-off" aria-hidden="true" />
              <p>No recommendations match the selected genres. Try a different combination.</p>
            </div>
          )}

          {/* Results grid */}
          {filteredResults.length > 0 && (
            <div className="grid">
              {filteredResults.map((movie, i) => (
                <MovieCard
                  key={movie.tmdb_id ?? i}
                  movie={movie}
                  onSave={handleSave}
                  onFeedback={handleFeedback}
                  savedIds={savedIds}
                  feedbackMap={feedbackMap}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Watchlist view ── */}
      {activeTab === "watchlist" && (
        <WatchlistView
          watchlist={watchlist}
          likedMovies={likedMovies}
          onRemove={handleRemoveFromWatchlist}
          onRemoveLiked={handleRemoveLiked}
          onSelect={(movie) => setModalMovie(movie)}
        />
      )}

      {/* ── Movie detail modal ── */}
      {modalMovie && (
        <MovieDetailModal
          movie={modalMovie}
          onClose={() => setModalMovie(null)}
          onSave={handleSave}
          onFeedback={handleFeedback}
          savedIds={savedIds}
          feedbackMap={feedbackMap}
        />
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          key={toast.message + Date.now()}
          message={toast.message}
          icon={toast.icon}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}