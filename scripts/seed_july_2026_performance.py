#!/usr/bin/env python3
"""One-time, resumable July 2026 performance seed for Supabase.

Uses the existing publishable/anon client configuration and the database RPCs so
appointments follow the lifecycle and checkout remains atomic. The marker in
appointment.note and deterministic idempotency keys make interrupted runs safe
to resume.
"""

from __future__ import annotations

import json
import random
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MARKER = "DEMO_JULY_2026_"
TARGET_REVENUE = 100_000
RNG_SEED = 20260731
TAIPEI = timezone(timedelta(hours=8))


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


class SupabaseRest:
    def __init__(self, url: str, key: str) -> None:
        self.base = url.rstrip("/")
        try:
            import certifi
            self.ssl_context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            self.ssl_context = ssl.create_default_context()
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }

    def request(self, method: str, path: str, payload=None, prefer=None):
        headers = dict(self.headers)
        if prefer:
            headers["Prefer"] = prefer
        data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode()
        request = urllib.request.Request(f"{self.base}{path}", data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=30, context=self.ssl_context) as response:
                body = response.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as error:
            body = error.read().decode(errors="replace")
            raise RuntimeError(f"Supabase HTTP {error.code}: {body}") from error

    def select(self, table: str, **params):
        query = urllib.parse.urlencode(params, safe="(),.*")
        return self.request("GET", f"/rest/v1/{table}?{query}")

    def rpc(self, function: str, payload: dict):
        return self.request("POST", f"/rest/v1/rpc/{function}", payload)


def distribute_totals(count: int, rng: random.Random) -> list[int]:
    totals = [rng.randint(400, 500) for _ in range(count)]
    delta = TARGET_REVENUE - sum(totals)
    while delta:
        progressed = False
        for index, current in enumerate(totals):
            room = (500 - current) if delta > 0 else (current - 400)
            if not room:
                continue
            change = min(abs(delta), room)
            totals[index] += change if delta > 0 else -change
            delta += -change if delta > 0 else change
            progressed = True
            if not delta:
                break
        if not progressed:
            raise RuntimeError("Target revenue cannot fit within NT$400–500 per order")
    return totals


