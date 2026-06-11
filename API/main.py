from difflib import get_close_matches
from pathlib import Path
from typing import Any, cast

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.metrics.pairwise import cosine_similarity

# 1. Initialize the FastAPI app
app = FastAPI(title="Movie Recommender API")

# 2. Setup CORS so your React frontend can talk to this backend later
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Load the "Brain" (Your data and models) globally when the server starts
BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "Data" / "final_movie_cleaned.csv"
MODEL_DIR = BASE_DIR / "models"
RATINGS_PATH = BASE_DIR / "Data" / "ratings_clean.csv"

print("Loading models and data...")
movies_df = pd.read_csv(DATA_PATH)
ratings_df = pd.read_csv(RATINGS_PATH)
if "timestamp" in ratings_df.columns:
    ratings_df = ratings_df.drop(columns=["timestamp"])

item_sim_df = joblib.load(MODEL_DIR / "item_sim_df.joblib")
user_sim_df = joblib.load(MODEL_DIR / "user_sim_df.joblib")
xgboost_model = joblib.load(MODEL_DIR / "xgboost_hybrid.joblib")
feature_names = joblib.load(MODEL_DIR / "feature_names.joblib")

overview_matrix = sp.load_npz(MODEL_DIR / "overview_matrix.npz")
genres_matrix = sp.load_npz(MODEL_DIR / "genres_matrix.npz")
director_matrix = sp.load_npz(MODEL_DIR / "director_matrix.npz")
cast_matrix = sp.load_npz(MODEL_DIR / "cast_matrix.npz")

print("Setup complete!")


def _scalar_int(value: Any) -> int | None:
    if pd.isna(value) or value is None:
        return None
    return int(value)


def _scalar_float(value: Any) -> float | None:
    if pd.isna(value) or value is None:
        return None
    return float(value)


def _rating_group_sums(df: pd.DataFrame, group_col: str) -> dict[int, float]:
    grouped = df.groupby(group_col)["rating"].sum()
    raw = cast(dict[Any, Any], grouped.to_dict())
    return {int(k): float(v) for k, v in raw.items()}


def _rating_group_counts(df: pd.DataFrame, group_col: str) -> dict[int, int]:
    grouped = df.groupby(group_col)["rating"].count()
    raw = cast(dict[Any, Any], grouped.to_dict())
    return {int(k): int(v) for k, v in raw.items()}


# Index mappings for fast lookup (first occurrence wins for duplicate movie rows)
movie_id_to_df_idx = {}
movie_id_to_matrix_idx = {}
matrix_movie_ids = []
for idx, row in movies_df.iterrows():
    mid = _scalar_int(row["movieId_x"])
    if mid not in movie_id_to_df_idx:
        movie_id_to_df_idx[mid] = idx
    if mid not in movie_id_to_matrix_idx:
        movie_id_to_matrix_idx[mid] = len(matrix_movie_ids)
        matrix_movie_ids.append(mid)

movies_by_id = movies_df.drop_duplicates(subset=["movieId_x"]).set_index("movieId_x")

movie_id_to_sim_idx = {int(mid): idx for idx, mid in enumerate(item_sim_df.index)}
item_sim_values = item_sim_df.values
user_id_to_sim_idx = {int(uid): idx for idx, uid in enumerate(user_sim_df.index)}
user_sim_values = user_sim_df.values

user_ratings_map = {
    user_id: dict(zip(group["movieId"], group["rating"]))
    for user_id, group in ratings_df.groupby("userId")
}
movie_ratings_map = {
    movie_id: dict(zip(group["userId"], group["rating"]))
    for movie_id, group in ratings_df.groupby("movieId")
}

user_sums = _rating_group_sums(ratings_df, "userId")
user_counts = _rating_group_counts(ratings_df, "userId")
movie_sums = _rating_group_sums(ratings_df, "movieId")
movie_counts = _rating_group_counts(ratings_df, "movieId")
global_avg_rating = ratings_df["rating"].mean()

title_to_index = {title.strip().lower(): idx for idx, title in enumerate(movies_df["title"])}
normalized_titles = [title.strip().lower() for title in movies_df["title"]]


def find_movie_by_title(title: str):
    normalized = title.strip().lower()
    if normalized in title_to_index:
        idx = title_to_index[normalized]
        return idx, movies_df.iloc[idx]

    close_matches = get_close_matches(normalized, normalized_titles, n=1, cutoff=0.6)
    if close_matches:
        idx = title_to_index[close_matches[0].strip().lower()]
        return idx, movies_df.iloc[idx]

    raise HTTPException(status_code=404, detail=f"Movie '{title}' not found in database.")


