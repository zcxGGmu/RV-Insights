from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.api.deps import get_current_user, get_db, require_role
from app.models.schemas import CaseCreate, CaseResponse, CaseListResponse, CaseStatus
from app.models.user import UserInDB

router = APIRouter()


@router.post("/", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(payload: CaseCreate, user: UserInDB = Depends(get_current_user), db = Depends(get_db)):
    # Minimal implementation: store in Mongo and return a CaseResponse
    cases = db.mongo_db["cases"]
    case_id = str(__import__("uuid").uuid4())
    now = __import__("datetime").datetime.utcnow()
    doc = {
        "_id": case_id,
        "title": payload.title,
        "target_repo": payload.target_repo,
        "input_context": payload.input_context,
        "contribution_type": payload.contribution_type or "",
        "owner_id": str(user.email),
        "status": CaseStatus.created.value,
        "exploration_result": None,
        "execution_plan": None,
        "development_result": None,
        "review_verdict": None,
        "test_result": None,
        "review_iterations": 0,
        "created_at": now,
        "updated_at": now,
        "cost": {"total_input_tokens": 0, "total_output_tokens": 0, "estimated_cost_usd": 0.0},
    }
    await cases.insert_one(doc)
    response = CaseResponse(
        id=case_id,
        title=payload.title,
        status=CaseStatus.created,
        target_repo=payload.target_repo,
        input_context=payload.input_context,
        owner_id=str(user.email),
        exploration_result=None,
        execution_plan=None,
        development_result=None,
        review_verdict=None,
        test_result=None,
        review_iterations=0,
        created_at=now,
        updated_at=now,
        cost={"total_input_tokens": 0, "total_output_tokens": 0, "estimated_cost_usd": 0.0},
    )
    return response


@router.get("/", response_model=CaseListResponse)
async def list_cases(page: int = 1, per_page: int = 20, status_filter: Optional[CaseStatus] = None, target_repo: Optional[str] = None, db = Depends(get_db), user: UserInDB = Depends(get_current_user)):
    cases = db.mongo_db["cases"]
    raw = await cases.find({})
    all_cases = await raw.to_list(length=None) if hasattr(raw, "to_list") else raw
    filtered = []
    for c in all_cases:
        if status_filter and c.get("status") != status_filter.value:
            continue
        if target_repo and c.get("target_repo") != target_repo:
            continue
        filtered.append(c)
    total = len(filtered)
    start = (page - 1) * per_page
    end = start + per_page
    items = [CaseResponse(
        id=str(c.get("_id")),
        title=c.get("title"),
        status=CaseStatus(c.get("status")),
        target_repo=c.get("target_repo"),
        input_context=c.get("input_context"),
        owner_id=str(c.get("owner_id")),
        exploration_result=None,
        execution_plan=None,
        development_result=None,
        review_verdict=None,
        test_result=None,
        review_iterations=c.get("review_iterations", 0),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
        cost=c.get("cost", {"total_input_tokens":0, "total_output_tokens":0, "estimated_cost_usd":0.0}),
    ) for c in filtered[start:end]]
    return CaseListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(case_id: str, db = Depends(get_db), user: UserInDB = Depends(get_current_user)):
    cases = db.mongo_db["cases"]
    c = await cases.find_one({"_id": case_id})
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return CaseResponse(
        id=str(c.get("_id")),
        title=c.get("title"),
        status=CaseStatus(c.get("status")),
        target_repo=c.get("target_repo"),
        input_context=c.get("input_context"),
        owner_id=str(c.get("owner_id")),
        exploration_result=c.get("exploration_result"),
        execution_plan=c.get("execution_plan"),
        development_result=c.get("development_result"),
        review_verdict=c.get("review_verdict"),
        test_result=c.get("test_result"),
        review_iterations=c.get("review_iterations", 0),
        created_at=c.get("created_at"),
        updated_at=c.get("updated_at"),
        cost=c.get("cost", {"total_input_tokens":0, "total_output_tokens":0, "estimated_cost_usd":0.0}),
    )


@router.delete("/{case_id}")
async def delete_case(case_id: str, db = Depends(get_db), user: UserInDB = Depends(require_role("admin"))):
    cases = db.mongo_db["cases"]
    result = await cases.delete_one({"_id": case_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return {"detail": "Deleted"}
