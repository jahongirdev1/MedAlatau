from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session
from zoneinfo import ZoneInfo

from database import Branch as DBBranch
from database import Shipment as DBShipment
from database import ShipmentItem as DBShipmentItem

ALMATY_TZ = ZoneInfo("Asia/Almaty")


def _fmt_dt(dt: Optional[datetime]) -> str:
    if not dt:
        return ""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(ALMATY_TZ).strftime("%Y-%m-%d %H:%M:%S")


def load_waybill_payload(db: Session, shipment_id: str) -> Optional[Dict[str, object]]:
    shipment = db.get(DBShipment, shipment_id)
    if not shipment:
        return None

    to_branch = db.get(DBBranch, getattr(shipment, "to_branch_id"))

    items: List[DBShipmentItem] = (
        db.execute(
            select(DBShipmentItem)
            .where(DBShipmentItem.shipment_id == shipment_id)
            .order_by(DBShipmentItem.id)
        )
        .scalars()
        .all()
    )

    rows = [
        {"name": item.item_name, "quantity": int(item.quantity or 0)}
        for item in items
    ]

    return {
        "id": str(shipment.id),
        "created_at": _fmt_dt(getattr(shipment, "created_at", None)),
        "from_branch": "Главный склад",
        "to_branch": getattr(to_branch, "name", "—"),
        "items": rows,
        "total_quantity": sum(row["quantity"] for row in rows),
    }
