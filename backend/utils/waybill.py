from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from typing import List, Optional

from zoneinfo import ZoneInfo

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ALMATY_TZ = ZoneInfo("Asia/Almaty")


def now_almaty() -> datetime:
    return datetime.now(tz=ALMATY_TZ)


def safe_filename(prefix: str, id_: str | int, ext: str = "pdf") -> str:
    raw = f"{id_}"
    sanitized = "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in raw)
    return f"{prefix}_{sanitized}.{ext}"


@dataclass(slots=True)
class WaybillItem:
    name: str
    item_type: str  # "medicine" | "medical_device"
    quantity: int
    unit: str = "шт."
    note: Optional[str] = None


@dataclass(slots=True)
class WaybillData:
    document_id: str
    number: str
    created_at: datetime
    sender: str
    receiver: str
    items: List[WaybillItem] = field(default_factory=list)
    comment: Optional[str] = None
    prepared_by: Optional[str] = None
    received_by: Optional[str] = None
    company_name: Optional[str] = None
    qr_value: Optional[str] = None


def _build_qr_drawing(value: str, size: int = 80) -> Drawing:
    """
    Return a Drawing with a QR for 'value' scaled to 'size' x 'size'.
    We scale/translate on the Drawing, not on QrCodeWidget.
    """
    code = qr.QrCodeWidget(value or "")
    x1, y1, x2, y2 = code.getBounds()
    w, h = (x2 - x1), (y2 - y1)
    if w <= 0 or h <= 0:
        w = h = 1.0
    scale = float(size) / max(w, h)

    # Move origin so QR’s lower-left corner is at (0,0), then scale to target size.
    # transform = [sx, 0, 0, sy, tx, ty]
    tx = -x1 * scale
    ty = -y1 * scale
    d = Drawing(size, size, transform=[scale, 0, 0, scale, tx, ty])
    d.add(code)
    return d


def _normalize_waybill_payload(data: WaybillData | dict) -> dict:
    if isinstance(data, WaybillData):
        created = data.created_at or now_almaty()
        if isinstance(created, datetime) and created.tzinfo is None:
            created = created.replace(tzinfo=ZoneInfo("UTC"))
        items = [
            {
                "name": item.name,
                "type": item.item_type,
                "quantity": item.quantity,
            }
            for item in data.items
        ]
        return {
            "id": data.document_id,
            "from_branch": data.sender,
            "to_branch": data.receiver,
            "created_at": created.astimezone(ALMATY_TZ).isoformat(),
            "items": items,
        }
    return data


def render_waybill_pdf(data: WaybillData | dict) -> bytes:
    payload = _normalize_waybill_payload(data)

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        topMargin=24,
        bottomMargin=24,
        leftMargin=28,
        rightMargin=28,
    )
    styles = getSampleStyleSheet()
    story: List = []

    short_id = payload.get("id", "")[:8]
    qr_drawing = _build_qr_drawing(payload.get("id", ""))

    header_table = Table(
        [
            [
                Paragraph(f"<b>Накладная № {short_id}</b>", styles["Title"]),
                qr_drawing,
            ]
        ],
        colWidths=[doc.width - 90, 80],
    )
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("BOX", (0, 0), (-1, -1), 0, colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 8))

    story.append(Paragraph(f"Откуда: <b>{payload.get('from_branch', '')}</b>", styles["Normal"]))
    story.append(Paragraph(f"Куда: <b>{payload.get('to_branch', '')}</b>", styles["Normal"]))

    created_at = payload.get("created_at", "")
    if isinstance(created_at, datetime):
        created_at = created_at.astimezone(ALMATY_TZ).isoformat()
    created_text = str(created_at).replace("T", " ")
    story.append(Paragraph(f"Дата: {created_text}", styles["Normal"]))
    story.append(Spacer(1, 10))

    rows = [["№", "Наименование", "Вид", "Кол-во"]]
    total_qty = 0
    items = payload.get("items", []) or []
    for idx, item in enumerate(items, start=1):
        name = item.get("name", "")
        item_type = item.get("type", "")
        quantity = item.get("quantity", 0)
        rows.append(
            [
                idx,
                name,
                "Лекарство" if item_type == "medicine" else "ИМН",
                quantity,
            ]
        )
        try:
            total_qty += int(quantity)
        except (TypeError, ValueError):
            pass

    table = Table(rows, colWidths=[28, 300, 90, 60])
    table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 8))

    story.append(
        Paragraph(
            f"Всего позиций: {len(items)}, всего единиц: {total_qty}",
            styles["Italic"],
        )
    )
    story.append(Spacer(1, 16))

    story.append(
        Paragraph(
            "Отпустил: _____________________________   Дата: ____________",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            "Получил:  _____________________________   Дата: ____________",
            styles["Normal"],
        )
    )

    doc.build(story)
    return buf.getvalue()
