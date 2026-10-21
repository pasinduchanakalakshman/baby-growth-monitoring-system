"""Nutrition API Routes for Personalized Sri Lankan Nutrition Recommendations.

Provides authenticated endpoints for:
- Retrieving personalized nutrition recommendations for a registered baby
- Getting baby-specific nutrition preferences
- Updating baby-specific nutrition preferences

All operations require parent authentication and strict baby ownership verification.
"""

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models import Baby, User
from app.models.nutrition import BabyNutritionPreferences
from app.schemas.nutrition import (
    BabyNutritionPreferencesResponse,
    BabyNutritionPreferencesUpdate,
    ChildNutritionProfile,
    DailyMealPlanResponse,
    NutritionRecommendationResponse,
    RestrictionGroupCode,
    SubstituteValidationRequest,
    SubstituteValidationResponse,
    WeeklyMealPlanResponse,
)
from app.services.nutrition_catalog_service import (
    get_colombo_today,
    get_nutrition_catalog_service,
)
from app.services.nutrition_recommendation_service import (
    generate_nutrition_recommendations,
)
from app.services.nutrition_planner_service import (
    get_nutrition_planner_service,
)

router = APIRouter(prefix="/api/v1/nutrition", tags=["nutrition"])

ALLOWED_MILK_FEEDING_METHODS = {
    "exclusive_breastfeeding",
    "complementary_breastfeeding",
    "infant_formula_only",
    "cow_milk",
    "other",
}


def resolve_authorized_baby(
    db: Session,
    current_user: User,
    baby_id: Optional[int] = None,
) -> Baby:
    """
    Resolves the requested baby and verifies ownership by the authenticated parent.
    - If baby_id is provided: resolves by ID, raises 404 if not found, 403 if not owned by user.
    - If baby_id is None:
      - If user has 0 babies: raises 404 "Baby not found. Please register a baby first."
      - If user has exactly 1 baby: returns that baby deterministically.
      - If user has >1 babies: raises 400 to disambiguate.
    Never silently chooses the wrong baby.
    Never accepts client-controlled overrides of date_of_birth or parent ownership.
    """
    if baby_id is not None:
        baby = db.query(Baby).filter(Baby.id == baby_id).first()
        if not baby:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Baby not found",
            )
        if baby.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to access this baby's records",
            )
        return baby

    user_babies = db.query(Baby).filter(Baby.owner_id == current_user.id).all()
    if not user_babies:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Baby not found. Please register a baby first.",
        )
    if len(user_babies) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Multiple registered babies found for this parent. Please provide baby_id parameter to disambiguate.",
        )
    return user_babies[0]


def validate_preference_inputs(
    prefs_in: BabyNutritionPreferencesUpdate,
    baby_dob: date,
    today: date,
) -> None:
    """
    Validates preference fields against business constraints and knowledge catalogue.
    Raises HTTPException(400) for semantic or reference errors.
    """
    catalog_service = get_nutrition_catalog_service()
    catalog = catalog_service.load_catalog()

    # 1. Date checks
    if prefs_in.complementary_feeding_start_date is not None:
        if prefs_in.complementary_feeding_start_date > today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Complementary feeding start date cannot be in the future",
            )
        if prefs_in.complementary_feeding_start_date < baby_dob:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Complementary feeding start date cannot be before date of birth",
            )

    # 2. Milk-feeding method check
    if prefs_in.milk_feeding_method is not None:
        if prefs_in.milk_feeding_method not in ALLOWED_MILK_FEEDING_METHODS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid milk feeding method. Allowed values: {sorted(list(ALLOWED_MILK_FEEDING_METHODS))}",
            )

    # 3. Introduced foods validation
    if prefs_in.foods_introduced is not None:
        for ing_id in prefs_in.foods_introduced:
            if not catalog_service.get_ingredient(ing_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown ingredient ID in foods_introduced: {ing_id}",
                )

    # 4. Restricted foods validation (restriction groups or individual ingredient IDs)
    if prefs_in.restricted_foods is not None:
        valid_groups = set(RestrictionGroupCode.__members__.keys())
        for code in prefs_in.restricted_foods:
            if code not in valid_groups and not catalog_service.get_ingredient(code):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid restriction group code or ingredient ID in restricted_foods: {code}",
                )

    # 5. Available household ingredients validation
    if prefs_in.available_ingredients is not None:
        for ing_id in prefs_in.available_ingredients:
            if not catalog_service.get_ingredient(ing_id):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown ingredient ID in available_ingredients: {ing_id}",
                )

    # 6. Recent meal history validation
    if prefs_in.recent_meal_history is not None:
        valid_dish_ids = {d.dish_id for d in catalog.dishes}
        valid_snack_ids = {s.snack_id for s in catalog.snacks}
        for dish_id in prefs_in.recent_meal_history:
            if dish_id not in valid_dish_ids and dish_id not in valid_snack_ids:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unknown dish or snack ID in recent_meal_history: {dish_id}",
                )


