from fastapi import APIRouter, Depends

from core.deps import get_current_user
from models.database import User
from services.ai_engine import ai_engine
import pandas as pd

router = APIRouter()


@router.get("/segmentation")
def get_customer_segments(user: User = Depends(get_current_user)):
    # Mock customer data for segmentation
    data = {
        'spend': [100, 500, 200, 800, 150, 400],
        'frequency': [2, 10, 5, 15, 3, 8],
        'age': [25, 34, 45, 23, 50, 28]
    }
    df = pd.DataFrame(data)
    segments = ai_engine.segment_customers(df)
    
    # Map segments to descriptive names
    segment_names = {0: "Budget Shoppers", 1: "High Spenders", 2: "Loyal Fans"}
    result = [{"customer_id": i, "segment": segment_names.get(s, "Other")} for i, s in enumerate(segments)]
    
    return {"status": "success", "segments": result}
