from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from typing import List, Optional

from zoneinfo import ZoneInfo

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ALMATY_TZ = ZoneInfo("Asia/Almaty")

_ASSETS_DIR = os.path.join(os.path.dirname(__file__), "..", "assets", "fonts")
_DEJAVU_PATH = os.path.abspath(os.path.join(_ASSETS_DIR, "DejaVuSans.ttf"))

if os.path.exists(_DEJAVU_PATH):
    try:
        pdfmetrics.registerFont(TTFont("DejaVu", _DEJAVU_PATH))
        _FONT_NAME = "DejaVu"
    except Exception:  # pragma: no cover - fallback in case the font file is broken
        _FONT_NAME = "Helvetica"
else:
    _FONT_NAME = "Helvetica"

_styles = getSampleStyleSheet()

TITLE = ParagraphStyle(
    "TITLE",
    parent=_styles["Title"],
    fontName=_FONT_NAME,
    fontSize=18,
    leading=22,
    alignment=TA_LEFT,
    spaceAfter=12,
)

LABEL = ParagraphStyle(
    "LABEL",
    parent=_styles["Normal"],
    fontName=_FONT_NAME,
    fontSize=10,
    leading=13,
)

CELL = ParagraphStyle(
    "CELL",
    parent=_styles["Normal"],
    fontName=_FONT_NAME,
    fontSize=10,
    leading=12,
)

CELL_CENTER = ParagraphStyle(
    "CELL_CENTER",
    parent=CELL,
    alignment=TA_CENTER,
)


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
    code = qr.QrCodeWidget(value or "")
    bounds = code.getBounds()
    w = bounds[2] - bounds[0]
    h = bounds[3] - bounds[1]
    if w == 0 or h == 0:
        w = h = 1
    drawing = Drawing(size, size, transform=[size / w, 0, 0, size / h, 0, 0])
    drawing.add(code)
    return drawing


def _format_datetime(value: datetime | str | None) -> str:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=ZoneInfo("UTC"))
        return value.astimezone(ALMATY_TZ).strftime("%d.%m.%Y %H:%M")
    return str(value) if value else ""


def _normalize_waybill_payload(data: WaybillData | dict) -> dict:
    if isinstance(data, WaybillData):
        created = data.created_at or now_almaty()
        items_list: List[dict[str, str | int]] = []
        total_qty = 0
        for item in data.items:
            qty = int(item.quantity or 0)
            total_qty += qty
            items_list.append({"name": item.name, "quantity": qty})
        return {
            "id": data.document_id,
            "from_branch": data.sender,
            "to_branch": data.receiver,
            "created_at": _format_datetime(created),
            "items": items_list,
            "total_quantity": total_qty,
        }

    payload = dict(data) if isinstance(data, dict) else {}
    payload["created_at"] = _format_datetime(payload.get("created_at"))

    items_raw = payload.get("items", []) or []
    normalized_items: List[dict[str, str | int]] = []
    total_quantity = 0
    for item in items_raw:
        if isinstance(item, dict):
            name = item.get("name", "")
            quantity = item.get("quantity", 0)
        else:
            name = str(item)
            quantity = 0
        try:
            qty_int = int(quantity)
        except (TypeError, ValueError):
            qty_int = 0
        total_quantity += max(qty_int, 0)
        normalized_items.append({"name": name, "quantity": qty_int})

    payload["items"] = normalized_items
    payload.setdefault("total_quantity", total_quantity)
    return payload


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
    story: List = []

    hdr_tbl = Table(
        [
            [
                Paragraph(f"Накладная № {payload.get('id', '')}", TITLE),
                _build_qr_drawing(payload.get("id", ""), 90),
            ]
        ],
        colWidths=[440, 100],
    )
    hdr_tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(hdr_tbl)
    story.append(Spacer(1, 8))

    story.append(Paragraph(f"<b>Откуда:</b> {payload.get('from_branch', '')}", LABEL))
    story.append(Paragraph(f"<b>Куда:</b> {payload.get('to_branch', '')}", LABEL))
    story.append(Paragraph(f"<b>Дата:</b> {payload.get('created_at', '')}", LABEL))
    story.append(Spacer(1, 8))

    thead = [
        [
            Paragraph("№", CELL_CENTER),
            Paragraph("Наименование", CELL),
            Paragraph("Ед.", CELL_CENTER),
            Paragraph("Кол-во", CELL_CENTER),
        ]
    ]

    tbody = []
    items = payload.get("items", []) or []
    for idx, item in enumerate(items, start=1):
        name = item.get("name", "") if isinstance(item, dict) else str(item)
        quantity = item.get("quantity", 0) if isinstance(item, dict) else 0
        tbody.append(
            [
                Paragraph(str(idx), CELL_CENTER),
                Paragraph(str(name), CELL),
                Paragraph("шт", CELL_CENTER),
                Paragraph(str(quantity), CELL_CENTER),
            ]
        )

    tbl = Table(thead + tbody, colWidths=[20, 350, 40, 60])
    tbl.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), _FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(tbl)

    total_quantity = payload.get("total_quantity")
    if not isinstance(total_quantity, int):
        try:
            total_quantity = int(total_quantity)
        except (TypeError, ValueError):
            total_quantity = sum(
                item.get("quantity", 0) for item in items if isinstance(item, dict)
            )

    story.append(Spacer(1, 16))
    story.append(
        Paragraph(
            f"Всего позиций: {len(items)}, всего единиц: {total_quantity}",
            LABEL,
        )
    )
    story.append(Spacer(1, 16))

    story.append(
        Paragraph(
            "Отпустил: ______________________________  Подпись: ____________",
            LABEL,
        )
    )
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            "Принял:   ______________________________  Подпись: ____________",
            LABEL,
        )
    )

    doc.build(story)
    return buf.getvalue()
