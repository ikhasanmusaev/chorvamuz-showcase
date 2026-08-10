"""User-level helpers — find/click/assert in a way the user would.

Rule: always prefer semantic / accessibility-based selectors:
  - get_by_role(role, name=text)
  - get_by_label(text)
  - get_by_text(text, exact=False)
  - get_by_placeholder(text)
Use raw CSS only as a fallback when no semantic selector is possible.

Причина не в чистоте кода: селектор по классу Tailwind ломается от любой
правки вёрстки и при этом ничего не проверяет. Селектор по роли и названию
кнопки ломается тогда, когда кнопка действительно исчезла или переименована —
то есть тогда, когда должен.
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

    В узбекской латинице апостроф — часть буквы (Bo'sh, To'lov), и редакторы
    подставляют то прямой, то типографский. Без нормализации проверка текста
    падает на символе, которого человек на экране не различает.
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

    Список названий, а не одно: интерфейс двуязычный и формулировки меняются.
    Проверяем, что действие доступно человеку, а не что подпись совпала
    буква в букву.
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
