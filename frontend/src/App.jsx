import { useState, useEffect } from "react";
import "./App.css";

function getSourceBadges(item) {
  const badges = [];
  if (item.content_score > 0.1) badges.push("Content");
  if (item.item_collab_score !== null) badges.push("Item CF");
  if (item.user_collab_score !== null) badges.push("User CF");
  return badges;
}

function ScoreBar({ value, max = 5, color = "purple" }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="bar-wrap">
      <div
        className={`bar-fill ${color === "teal" ? "teal" : ""}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MovieCard({ movie }) {
  const [expanded, setExpanded] = useState(false);
  const [posterUrl, setPosterUrl] = useState(null);
  const [trailerUrl, setTrailerUrl] = useState(null); // Added state for the trailer
  const [loadingPoster, setLoadingPoster] = useState(false);

  useEffect(() => {
    if (!movie.tmdb_id) return;
    setLoadingPoster(true);
    let isMounted = true;
    const API_KEY = import.meta.env.VITE_TMDB_API_KEY;

    // 1. Fetch Poster
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}?api_key=${API_KEY}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch poster");
        return res.json();
      })
      .then((data) => {
        if (isMounted && data.poster_path) {
          setPosterUrl(`https://image.tmdb.org/t/p/w500${data.poster_path}`);
        }
      })
      .catch((err) => {
        console.error("Error fetching poster:", err);
      });

    // 2. Fetch Trailer
    fetch(`https://api.themoviedb.org/3/movie/${movie.tmdb_id}/videos?api_key=${API_KEY}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.results) {
          // Look for the official YouTube trailer
          const trailer = data.results.find(
            (vid) => vid.site === "YouTube" && vid.type === "Trailer"
          );
          if (trailer) {
            setTrailerUrl(`https://www.youtube.com/watch?v=${trailer.key}`);
          }
        }
      })
      .catch((err) => {
        console.error("Error fetching trailer:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingPoster(false);
      });

    return () => {
      isMounted = false;
    };
  }, [movie.tmdb_id]);

  // backend returns genres as an array already e.g. ["Crime", "Drama"]
  const genres = Array.isArray(movie.genres)
    ? movie.genres
    : movie.genres.split("|");

  // cast is also an array from the backend
  const castDisplay = Array.isArray(movie.cast)
    ? movie.cast.join(", ")
    : movie.cast;

  const badges = getSourceBadges(movie);

  return (
    <div className="card">
      {posterUrl ? (
        <img
          src={posterUrl}
          alt={movie.title}
          className="card-poster"
          style={{ borderRadius: "10px" }}
        />
      ) : (
        <div className="poster-placeholder">
          {loadingPoster ? (
            <i className="ti ti-loader-2 spin" aria-hidden="true" />
          ) : (
            <i className="ti ti-movie" aria-hidden="true" />
          )}
        </div>
      )}

      <div className="card-body">
        <div className="card-title">{movie.title}</div>

        {/* source badges */}
        <div className="badges">
          {badges.map((b) => (
            <span
              key={b}
              className={`badge ${b === "Content"
                ? "badge-content"
                : b.includes("CF")
                  ? "badge-collab"
                  : ""
                }`}
            >
              {b}
            </span>
          ))}
          {genres.map((g) => (
            <span key={g} className="badge badge-genre">
              {g}
            </span>
          ))}
        </div>

        {/* scores grid */}
        <div className="scores">
          <div className="score-item span2">
            <span className="score-label">Predicted rating</span>
            <span className="score-value highlight">
              {movie.predicted_rating.toFixed(2)} ★
            </span>
          </div>

          <div className="score-item">
            <span className="score-label">Content sim</span>
            <span className="score-value">
              {movie.content_score.toFixed(2)}
            </span>
            <ScoreBar value={movie.content_score} max={1} color="purple" />
          </div>

          <div className="score-item">
            <span className="score-label">Item collab</span>
            <span className="score-value">
              {movie.item_collab_score !== null
                ? movie.item_collab_score.toFixed(2)
                : "—"}
            </span>
            {movie.item_collab_score !== null && (
              <ScoreBar value={movie.item_collab_score} max={5} color="teal" />
            )}
          </div>

          <div className="score-item">
            <span className="score-label">User collab</span>
            <span className="score-value">
              {movie.user_collab_score !== null
                ? movie.user_collab_score.toFixed(2)
                : "—"}
            </span>
            {movie.user_collab_score !== null && (
              <ScoreBar value={movie.user_collab_score} max={5} color="teal" />
            )}
          </div>
        </div>

        {/* expandable details */}
        <button
          className="expand-btn"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          {expanded ? "Hide details" : "Show details"}
          <i
            className={`ti ${expanded ? "ti-chevron-up" : "ti-chevron-down"}`}
            aria-hidden="true"
          />
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
              <a
                href={trailerUrl}
                target="_blank"
                rel="noreferrer"
                className="trailer-btn"
              >
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

export default function App() {
  const [movieInput, setMovieInput] = useState("");
  const [userInput, setUserInput] = useState("");
  const [seedTitle, setSeedTitle] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch() {
    if (!movieInput.trim() || !userInput.trim()) return;
    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      // Fix: correct endpoint + correct param names matching main.py
      const res = await fetch(
        `${baseUrl}/hybrid_recommend?user_id=${userInput}&movie_title=${encodeURIComponent(movieInput)}&top_n=10`
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Something went wrong.");
      }

      const data = await res.json();
      setResults(data.recommendations);
      setSeedTitle(data.seed_movie); // backend returns "seed_movie" not "seed_title"
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") handleSearch();
  }

  return (
    <div className="app">
      {/* ── Hero / Search ── */}
      <div className="hero">
        <div className="logo">Hybrid Recommender</div>
        <h1 className="hero-title">What should you watch next?</h1>
        <p className="hero-sub">
          Powered by XGBoost · Content + Collaborative Filtering
        </p>

        <div className="search-wrap">
          <div className="search-row">
            <input
              className="search-input"
              placeholder="Seed movie (e.g. The Shawshank Redemption)"
              value={movieInput}
              onChange={(e) => setMovieInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <input
              className="user-input"
              placeholder="User ID"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              className="search-btn"
              onClick={handleSearch}
              disabled={loading}
            >
              {loading ? (
                <i className="ti ti-loader-2 spin" aria-hidden="true" />
              ) : (
                <i className="ti ti-search" aria-hidden="true" />
              )}
              {loading ? "Finding..." : "Search"}
            </button>
          </div>
        </div>

        {seedTitle && (
          <p className="because-bar">
            Because you liked <span>{seedTitle}</span>
          </p>
        )}
      </div>

      {/* ── Error ── */}
      {error && <p className="error-msg">{error}</p>}

      {/* ── Empty state ── */}
      {!loading && results.length === 0 && !error && (
        <div className="empty-state">
          <i className="ti ti-popcorn" aria-hidden="true" />
          <p>Enter a movie and your user ID to get recommendations</p>
        </div>
      )}

      {/* ── Results grid ── */}
      {results.length > 0 && (
        <div className="grid">
          {results.map((movie, i) => (
            <MovieCard key={movie.tmdb_id ?? i} movie={movie} />
          ))}
        </div>
      )}
    </div>
  );
}