@router.get("/recommendations", response_model=NutritionRecommendationResponse)
def get_nutrition_recommendations(
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    evaluation_date: Optional[date] = Query(default=None, description="Optional evaluation date override"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves personalized nutrition recommendations for an authenticated parent's baby.
    Strictly uses the registered baby's date of birth and verified parent ownership.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)
    today = get_colombo_today()

    # Safety validation on evaluation_date
    if evaluation_date is not None:
        if evaluation_date > today:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Evaluation date cannot be in the future. Future meal simulations are not permitted in standard parent requests.",
            )
        if evaluation_date < baby.date_of_birth:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Evaluation date cannot be before baby date of birth.",
            )

    # Retrieve optional preferences
    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()

    # Construct validated child nutrition profile
    profile = _build_profile_for_baby(baby=baby, prefs=prefs)

    return generate_nutrition_recommendations(profile=profile, evaluation_date=evaluation_date)


@router.get("/preferences", response_model=BabyNutritionPreferencesResponse)
def get_baby_nutrition_preferences(
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieves stored nutrition preferences for an authenticated parent's baby.
    Returns default empty preferences if no record has been created yet.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)

    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()
    if not prefs:
        return BabyNutritionPreferencesResponse(
            baby_id=baby.id,
            complementary_feeding_start_date=None,
            milk_feeding_method=None,
            foods_introduced=[],
            restricted_foods=[],
            available_ingredients=[],
            dietary_preferences=[],
            recent_meal_history=[],
            only_available_ingredients=False,
            created_at=None,
            updated_at=None,
        )

    return prefs



def _build_profile_for_baby(baby: Baby, prefs: Optional[BabyNutritionPreferences]) -> ChildNutritionProfile:
    """Constructs a validated ChildNutritionProfile from database models."""
    return ChildNutritionProfile(
        date_of_birth=baby.date_of_birth,
        biological_sex=baby.sex.value if hasattr(baby.sex, "value") else baby.sex,
        complementary_feeding_start_date=prefs.complementary_feeding_start_date if prefs else None,
        milk_feeding_method=prefs.milk_feeding_method if prefs else None,
        foods_introduced=prefs.foods_introduced if prefs else [],
        restricted_foods=prefs.restricted_foods if prefs else [],
        available_ingredients=prefs.available_ingredients if prefs else [],
        only_available_ingredients=prefs.only_available_ingredients if prefs else False,
        dietary_preferences=prefs.dietary_preferences if prefs else [],
        recent_meal_history=prefs.recent_meal_history if prefs else [],
    )


