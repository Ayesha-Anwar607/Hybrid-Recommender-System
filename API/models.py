from sqlalchemy import Column, Integer, String, ForeignKey, Float, DateTime, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime, timezone


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)  # Never store plain text passwords!

    # Relationship to link user to their history
    interactions = relationship(
        "UserInteraction",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username={self.username!r}, email={self.email!r})>"


class Movie(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    tmdb_id = Column(Integer, unique=True, index=True, nullable=False)
    title = Column(String(500), index=True, nullable=False)
    overview = Column(String(2000))
    vote_average = Column(Float)
    # Add any other clean columns you want to query dynamically

    # Relationship to link movie to its interactions
    interactions = relationship(
        "UserInteraction",
        back_populates="movie",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Movie(id={self.id}, tmdb_id={self.tmdb_id}, title={self.title!r})>"


class UserInteraction(Base):
    __tablename__ = "user_interactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    movie_id = Column(Integer, ForeignKey("movies.id", ondelete="CASCADE"), nullable=False)

    # Validated enum — prevents silent typos like 'licked' instead of 'liked'
    interaction_type = Column(
        Enum("clicked", "liked", "rated", name="interaction_type_enum"),
        nullable=False,
    )

    # Only populated when interaction_type == 'rated'
    rating_value = Column(Float, nullable=True)

    # Timezone-aware timestamp
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="interactions")
    movie = relationship("Movie", back_populates="interactions")

    def __repr__(self) -> str:
        return (
            f"<UserInteraction(id={self.id}, user_id={self.user_id}, "
            f"movie_id={self.movie_id}, type={self.interaction_type!r}, "
            f"rating={self.rating_value})>"
        )