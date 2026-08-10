"""Base classes for honest browser tests.

Rule of this framework: every assertion that a feature WORKS must come from what the
user sees on screen (DOM, visible text, visible state). API calls are only for SETUP
(creating fixtures) and CLEANUP (deleting them) — NEVER for proving a feature works.
"""
from __future__ import annotations

import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, List, Optional

from playwright.sync_api import Page, BrowserContext, TimeoutError as PWTimeout


@dataclass
class StepResult:
    description: str
    ok: bool
    note: str = ""
    screenshot: str = ""


@dataclass
class ScenarioResult:
    name: str
    feature: str
    role: str = "admin"
    steps: List[StepResult] = field(default_factory=list)
    setup_errors: List[str] = field(default_factory=list)
    cleanup_errors: List[str] = field(default_factory=list)
    duration_s: float = 0.0
    video_path: Optional[str] = None
    trace_path: Optional[str] = None

    @property
    def ok(self) -> bool:
        return not self.setup_errors and all(s.ok for s in self.steps)

    @property
    def failed_steps(self) -> List[StepResult]:
        return [s for s in self.steps if not s.ok]


class Scenario:
    """Subclass and implement `run(ctx)`. Use `self.step("name", lambda: ...)` to record."""

    name: str = "unnamed"
    feature: str = ""
    required_role: str = "admin"

    def __init__(self):
        self.result = ScenarioResult(name=self.name, feature=self.feature, role=self.required_role)

    def step(self, ctx, description: str, fn: Callable[[], None], take_screenshot_on_fail: bool = True):
        """Run a step. fn() should raise on failure (assert ... or check via DOM).

        Шаг не прерывает сценарий: упавшая проверка записывается со скриншотом,
        и прогон идёт дальше. Одна сломанная кнопка не должна прятать состояние
        остальных десяти — иначе каждый прогон чинит по одному дефекту за раз.
        """
        try:
            fn()
            self.result.steps.append(StepResult(description=description, ok=True))
            return True
        except AssertionError as e:
            note = f"AssertionError: {e}"
            shot = ctx.screenshot(f"FAIL_{self.name}_{len(self.result.steps)}") if take_screenshot_on_fail else ""
            self.result.steps.append(StepResult(description=description, ok=False, note=note, screenshot=shot))
            return False
        except PWTimeout as e:
            note = f"Timeout: {e}"
            shot = ctx.screenshot(f"FAIL_{self.name}_{len(self.result.steps)}") if take_screenshot_on_fail else ""
            self.result.steps.append(StepResult(description=description, ok=False, note=note, screenshot=shot))
            return False
        except Exception as e:
            note = f"{type(e).__name__}: {e}"
            shot = ctx.screenshot(f"FAIL_{self.name}_{len(self.result.steps)}") if take_screenshot_on_fail else ""
            self.result.steps.append(StepResult(description=description, ok=False, note=note, screenshot=shot))
            return False

    def setup(self, ctx):
        """Create any fixtures. Override if needed."""
        pass

    def run(self, ctx):
        raise NotImplementedError

    def cleanup(self, ctx):
        """Delete fixtures. Override if needed. MUST be idempotent."""
        pass

    def execute(self, ctx):
        start = time.time()
        try:
            self.setup(ctx)
        except Exception as e:
            self.result.setup_errors.append(f"{type(e).__name__}: {e}\n{traceback.format_exc()[-400:]}")
            self.result.duration_s = round(time.time() - start, 2)
            return self.result

        try:
            self.run(ctx)
        except Exception as e:
            self.result.steps.append(StepResult(
                description="run() top-level",
                ok=False,
                note=f"{type(e).__name__}: {e}\n{traceback.format_exc()[-400:]}",
                screenshot=ctx.screenshot(f"FAIL_{self.name}_top"),
            ))

        # Cleanup выполняется всегда — даже если run() упал в середине.
        # Фикстуры, оставленные после падения, ломают следующий прогон,
        # и дефект начинает выглядеть плавающим
        try:
            self.cleanup(ctx)
        except Exception as e:
            self.result.cleanup_errors.append(f"{type(e).__name__}: {e}")

        self.result.duration_s = round(time.time() - start, 2)
        return self.result
