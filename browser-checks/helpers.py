"""User-level helpers — find/click/assert in a way the user would.

Rule: always prefer semantic / accessibility-based selectors:
  - get_by_role(role, name=text)
  - get_by_label(text)
  - get_by_text(text, exact=False)
  - get_by_placeholder(text)
Use raw CSS only as a fallback when no semantic selector is possible.

The reason is not code cleanliness: a selector bound to a Tailwind class breaks on
any markup change while verifying nothing. A selector bound to a role and a button
label breaks when the button has actually disappeared or been renamed — that is,
when it should.
"""
from __future__ import annotations

import time
from typing import Optional, Sequence

from playwright.sync_api import Locator, TimeoutError as PWTimeout


def goto(ctx, route: str, wait_until="networkidle"):
    ctx.page.goto(f"{ctx.frontend_url}{route}", wait_until=wait_until, timeout=30000)
    time.sleep(3.0)


def _normalize(s: str) -> str:
    """Lowercase + normalize curly apostrophes.

    In Uzbek Latin script the apostrophe is part of a letter (Bo'sh, To'lov), and
    editors insert either a straight or a typographic one. Without normalization a
    text check fails on a character the user cannot tell apart on screen.
    """
    return (s or "").lower().replace("’", "'").replace("‘", "'").replace("`", "'")


def body_text_contains_any(ctx, fragments) -> bool:
    """True if normalized body text contains any of the lowercase fragments."""
    body = _normalize(ctx.page.locator("body").inner_text())
    return any(_normalize(f) in body for f in fragments)


def assert_any_text(ctx, fragments, message: str = ""):
    """Assert body contains at least one of given fragments (apostrophe-normalized)."""
    if not body_text_contains_any(ctx, fragments):
        raise AssertionError(message or f"None of fragments visible: {list(fragments)[:5]}")


def assert_text_visible(ctx, text: str, timeout_ms: int = 5000):
    """Assert text is visible somewhere on the page (case-insensitive substring)."""
    try:
        ctx.page.get_by_text(text, exact=False).first.wait_for(state="visible", timeout=timeout_ms)
    except PWTimeout:
        # Fallback to body-text scan with apostrophe normalization
        if body_text_contains_any(ctx, [text]):
            return
        raise AssertionError(f"Text not visible: '{text}'")


def click_button_with_name(ctx, names: Sequence[str], scope: Optional[Locator] = None) -> Locator:
    """Click a button matching any of the given names. Returns the locator clicked.

    A list of names rather than one: the interface is bilingual and wording changes.
    We verify that the action is available to the user, not that a label matched
    letter for letter.
    """
    root = scope or ctx.page
    for name in names:
        btn = root.get_by_role("button", name=name, exact=False)
        if btn.count() > 0:
            visible_btn = btn.first
            visible_btn.scroll_into_view_if_needed()
            visible_btn.click()
            return visible_btn
    raise AssertionError(f"No button found with names {list(names)}")