def _safe_str(value: Any) -> str:
    """Return a clean string, or empty string for NaN/None."""
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return ""
    return str(value)


def _movie_metadata(movie_row: pd.Series) -> dict:
    """Extract rich metadata fields from a movies_df row."""
    genres_raw = _safe_str(movie_row.get("genres", ""))
    genres_list = [g.strip() for g in genres_raw.replace("|", ",").split(",") if g.strip()]

    cast_raw = _safe_str(movie_row.get("cast", ""))
    cast_list = [c.strip() for c in cast_raw.split(",") if c.strip()][:3]

    return {
        "genres": genres_list,
        "cast": cast_list,
        "director": _safe_str(movie_row.get("director", "")),
        "overview": _safe_str(movie_row.get("overview", "")),
        "release_date": _safe_str(movie_row.get("release_date", "")),
        "vote_average": _scalar_float(movie_row["vote_average"]) if pd.notna(movie_row.get("vote_average")) else None,
        "popularity": _scalar_float(movie_row["popularity"]) if pd.notna(movie_row.get("popularity")) else None,
    }


def get_recommendations_from_similarity(movie_title: str, top_n: int = 5):
    seed_idx, seed_row = find_movie_by_title(movie_title)
    seed_movie_id = int(seed_row["movieId_x"])

    # Fall back to content-based similarity when the movie isn't in the item CF matrix
    use_content_fallback = seed_movie_id not in item_sim_df.index

    if use_content_fallback:
        # Use content similarity scores instead
        content_scores = get_hybrid_content_scores(seed_movie_id)
        sorted_mids = sorted(
            [mid for mid in content_scores if mid != seed_movie_id],
            key=lambda mid: content_scores[mid],
            reverse=True,
        )
        recommendations = []
        for rec_movie_id in sorted_mids:
            if rec_movie_id not in movies_by_id.index:
                continue
            rec_movie = movies_by_id.loc[rec_movie_id]
            meta = _movie_metadata(cast(pd.Series, rec_movie))
            recommendations.append(
                {
                    "movieId": _scalar_int(rec_movie_id),
                    "title": rec_movie["title"],
                    "tmdb_id": _scalar_int(rec_movie["tmdb_id"]),
                    **meta,
                }
            )
            if len(recommendations) >= top_n:
                break
        return seed_row["title"], recommendations

    similarity_scores = (
        item_sim_df.loc[seed_movie_id]
        .drop(labels=[seed_movie_id], errors="ignore")
        .sort_values(ascending=False)
    )

    recommendations = []
    for rec_movie_id, _ in similarity_scores.items():
        rec_movie_id = int(rec_movie_id)
        if rec_movie_id not in movies_by_id.index:
            continue

        rec_movie = movies_by_id.loc[rec_movie_id]
        meta = _movie_metadata(cast(pd.Series, rec_movie))
        recommendations.append(
            {
                "movieId": _scalar_int(rec_movie_id),
                "title": rec_movie["title"],
                "tmdb_id": _scalar_int(rec_movie["tmdb_id"]),
                **meta,
            }
        )
        if len(recommendations) >= top_n:
            break

    return seed_row["title"], recommendations


def get_hybrid_content_scores(seed_movie_id: int):
    matrix_idx = movie_id_to_matrix_idx.get(seed_movie_id)
    if matrix_idx is None:
        raise HTTPException(
            status_code=404,
            detail="This movie is not covered by the content similarity model.",
        )

    sim_overview = cosine_similarity(overview_matrix[matrix_idx], overview_matrix).flatten()
    sim_genres = cosine_similarity(genres_matrix[matrix_idx], genres_matrix).flatten()
    sim_director = cosine_similarity(director_matrix[matrix_idx], director_matrix).flatten()
    sim_cast = cosine_similarity(cast_matrix[matrix_idx], cast_matrix).flatten()

    combined_sim = (
        0.30 * sim_overview
        + 0.40 * sim_genres
        + 0.15 * sim_director
        + 0.15 * sim_cast
    )

    return dict(zip(matrix_movie_ids, combined_sim))


def get_hybrid_collab_item_scores(user_id: int):
    user_history = user_ratings_map.get(user_id, {})
    common_mids = [mid for mid in user_history if mid in movie_id_to_sim_idx]

    if not common_mids:
        return {int(mid): global_avg_rating for mid in item_sim_df.index}

    common_sim_indices = [movie_id_to_sim_idx[mid] for mid in common_mids]
    user_ratings_arr = np.array([user_history[mid] for mid in common_mids])

    sim_slice = item_sim_values[:, common_sim_indices]
    weighted_sums = np.dot(sim_slice, user_ratings_arr)
    sum_of_sims = np.abs(sim_slice).sum(axis=1)

    preds_array = np.where(sum_of_sims > 0, weighted_sums / sum_of_sims, global_avg_rating)
    preds = dict(zip(item_sim_df.index.astype(int), preds_array))

    for mid, rating in user_history.items():
        preds[int(mid)] = rating

    return preds