@router.put("/preferences", response_model=BabyNutritionPreferencesResponse)
def update_baby_nutrition_preferences(
    prefs_in: BabyNutritionPreferencesUpdate,
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Updates nutrition preferences for an authenticated parent's baby.
    Validates input integrity and preserves existing values for omitted fields.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)
    today = get_colombo_today()

    # Validate inputs against catalogue and baby DOB
    validate_preference_inputs(prefs_in=prefs_in, baby_dob=baby.date_of_birth, today=today)

    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()
    if not prefs:
        prefs = BabyNutritionPreferences(baby_id=baby.id)
        db.add(prefs)

    update_dict = prefs_in.model_dump(exclude_unset=True)
    for field, val in update_dict.items():
        setattr(prefs, field, val)

    try:
        db.commit()
        db.refresh(prefs)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database transaction error while saving nutrition preferences",
        )

    return prefs


@router.get("/plans/daily", response_model=DailyMealPlanResponse)
def get_daily_meal_plan(
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    date: Optional[date] = Query(default=None, description="Plan date (Asia/Colombo), bounded to [DOB, today + 30 days]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a deterministic, age-appropriate Daily Meal Plan for an authenticated parent's baby.
    Strictly verifies baby ownership, checks date boundaries, and respects all FHB 2025 feeding rules.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)
    today = get_colombo_today()
    target_date = date or today

    # Bounded planning horizon validation
    if target_date < baby.date_of_birth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning date cannot precede baby's date of birth.",
        )
    if target_date > today + timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning date exceeds the allowed 30-day forward planning horizon.",
        )
    if target_date < today - timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning date cannot be more than 30 days in the past.",
        )

    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()
    profile = _build_profile_for_baby(baby=baby, prefs=prefs)

    planner = get_nutrition_planner_service()
    return planner.generate_daily_meal_plan(profile=profile, plan_date=target_date, baby_id=baby.id)


@router.get("/plans/weekly", response_model=WeeklyMealPlanResponse)
def get_weekly_meal_plan(
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    start_date: Optional[date] = Query(default=None, description="First date of 7-day plan (Asia/Colombo), bounded to [DOB, today + 30 days]"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generates a deterministic 7-day Weekly Meal Plan for an authenticated parent's baby.
    Resolves child age and feeding stage independently on EACH calendar date.
    Applies rotation scoring penalties to ensure meal diversity while preserving fallback options.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)
    today = get_colombo_today()
    target_start_date = start_date or today

    # Bounded planning horizon validation
    if target_start_date < baby.date_of_birth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning start date cannot precede baby's date of birth.",
        )
    if target_start_date > today + timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning start date exceeds the allowed 30-day forward planning horizon.",
        )
    if target_start_date < today - timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Planning start date cannot be more than 30 days in the past.",
        )

    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()
    profile = _build_profile_for_baby(baby=baby, prefs=prefs)

    planner = get_nutrition_planner_service()
    return planner.generate_weekly_meal_plan(profile=profile, start_date=target_start_date, baby_id=baby.id)


@router.post("/plans/substitute-check", response_model=SubstituteValidationResponse)
def validate_meal_substitution(
    request: SubstituteValidationRequest,
    baby_id: Optional[int] = Query(default=None, description="Registered baby database ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Revalidates on the backend that a proposed replacement meal/snack satisfies all hard clinical
    and developmental constraints for the baby on the target date.
    """
    baby = resolve_authorized_baby(db=db, current_user=current_user, baby_id=baby_id)
    today = get_colombo_today()

    if request.plan_date < baby.date_of_birth:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Substitution date cannot precede baby's date of birth.",
        )
    if request.plan_date > today + timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Substitution date exceeds the allowed 30-day forward planning horizon.",
        )
    if request.plan_date < today - timedelta(days=30):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Substitution date cannot be more than 30 days in the past.",
        )

    prefs = db.query(BabyNutritionPreferences).filter(BabyNutritionPreferences.baby_id == baby.id).first()
    profile = _build_profile_for_baby(baby=baby, prefs=prefs)

    planner = get_nutrition_planner_service()
    return planner.validate_substitution(
        profile=profile,
        plan_date=request.plan_date,
        original_food_id=request.original_food_id,
        replacement_food_id=request.replacement_food_id,
    )

