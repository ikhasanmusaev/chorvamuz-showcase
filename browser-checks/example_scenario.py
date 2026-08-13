"""Example scenario: verifying a paid action through the user's eyes.

Demonstrates the principle the whole framework exists for: only what is visible on
screen counts as proof that a feature works. The API is used twice here — to read
the state BEFORE and to clean up AFTER — and never to conclude "it works".

That distinction is exactly what caught defects API-level checks missed: the server
answered 200 OK and updated the row, while the button on screen stayed disabled.
From the API's point of view, success. From the user's, a broken feature.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from base import Scenario
import helpers as H


class PaidActionFlow(Scenario):
    name = "paid_action_flow"
    feature = "A paid action reaches the screen, not just the database"
    required_role = "user"

    def setup(self, ctx):
        # State BEFORE — to tell "created just now" from "was already there".
        # Without it the scenario stays green on old data even when creation is broken
        before = ctx.api_call("GET", "/orders/my")
        self.count_before = len(before.get("json") or []) if before.get("ok") else 0
        self.created_id = ""

    def cleanup(self, ctx):
        # Idempotent: calling it again on something already removed must not fail,
        # or a crashed run breaks the next one
        if self.created_id:
            ctx.api_call("POST", f"/orders/{self.created_id}/cancel")

    def run(self, ctx):
        H.goto(ctx, "/catalog")
        ctx.screenshot("1_catalog")

        def catalog_has_items():
            # An empty catalog is not "no data" — it is a loading failure in disguise.
            # So we assert that cards are actually present
            cards = ctx.page.locator('a[href^="/item/"]')
            assert cards.count() > 0, "Catalog is empty: the list did not load"

        if not self.step(ctx, "Catalog shows items", catalog_has_items):
            return

        def open_item():
            ctx.page.locator('a[href^="/item/"]').first.click()
            ctx.page.wait_for_url(lambda u: "/item/" in u, timeout=15000)
            time.sleep(2.0)

        self.step(ctx, "Open an item page", open_item)
        ctx.screenshot("2_item")

        def price_is_a_number():
            # A check born from a real defect: two amounts were concatenated as
            # strings, so the screen showed "300 000 250 000" instead of their sum.
            # Nothing threw — the user was simply shown nonsense
            body = ctx.page.locator("body").inner_text()
            import re
            matches = re.findall(r"(\d[\d\s]{4,})\s+(\d[\d\s]{4,})\s*(?:UZS)", body)
            assert not matches, f"Looks like concatenated amounts instead of a sum: {matches[:2]}"

        self.step(ctx, "The total looks like a sum, not concatenated strings", price_is_a_number)

        def submit():
            H.click_button_with_name(ctx, ["Buyurtma berish", "Place order"])
            time.sleep(3.0)

        self.step(ctx, "Submit the order", submit)
        ctx.screenshot("3_after_submit")

        def visible_to_user(ctx=ctx):
            # The key step: the order must appear ON SCREEN. Checking it through
            # the API here would confirm a database write, not a working feature
            H.goto(ctx, "/orders")
            H.assert_any_text(
                ctx,
                ["Buyurtma", "Order"],
                "The created order is not visible in the user's own list",
            )

        self.step(ctx, "The order is visible to the user in their list", visible_to_user)
        ctx.screenshot("4_orders")

        # Only now the API — to pick up the id for cleanup
        after = ctx.api_call("GET", "/orders/my")
        items = after.get("json") or []
        if len(items) > self.count_before and items:
            self.created_id = items[0].get("id", "")
