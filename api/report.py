"""Session PDF with timestamps and the enter-count summary."""

from __future__ import annotations

from fpdf import FPDF

from domain import LABELS


def build_pdf(session: dict, events: list[dict], summary: list[dict]) -> bytes:
    class ClinicalReportPDF(FPDF):
        def footer(self):
            self.set_y(-15)
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(130, 140, 135)
            self.cell(
                0,
                10,
                f"Page {self.page_no()}/{{nb}}  |  Confidential Operating Theatre Procedure Audit  |  GIET University",
                align="C",
            )

    pdf = ClinicalReportPDF()
    pdf.compress = False
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    # Top banner / accent bar
    pdf.set_fill_color(24, 40, 34)
    pdf.rect(0, 0, 210, 22, "F")
    pdf.set_xy(10, 4)
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_text_color(240, 245, 242)
    pdf.cell(0, 7, "SURGICAL THEATRE INSTRUMENT LOG", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=8.5)
    pdf.set_text_color(180, 205, 195)
    pdf.cell(
        0,
        5,
        "Real-Time Computer Vision & Hands-Free Gesture Procedure Audit Report",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(7)

    # Session metadata card
    pdf.set_fill_color(246, 248, 247)
    pdf.set_draw_color(205, 215, 210)
    card_y = pdf.get_y()
    pdf.rect(10, card_y, 190, 26, "DF")
    pdf.set_xy(14, card_y + 3)
    pdf.set_text_color(30, 40, 36)
    pdf.set_font("Helvetica", "B", 10)
    pdf.cell(95, 6, _safe(f"Procedure: {session.get('name', 'Untitled')}"))
    pdf.cell(95, 6, _safe(f"Session ID: #{session.get('id', '-')}"), new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(14)
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(80, 90, 85)
    started = str(session.get("started_at", "-")).replace("T", " ")[:19]
    ended = str(session.get("ended_at") or "Still Active").replace("T", " ")[:19]
    created_by = str(session.get("created_by", "Staff"))
    pdf.cell(95, 5, _safe(f"Started: {started} UTC"))
    pdf.cell(95, 5, _safe(f"Operator: {created_by}"), new_x="LMARGIN", new_y="NEXT")

    pdf.set_x(14)
    status_text = "Completed" if session.get("ended_at") else "In Progress"
    pdf.cell(95, 5, _safe(f"Ended:   {ended} UTC"))
    pdf.cell(95, 5, _safe(f"Status:   {status_text}"), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(9)

    # Section 1: Instrument Reconciliation Summary
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(24, 40, 34)
    pdf.cell(0, 7, "Instrument Reconciliation Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    # Summary Table Header
    pdf.set_fill_color(230, 237, 233)
    pdf.set_draw_color(190, 205, 198)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 45, 38)
    pdf.cell(120, 7, "Instrument Class", border=1, fill=True)
    pdf.cell(70, 7, "Verified Enter Count", border=1, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(50, 55, 52)
    if not summary:
        pdf.cell(190, 7, "No instrument data recorded for this procedure.", border=1, new_x="LMARGIN", new_y="NEXT")
    else:
        for i, row in enumerate(summary):
            label = LABELS.get(row["class"], row["class"])
            count = row["enter_count"]
            fill_bg = (255, 255, 255) if i % 2 == 0 else (246, 249, 247)
            pdf.set_fill_color(*fill_bg)
            pdf.cell(120, 6.5, _safe(f"  {label}"), border=1, fill=True)
            pdf.cell(70, 6.5, _safe(str(count)), border=1, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(6)

    # Section 2: Procedure Audit Events
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(24, 40, 34)
    pdf.cell(0, 7, "Procedure Events Audit Trail", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(1)

    # Events Table Header
    pdf.set_fill_color(230, 237, 233)
    pdf.set_draw_color(190, 205, 198)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(30, 45, 38)
    pdf.cell(45, 7, "Timestamp (UTC)", border=1, fill=True)
    pdf.cell(35, 7, "Event Type", border=1, fill=True)
    pdf.cell(85, 7, "Instrument Class", border=1, fill=True)
    pdf.cell(25, 7, "Track ID", border=1, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", size=8.5)
    if not events:
        pdf.cell(190, 7, "No events recorded.", border=1, new_x="LMARGIN", new_y="NEXT")
    else:
        for i, event in enumerate(events):
            label = LABELS.get(event["class_name"], event["class_name"] or "—")
            track = "—" if event["track_id"] is None else f"#{event['track_id']}"
            event_type = event["type"].replace("_", " ").upper()
            ts = str(event["ts"]).replace("T", " ")[:19]

            fill_bg = (255, 255, 255) if i % 2 == 0 else (247, 250, 248)
            pdf.set_fill_color(*fill_bg)
            pdf.set_text_color(60, 65, 62)
            pdf.cell(45, 6, _safe(ts), border=1, fill=True)

            if "ENTER" in event_type:
                pdf.set_text_color(25, 125, 65)
            elif "EXIT" in event_type:
                pdf.set_text_color(110, 115, 112)
            elif "PAUSE" in event_type or "RESUME" in event_type:
                pdf.set_text_color(185, 105, 25)
            elif "MARK" in event_type:
                pdf.set_text_color(35, 95, 175)
            pdf.cell(35, 6, _safe(event_type), border=1, fill=True)

            pdf.set_text_color(50, 55, 52)
            pdf.cell(85, 6, _safe(label)[:50], border=1, fill=True)
            pdf.cell(25, 6, _safe(track), border=1, fill=True, align="C", new_x="LMARGIN", new_y="NEXT")

    pdf.ln(7)

    # Verification / Sign-off Block
    if pdf.get_y() > 240:
        pdf.add_page()
    pdf.set_font("Helvetica", "B", 9.5)
    pdf.set_text_color(24, 40, 34)
    pdf.cell(0, 6, "Sterile Field Reconciliation Sign-Off", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", size=8.5)
    pdf.set_text_color(90, 95, 92)
    pdf.cell(
        0,
        5,
        "I certify that the above instrument tracking log reconciles with surgical staff manual counts.",
        new_x="LMARGIN",
        new_y="NEXT",
    )
    pdf.ln(6)

    pdf.set_font("Helvetica", size=8.5)
    pdf.set_text_color(50, 55, 52)
    pdf.cell(95, 6, "Scrub Nurse Signature:  ___________________________")
    pdf.cell(95, 6, "Date:  ________________________", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(3)
    pdf.cell(95, 6, "Lead Surgeon Signature: ___________________________")
    pdf.cell(95, 6, "Date:  ________________________", new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


def _safe(value) -> str:
    return str(value).encode("latin-1", "replace").decode("latin-1")
