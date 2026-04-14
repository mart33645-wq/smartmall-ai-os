from sqlalchemy.orm import Session
from models.database import Shop
from typing import List, Optional

class ShopRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> List[Shop]:
        return self.db.query(Shop).all()

    def get_by_id(self, shop_id: int) -> Optional[Shop]:
        return self.db.query(Shop).filter(Shop.id == shop_id).first()

    def create(self, shop_data: dict) -> Shop:
        db_shop = Shop(**shop_data)
        self.db.add(db_shop)
        self.db.commit()
        self.db.refresh(db_shop)
        return db_shop

    def update(self, shop_id: int, shop_data: dict) -> Optional[Shop]:
        db_shop = self.get_by_id(shop_id)
        if db_shop:
            for key, value in shop_data.items():
                setattr(db_shop, key, value)
            self.db.commit()
            self.db.refresh(db_shop)
        return db_shop

    def delete(self, shop_id: int) -> bool:
        db_shop = self.get_by_id(shop_id)
        if db_shop:
            self.db.delete(db_shop)
            self.db.commit()
            return True
        return False