def build_plan(customers, services, products):
    rng = random.Random(RNG_SEED)
    daily_counts = [rng.randint(7, 8) for _ in range(31)]
    order_totals = iter(distribute_totals(sum(daily_counts), rng))
    plan = []
    sequence = 0

    for day, daily_count in enumerate(daily_counts, start=1):
        cursor = datetime(2026, 7, day, 9, 0, tzinfo=TAIPEI)
        day_end = datetime(2026, 7, day, 22, 30, tzinfo=TAIPEI)
        minimum_duration = min(service["duration_min"] for service in services)
        for slot in range(1, daily_count + 1):
            sequence += 1
            remaining_slots = daily_count - slot
            candidates = [
                service for service in services
                if cursor + timedelta(
                    minutes=service["duration_min"]
                    + remaining_slots * (minimum_duration + 15)
                ) <= day_end
            ]
            if not candidates:
                raise RuntimeError(f"No service fits the remaining schedule on 2026-07-{day:02d}")
            service = rng.choice(candidates)
            customer = rng.choice(customers)
            product_items = []
            # Roughly one in eight orders includes one retail product.
            if sequence % 8 == 0 and products:
                product = products[(sequence // 8 - 1) % len(products)]
                product_items = [{"product_id": product["id"], "quantity": 1}]

            target_total = next(order_totals)
            gross = service["price"] + sum(
                next(p["price"] for p in products if p["id"] == item["product_id"]) * item["quantity"]
                for item in product_items
            )
            marker = f"{MARKER}{day:02d}_{slot:02d}"
            plan.append({
                "marker": marker,
                "idempotency_key": marker.lower(),
                "customer_id": customer["id"],
                "service_id": service["id"],
                "start_time": cursor.isoformat(),
                "target_total": target_total,
                "discount": gross - target_total,
                "product_items": product_items,
                "payment_method": rng.choice(["cash", "card", "line_pay"]),
            })
            cursor += timedelta(minutes=service["duration_min"] + 15)
    return plan


def chunks(items: list[int], size: int = 80):
    for offset in range(0, len(items), size):
        yield items[offset : offset + size]


def main() -> int:
    env = read_env(ROOT / "frontend" / ".env.local")
    url = env.get("VITE_SUPABASE_URL")
    key = env.get("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY")
    db = SupabaseRest(url, key)

    customers = db.select("customers", select="id,name", order="id.asc")
    services = db.select("services", select="id,name,duration_min,price", active="eq.true", order="id.asc")
    products = db.select("products", select="id,name,price,stock", active="eq.true", order="id.asc")
    if not customers or not services:
        raise RuntimeError("Seed customers and services before generating performance data")

    plan = build_plan(customers, services, products)
    required_stock: dict[int, int] = {}
    for entry in plan:
        for item in entry["product_items"]:
            required_stock[item["product_id"]] = required_stock.get(item["product_id"], 0) + item["quantity"]
    available_stock = {product["id"]: product["stock"] for product in products}
    for product_id, quantity in required_stock.items():
        if available_stock.get(product_id, 0) < quantity:
            raise RuntimeError(f"Product {product_id} requires {quantity} units but has insufficient stock")

    existing_rows = db.select(
        "appointments",
        select="id,status,note",
        note=f"like.{MARKER}*",
        order="id.asc",
    )
    existing = {row["note"]: row for row in existing_rows}

    for index, entry in enumerate(plan, start=1):
        appointment = existing.get(entry["marker"])
        if appointment is None:
            appointment = db.rpc("create_appointment", {
                "p_customer_id": entry["customer_id"],
                "p_service_id": entry["service_id"],
                "p_start_time": entry["start_time"],
                "p_status": "pending",
                "p_custom_items": [],
                "p_note": entry["marker"],
            })

        def update_status(status: str):
            return db.rpc("update_appointment", {
                "p_id": appointment["id"],
                "p_customer_id": entry["customer_id"],
                "p_service_id": entry["service_id"],
                "p_start_time": entry["start_time"],
                "p_status": status,
                "p_custom_items": [],
                "p_note": entry["marker"],
            })

        status = appointment["status"]
        if status == "pending":
            appointment = update_status("confirmed")
            status = "confirmed"
        if status == "confirmed":
            appointment = update_status("in_service")
            status = "in_service"
        if status == "in_service":
            db.rpc("checkout_appointment", {
                "p_appointment_id": appointment["id"],
                "p_idempotency_key": entry["idempotency_key"],
                "p_product_items": entry["product_items"],
                "p_custom_items": [],
                "p_payment_method": entry["payment_method"],
                "p_discount": entry["discount"],
            })
        elif status != "completed":
            raise RuntimeError(f"Unexpected status {status!r} for {entry['marker']}")

        if index % 25 == 0 or index == len(plan):
            print(f"Progress: {index}/{len(plan)} appointments")

    appointments = db.select(
        "appointments",
        select="id,status,total_amount,note",
        note=f"like.{MARKER}*",
        order="id.asc",
    )
    appointment_ids = [row["id"] for row in appointments]
    orders = []
    for group in chunks(appointment_ids):
        orders.extend(db.select(
            "orders",
            select="id,appointment_id,total_amount",
            appointment_id=f"in.({','.join(map(str, group))})",
        ))
    order_ids = [row["id"] for row in orders]
    order_items = []
    for group in chunks(order_ids):
        order_items.extend(db.select(
            "order_items",
            select="id,order_id,item_type",
            order_id=f"in.({','.join(map(str, group))})",
        ))

    completed = sum(row["status"] == "completed" for row in appointments)
    revenue = sum(row["total_amount"] for row in orders)
    print("\nJuly 2026 seed result")
    print(f"Completed appointments: {completed}")
    print(f"Orders: {len(orders)}")
    print(f"Order items: {len(order_items)}")
    print(f"Total revenue: NT$ {revenue:,}")

    if completed != len(plan) or len(orders) != len(plan) or revenue != TARGET_REVENUE:
        raise RuntimeError("Final verification failed")
    print("Supabase verification: passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
