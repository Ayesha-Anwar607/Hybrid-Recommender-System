from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field, model_validator


# --- USER SCHEMAS ---
class UserCreate(BaseModel):
    username: str = Field(
        ...,
        min_length=3,
        max_length=50,
        pattern=r"^[a-zA-Z0-9_-]+$",
        description="Username must be 3-50 characters long and contain only letters, numbers, underscores, or hyphens.",
    )
    email: EmailStr = Field(..., description="A valid email address.")
    password: str = Field(
        ...,
        min_length=6,
        max_length=100,
        description="Password must be at least 6 characters long.",
    )


class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr

    model_config = {"from_attributes": True}


class UserLogin(BaseModel):
    username: str
    password: str


# --- TOKEN SCHEMAS ---
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


# --- INTERACTIONS SCHEMA ---
class InteractionCreate(BaseModel):
    movie_id: int = Field(..., gt=0, description="Database or TMDB Movie ID (must be positive).")
    interaction_type: Literal["clicked", "liked", "rated"] = Field(
        ...,
        description="Type of interaction: 'clicked', 'liked', or 'rated'.",
    )
    rating_value: Optional[float] = Field(
        default=None,
        ge=0.5,
        le=5.0,
        description="Rating value must be between 0.5 and 5.0. Required only if interaction_type is 'rated'.",
    )

    @model_validator(mode="after")
    def validate_rating_requirement(self) -> "InteractionCreate":
        if self.interaction_type == "rated":
            if self.rating_value is None:
                raise ValueError("rating_value is required when interaction_type is 'rated'")
        else:
            if self.rating_value is not None:
                raise ValueError(
                    f"rating_value should be None when interaction_type is '{self.interaction_type}'"
                )
        return self


class InteractionResponse(BaseModel):
    id: int
    user_id: int
    movie_id: int
    interaction_type: str
    rating_value: Optional[float]
    timestamp: datetime

    model_config = {"from_attributes": True}