def get_hybrid_collab_user_scores_for_candidates(user_id: int, candidate_mids):
    target_user_sim_idx = user_id_to_sim_idx.get(user_id)
    if target_user_sim_idx is None:
        return {mid: global_avg_rating for mid in candidate_mids}

    user_sims = user_sim_values[target_user_sim_idx]
    user_history = user_ratings_map.get(user_id, {})
    preds = {}

    for mid in candidate_mids:
        if mid in user_history:
            preds[mid] = user_history[mid]
            continue

        raters = movie_ratings_map.get(mid, {})
        if not raters:
            preds[mid] = global_avg_rating
            continue

        common_uids = [uid for uid in raters if uid in user_id_to_sim_idx]
        if not common_uids:
            preds[mid] = global_avg_rating
            continue

        common_sim_indices = [user_id_to_sim_idx[uid] for uid in common_uids]
        sims = user_sims[common_sim_indices]
        ratings_arr = np.array([raters[uid] for uid in common_uids])

        weighted_sum = np.dot(sims, ratings_arr)
        sum_sims = np.abs(sims).sum()

        preds[mid] = weighted_sum / sum_sims if sum_sims > 0 else global_avg_rating

    return preds


def build_hybrid_features(user_id: int, movie_id: int, content_score: float, collab_item_score: float, collab_user_score: float):
    user_count = user_counts.get(user_id, 0)
    user_avg = user_sums.get(user_id, 0.0) / user_count if user_count else global_avg_rating

    movie_count = movie_counts.get(movie_id, 0)
    movie_avg = movie_sums.get(movie_id, 0.0) / movie_count if movie_count else global_avg_rating

    return [
        user_avg,
        user_count,
        movie_avg,
        movie_count,
        collab_item_score,
        collab_user_score,
        content_score,
    ]


def get_hybrid_recommendations(user_id: int, movie_title: str, top_n: int = 10):
    seed_idx, seed_row = find_movie_by_title(movie_title)
    seed_mid = int(seed_row["movieId_x"])

    content_scores = get_hybrid_content_scores(seed_mid)
    collab_item_scores = get_hybrid_collab_item_scores(user_id)

    user_history = user_ratings_map.get(user_id, {})

    # --- FIX: Separate candidate pools to prevent collab noise drowning content ---
    # Content candidates: top 150 by content similarity to the seed movie.
    # These are always relevant regardless of whether the user has rated similar movies.
    content_candidates = {
        mid
        for mid in sorted(content_scores, key=lambda m: content_scores[m], reverse=True)[:150]
        if mid != seed_mid and mid not in user_history
    }

    # Collab candidates: only include if the user actually has rating history
    # (skip when collab scores are just global-average fill-ins — that's noise).
    has_real_collab_signal = bool(
        [mid for mid in user_history if mid in movie_id_to_sim_idx]
    )
    if has_real_collab_signal:
        collab_candidates = {
            mid
            for mid in sorted(collab_item_scores, key=lambda m: collab_item_scores[m], reverse=True)[:100]
            if mid != seed_mid and mid not in user_history
        }
    else:
        collab_candidates = set()

    # Union the two pools. Content candidates always included;
    # collab candidates added only when there is real signal.
    candidate_mids = list(content_candidates | collab_candidates)

    if not candidate_mids:
        return seed_row["title"], []

    collab_user_scores = get_hybrid_collab_user_scores_for_candidates(user_id, candidate_mids)

    feature_rows = []
    valid_mids = []
    for mid in candidate_mids:
        if mid not in movie_id_to_df_idx:
            continue

        feature_rows.append(
            build_hybrid_features(
                user_id,
                mid,
                float(content_scores.get(mid, 0.0)),
                float(collab_item_scores.get(mid, np.nan) if has_real_collab_signal else np.nan),
                float(collab_user_scores.get(mid, np.nan)),
            )
        )
        valid_mids.append(mid)

    if not valid_mids:
        return seed_row["title"], []

    X_candidates = pd.DataFrame(feature_rows, columns=feature_names)
    preds = xgboost_model.predict(X_candidates)

    results = pd.DataFrame(
        {
            "movieId": valid_mids,
            "predicted_rating": preds,
            "content_score": [content_scores.get(mid, 0.0) for mid in valid_mids],
            "item_collab_score": [
                collab_item_scores.get(mid, np.nan) if has_real_collab_signal else np.nan
                for mid in valid_mids
            ],
            "user_collab_score": [collab_user_scores.get(mid, np.nan) for mid in valid_mids],
        }
    )

    MIN_CONTENT_SCORE = 0.05
    results = results[results["content_score"] >= MIN_CONTENT_SCORE]

    results = results.sort_values(by="predicted_rating", ascending=False).head(top_n)
    results = results.merge(movies_by_id, left_on="movieId", right_index=True, how="left")

    recommendations = []
    for _, row in results.iterrows():
        meta = _movie_metadata(row)
        recommendations.append(
            {
                "movieId": _scalar_int(row["movieId"]),
                "title": row["title"],
                "tmdb_id": _scalar_int(row["tmdb_id"]),
                "predicted_rating": _scalar_float(row["predicted_rating"]),
                "content_score": _scalar_float(row["content_score"]),
                "item_collab_score": None if pd.isna(row["item_collab_score"]) else _scalar_float(row["item_collab_score"]),
                "user_collab_score": None if pd.isna(row["user_collab_score"]) else _scalar_float(row["user_collab_score"]),
                **meta,
            }
        )

    return seed_row["title"], recommendations


