from enum import Enum
from typing import Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


class ItemType(str, Enum):
    medicine = "medicine"
    medical_device = "medical_device"


def get_available_qty(
    db: Session, branch_id: Optional[str], item_type: ItemType, item_id: str
) -> Tuple[int, Optional[str]]:
    """Return available quantity and item name for given branch and item."""
    table = "medicines" if item_type == ItemType.medicine else "medical_devices"
    if branch_id is None:
        row = db.execute(
            text(
                f"SELECT quantity, name FROM {table} WHERE id = :i AND branch_id IS NULL"
            ),
            {"i": item_id},
        ).first()
    else:
        row = db.execute(
            text(
                f"SELECT quantity, name FROM {table} WHERE id = :i AND branch_id = :b"
            ),
            {"i": item_id, "b": branch_id},
        ).first()
    if not row:
        return 0, None
    return int(row[0]), row[1]


def decrement_stock(
    db: Session,
    branch_id: Optional[str],
    item_type: ItemType,
    item_id: str,
    qty: int,
) -> None:
    """Decrement stock atomically; raise ValueError if insufficient."""
    if qty <= 0:
        return
    table = "medicines" if item_type == ItemType.medicine else "medical_devices"
    if branch_id is None:
        res = db.execute(
            text(
                f"""
                UPDATE {table}
                   SET quantity = quantity - :q
                 WHERE id = :i AND branch_id IS NULL AND quantity >= :q
                RETURNING quantity
            """
            ),
            {"i": item_id, "q": qty},
        ).first()
    else:
        res = db.execute(
            text(
                f"""
                UPDATE {table}
                   SET quantity = quantity - :q
                 WHERE id = :i AND branch_id = :b AND quantity >= :q
                RETURNING quantity
            """
            ),
            {"i": item_id, "b": branch_id, "q": qty},
        ).first()
    if not res:
        raise ValueError(
            f"Not enough stock for {item_type}:{item_id}"
        )


def get_main_available_qty(
    db: Session, item_type: ItemType, item_id: str
) -> Tuple[int, Optional[str]]:
    """Convenience helper to get availability on the main warehouse (branch is NULL)."""
    return get_available_qty(db, None, item_type, item_id)
