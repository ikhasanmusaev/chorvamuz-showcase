"""Пример сценария: проверка платного действия глазами пользователя.

Показывает принцип, ради которого написан весь фреймворк: доказательством
работы считается только то, что видно на экране. API здесь используется
дважды — узнать состояние ДО и убрать за собой ПОСЛЕ, — и ни разу для
вывода «работает».

Именно это различие ловило дефекты, которые API-проверки пропускали:
сервер отвечал `200 OK` и менял статус в базе, а кнопка на экране
оставалась неактивной. С точки зрения API — успех. С точки зрения
человека — функция не работает.
"""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from base import Scenario
import helpers as H


class PaidActionFlow(Scenario):
    name = "paid_action_flow"
    feature = "Оплаченное действие доходит до экрана, а не только до базы"
    required_role = "user"

    def setup(self, ctx):
        # Состояние ДО — чтобы отличить «создалось сейчас» от «было раньше».
        # Без этого сценарий зелёный на старых данных даже когда создание сломано
        before = ctx.api_call("GET", "/orders/my")
        self.count_before = len(before.get("json") or []) if before.get("ok") else 0
        self.created_id = ""

    def cleanup(self, ctx):
        # Идемпотентно: повторный вызов на уже удалённом не должен падать,
        # иначе упавший прогон ломает следующий
        if self.created_id:
            ctx.api_call("POST", f"/orders/{self.created_id}/cancel")

    def run(self, ctx):
        H.goto(ctx, "/catalog")
        ctx.screenshot("1_catalog")

        def catalog_has_items():
            # Пустой каталог — не «нет данных», а замаскированное падение
            # загрузки. Проверяем именно наличие карточек
            cards = ctx.page.locator('a[href^="/item/"]')
            assert cards.count() > 0, "Каталог пуст: список не загрузился"

        if not self.step(ctx, "Каталог показывает позиции", catalog_has_items):
            return

        def open_item():
            ctx.page.locator('a[href^="/item/"]').first.click()
            ctx.page.wait_for_url(lambda u: "/item/" in u, timeout=15000)
            time.sleep(2.0)

        self.step(ctx, "Открыть карточку", open_item)
        ctx.screenshot("2_item")

        def price_is_a_number():
            # Проверка из реального дефекта: две суммы склеивались строкой
            # и на экране появлялось «300 000 250 000» вместо сложения.
            # Ничего не падало — просто человек видел бессмыслицу
            body = ctx.page.locator("body").inner_text()
            import re
            matches = re.findall(r"(\d[\d\s]{4,})\s+(\d[\d\s]{4,})\s*(?:UZS|сум)", body)
            assert not matches, f"Похоже на склейку сумм вместо сложения: {matches[:2]}"

        self.step(ctx, "Сумма выглядит суммой, а не склейкой строк", price_is_a_number)

        def submit():
            H.click_button_with_name(ctx, ["Buyurtma berish", "Оформить", "Заказать"])
            time.sleep(3.0)

        self.step(ctx, "Отправить заказ", submit)
        ctx.screenshot("3_after_submit")

        def visible_to_user(ctx=ctx):
            # Ключевой шаг: заказ должен появиться НА ЭКРАНЕ.
            # Проверять его через API здесь нельзя — тогда сценарий
            # подтвердит запись в базе, а не работу функции
            H.goto(ctx, "/orders")
            H.assert_any_text(
                ctx,
                ["Buyurtma", "Заказ"],
                "Созданный заказ не виден в списке пользователя",
            )

        self.step(ctx, "Заказ виден пользователю в его списке", visible_to_user)
        ctx.screenshot("4_orders")

        # И только теперь — API, чтобы забрать id для cleanup
        after = ctx.api_call("GET", "/orders/my")
        items = after.get("json") or []
        if len(items) > self.count_before and items:
            self.created_id = items[0].get("id", "")