@app.get("/recommend")
def recommend(
    movie: str | None = None,
    movie_title: str | None = None,
    user_id: int | None = None,
    k: int = 10,
):
    """
    This endpoint takes a movie title as a query parameter and returns recommendations.
    It can also perform hybrid recommendation if user_id is provided.
    """
    title = movie_title or movie
    if not title:
        raise HTTPException(status_code=400, detail="Missing movie parameter 'movie' or 'movie_title'")

    if user_id is not None:
        seed_movie, recommendations = get_hybrid_recommendations(user_id, title, top_n=k)
        return {
            "user_id": user_id,
            "seed_movie": seed_movie,
            "seed_title": seed_movie,
            "recommendations": recommendations,
        }

    searched_movie, recommendations = get_recommendations_from_similarity(title, top_n=k)
    return {
        "searched_movie": searched_movie,
        "seed_title": searched_movie,
        "recommendations": recommendations,
    }


@app.get("/hybrid_recommend")
def hybrid_recommend(user_id: int, movie_title: str, top_n: int = 10):
    """
    This endpoint takes a user id and movie title and returns hybrid recommendations.
    Example: http://localhost:8000/hybrid_recommend?user_id=1&movie_title=Inception
    """

    seed_movie, recommendations = get_hybrid_recommendations(user_id, movie_title, top_n=top_n)
    return {
        "user_id": user_id,
        "seed_movie": seed_movie,
        "seed_title": seed_movie,
        "recommendations": recommendations,
    }


@app.get("/popular")
def get_popular_movies(n: int = 12):
    """
    Returns the top N popular/well-rated movies from the dataset.
    Used to populate the landing page before any search is made.
    """
    df = movies_by_id[
        movies_by_id["vote_average"].notna() & movies_by_id["popularity"].notna()
    ].copy()
    df["_score"] = df["vote_average"].astype(float) * np.log1p(df["popularity"].astype(float))
    top = df.nlargest(n, "_score")
    result = []
    for mid, row in top.iterrows():
        # pyrefly: ignore [redundant-cast]
        meta = _movie_metadata(cast(pd.Series, row))
        result.append({
            "movieId": _scalar_int(mid),
            "title": row["title"],
            "tmdb_id": _scalar_int(row["tmdb_id"]),
            "predicted_rating": _scalar_float(row["vote_average"]),
            "content_score": 0.0,
            "item_collab_score": None,
            "user_collab_score": None,
            **meta,
        })
    return {"movies": result}


@app.get("/genres")
def get_all_genres():
    """
    Returns all unique genres from the dataset, sorted alphabetically.
    Used to populate the genre filter panel on page load.
    """
    genre_set: set[str] = set()
    for genres_raw in movies_df["genres"].dropna():
        for g in str(genres_raw).replace("|", ",").split(","):
            g = g.strip()
            if g:
                genre_set.add(g)
    return {"genres": sorted(genre_set)}


@app.get("/movie_titles")
def get_movie_titles():
    """
    Returns all unique movie titles from the dataset, sorted alphabetically.
    Used by the frontend autocomplete search dropdown.
    """
    titles = sorted(movies_df["title"].dropna().unique().tolist())
    return {"titles": titles}


@app.get("/")
def read_root():
    return {"message": "Movie Recommender API is running!"}


if __name__ == "__main__":
    import sys

    import uvicorn

    project_root = BASE_DIR.parent
    if str(project_root) not in sys.path:
        sys.path.insert(0, str(project_root))

    uvicorn.run(
        "API.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=[str(BASE_DIR)],
    )
    