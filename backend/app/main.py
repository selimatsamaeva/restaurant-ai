from fastapi import FastAPI
from datetime import datetime, timedelta

from backend.app.database import Base, engine, SessionLocal
from backend.app import models
from backend.app.ml_model import train_model, predict_time

from fastapi.staticfiles import StaticFiles


app = FastAPI()

app.mount(
    "/dashboard",
    StaticFiles(
        directory="frontend",
        html=True
    ),
    name="dashboard"
)

Base.metadata.create_all(bind=engine)


menu = [
    {
        "id": 1,
        "name": "Капучино",
        "price": 250,
        "category": "Напитки",
        "station": "Бар",
        "prep_time": 5
    },
    {
        "id": 2,
        "name": "Латте",
        "price": 280,
        "category": "Напитки",
        "station": "Бар",
        "prep_time": 5
    },
    {
        "id": 3,
        "name": "Паста",
        "price": 450,
        "category": "Основные блюда",
        "station": "Кухня",
        "prep_time": 15
    },
    {
        "id": 4,
        "name": "Чизкейк",
        "price": 300,
        "category": "Десерты",
        "station": "Кухня",
        "prep_time": 3
    }
]
db = SessionLocal()

if db.query(models.MenuItem).count() == 0:
    for item in menu:
        db.add(
            models.MenuItem(
                id=item["id"],
                name=item["name"],
                price=item["price"],
                category=item["category"],
                station=item["station"],
                prep_time=item["prep_time"]
            )
        )

    db.commit()

db.close()

@app.get("/")
def root():
    return {"message": "Restaurant Order System API"}


@app.get("/menu")
def get_menu():
    return menu





@app.post("/orders")
def create_order(order: dict):
    db = SessionLocal()

    new_order = models.Order(
        table_number=order["table_number"],
        created_at=datetime.now().isoformat(),
        status="Новый"
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    for item in order["items"]:
        menu_item = db.query(models.MenuItem).filter(
            models.MenuItem.id == item["menu_item_id"]
        ).first()

        if menu_item is None:
            continue

        order_item = models.OrderItem(
            order_id=new_order.id,
            menu_item_id=menu_item.id,
            quantity=item["quantity"]
        )

        db.add(order_item)

    db.commit()

    db.refresh(new_order)

    result = {
        "id": new_order.id,
        "table_number": new_order.table_number,
        "created_at": new_order.created_at,
        "status": new_order.status,
        "items": []
    }

    for item in new_order.items:
        result["items"].append({
            "menu_item_id": item.menu_item_id,
            "name": item.menu_item.name,
            "quantity": item.quantity,
            "station": item.menu_item.station,
            "prep_time": item.menu_item.prep_time
        })

    db.close()

    return {
        "message": "Заказ создан",
        "order": result
    }


@app.get("/orders")
def get_orders():
    db = SessionLocal()

    orders_db = db.query(models.Order).all()

    result = []

    for order in orders_db:
        items = []

        for item in order.items:
            items.append({
                "menu_item_id": item.menu_item_id,
                "name": item.menu_item.name,
                "quantity": item.quantity,
                "station": item.menu_item.station,
                "prep_time": item.menu_item.prep_time
            })

        result.append({
            "id": order.id,
            "table_number": order.table_number,
            "created_at": order.created_at,
            "finished_at": order.finished_at,
            "status": order.status,
            "items": items
        })

    db.close()

    return result

@app.get("/analytics")


def get_analytics():
    db = SessionLocal()

    orders_db = db.query(models.Order).all()

    total_orders = len(orders_db)

    new_orders = 0
    accepted_orders = 0
    preparing_orders = 0
    ready_orders = 0
    served_orders = 0

    for order in orders_db:
        if order.status == "Новый":
            new_orders += 1

        elif order.status == "Принят":
            accepted_orders += 1

        elif order.status == "Готовится":
            preparing_orders += 1

        elif order.status == "Готов":
            ready_orders += 1

        elif order.status == "Выдан":
            served_orders += 1

    db.close()

    return {
        "total_orders": total_orders,
        "statuses": {
            "new": new_orders,
            "accepted": accepted_orders,
            "preparing": preparing_orders,
            "ready": ready_orders,
            "served": served_orders
        }
    }

@app.get("/analytics/popular-items")
def get_popular_items():
    db = SessionLocal()

    order_items = db.query(models.OrderItem).all()

    item_stats = {}

    for order_item in order_items:
        name = order_item.menu_item.name

        if name not in item_stats:
            item_stats[name] = 0

        item_stats[name] += order_item.quantity

    db.close()

    result = []

    for name, quantity in item_stats.items():
        result.append({
            "name": name,
            "quantity": quantity
        })

    result.sort(
        key=lambda item: item["quantity"],
        reverse=True
    )

    return result

@app.get("/analytics/revenue")
def get_revenue():
    db = SessionLocal()

    order_items = db.query(models.OrderItem).all()

    total_revenue = 0

    for order_item in order_items:
        price = order_item.menu_item.price
        quantity = order_item.quantity

        total_revenue += price * quantity

    db.close()

    return {
        "total_revenue": round(total_revenue, 2)
    }

@app.get("/analytics/average-preparation-time")
def get_average_preparation_time():
    db = SessionLocal()

    finished_orders = db.query(models.Order).filter(
        models.Order.finished_at.isnot(None)
    ).all()

    if not finished_orders:
        db.close()

        return {
            "completed_orders": 0,
            "average_preparation_minutes": 0
        }

    total_time = 0

    for order in finished_orders:
        created = datetime.fromisoformat(order.created_at)
        finished = datetime.fromisoformat(order.finished_at)

        preparation_minutes = (
            finished - created
        ).total_seconds() / 60

        total_time += preparation_minutes

    average_time = total_time / len(finished_orders)

    db.close()

    return {
        "completed_orders": len(finished_orders),
        "average_preparation_minutes": round(average_time, 2)
    }

@app.get("/workload")
def get_workload():
    db = SessionLocal()

    orders_db = db.query(models.Order).filter(
        models.Order.status.in_(["Новый", "Принят", "Готовится"])
    ).all()

    bar_orders = 0
    kitchen_orders = 0

    bar_time = 0
    kitchen_time = 0

    for order in orders_db:
        for item in order.items:
            total_time = item.menu_item.prep_time * item.quantity

            if item.menu_item.station == "Бар":
                bar_orders += 1
                bar_time += total_time

            elif item.menu_item.station == "Кухня":
                kitchen_orders += 1
                kitchen_time += total_time

    db.close()

    bar_load = min(round(bar_time / 60 * 100), 100)
    kitchen_load = min(round(kitchen_time / 60 * 100), 100)

    return {
        "bar": {
            "active_items": bar_orders,
            "estimated_minutes": bar_time,
            "load_percent": bar_load,
            "status": get_load_status(bar_load)
        },
        "kitchen": {
            "active_items": kitchen_orders,
            "estimated_minutes": kitchen_time,
            "load_percent": kitchen_load,
            "status": get_load_status(kitchen_load)
        }
    }

def get_load_status(load_percent):
    if load_percent < 40:
        return "Низкая"
    elif load_percent < 75:
        return "Средняя"
    else:
        return "Высокая"

@app.get("/orders/{order_id}/estimate")
def estimate_order_time(order_id: int):
    db = SessionLocal()

    selected_order = db.query(models.Order).filter(
        models.Order.id == order_id
    ).first()

    if selected_order is None:
        db.close()
        return {
            "message": "Заказ не найден"
        }

    active_orders = db.query(models.Order).filter(
        models.Order.status.in_(["Новый", "Принят", "Готовится"])
    ).all()

    kitchen_time = 0
    bar_time = 0

    for order in active_orders:
        for item in order.items:
            total_time = item.menu_item.prep_time * item.quantity

            if item.menu_item.station == "Кухня":
                kitchen_time += total_time

            elif item.menu_item.station == "Бар":
                bar_time += total_time

    order_kitchen_time = 0
    order_bar_time = 0

    for item in selected_order.items:
        total_time = item.menu_item.prep_time * item.quantity

        if item.menu_item.station == "Кухня":
            order_kitchen_time += total_time

        elif item.menu_item.station == "Бар":
            order_bar_time += total_time

    estimated_time = max(
        kitchen_time + order_kitchen_time,
        bar_time + order_bar_time
    )

    if estimated_time <= 10:
        load_message = "Нагрузка низкая"
    elif estimated_time <= 25:
        load_message = "Нагрузка средняя"
    else:
        load_message = "Высокая нагрузка"

    db.close()

    return {
        "order_id": selected_order.id,
        "estimated_minutes": estimated_time,
        "message": load_message
    }

@app.patch("/orders/{order_id}/status")
def update_order_status(order_id: int, status: str):
    db = SessionLocal()

    order = db.query(models.Order).filter(
        models.Order.id == order_id
    ).first()

    if order is None:
        db.close()
        return {
            "message": "Заказ не найден"
        }

    order.status = status
    
    if status in ["Готов", "Выдан"]:
        order.finished_at = datetime.now().isoformat()

    db.commit()
    db.refresh(order)

    result = {
        "id": order.id,
        "table_number": order.table_number,
        "created_at": order.created_at,
        "status": order.status,
        "items": []
    }

    for item in order.items:
        result["items"].append({
            "menu_item_id": item.menu_item_id,
            "name": item.menu_item.name,
            "quantity": item.quantity,
            "station": item.menu_item.station,
            "prep_time": item.menu_item.prep_time
        })

    db.close()

    return {
        "message": "Статус заказа обновлён",
        "order": result
    }

@app.get("/kitchen/orders")
def get_kitchen_orders():
    db = SessionLocal()

    orders_db = db.query(models.Order).filter(
        models.Order.status.in_(["Новый", "Принят", "Готовится"])
    ).all()

    kitchen_orders = []

    for order in orders_db:
        kitchen_items = []

        for item in order.items:
            if item.menu_item.station == "Кухня":
                kitchen_items.append({
                    "menu_item_id": item.menu_item_id,
                    "name": item.menu_item.name,
                    "quantity": item.quantity,
                    "station": item.menu_item.station,
                    "prep_time": item.menu_item.prep_time
                })

        if kitchen_items:
            order_data = {
                "id": order.id,
                "order_id": order.id,
                "table_number": order.table_number,
                "created_at": order.created_at,
                "status": order.status,
                "items": kitchen_items
            }

            order_data["priority"] = calculate_priority(order_data)
            order_data["priority_reason"] = get_priority_reason(order_data)

            kitchen_orders.append(order_data)

    kitchen_orders.sort(
        key=lambda order: order["priority"],
        reverse=True
    )

    db.close()

    return kitchen_orders

@app.get("/bar/orders")
def get_bar_orders():
    db = SessionLocal()

    orders_db = db.query(models.Order).filter(
        models.Order.status.in_(["Новый", "Принят", "Готовится"])
    ).all()

    bar_orders = []

    for order in orders_db:
        bar_items = []

        for item in order.items:
            if item.menu_item.station == "Бар":
                bar_items.append({
                    "menu_item_id": item.menu_item_id,
                    "name": item.menu_item.name,
                    "quantity": item.quantity,
                    "station": item.menu_item.station,
                    "prep_time": item.menu_item.prep_time
                })

        if bar_items:
            order_data = {
                "id": order.id,
                "order_id": order.id,
                "table_number": order.table_number,
                "created_at": order.created_at,
                "status": order.status,
                "items": bar_items
            }

            order_data["priority"] = calculate_priority(order_data)
            order_data["priority_reason"] = get_priority_reason(order_data)

            bar_orders.append(order_data)

    bar_orders.sort(
        key=lambda order: order["priority"],
        reverse=True
    )

    db.close()

    return bar_orders

def calculate_priority(order):
    waiting_minutes = (
        datetime.now() - datetime.fromisoformat(order["created_at"])
    ).total_seconds() / 60

    items_count = 0
    preparation_time = 0

    for item in order["items"]:
        items_count += item["quantity"]
        preparation_time += item["prep_time"] * item["quantity"]

    priority = (
        waiting_minutes * 2
        + items_count * 3
        + preparation_time
    )

    return round(priority, 2)


def get_priority_reason(order):
    waiting_minutes = (
        datetime.now() - datetime.fromisoformat(order["created_at"])
    ).total_seconds() / 60

    items_count = 0
    preparation_time = 0

    for item in order["items"]:
        items_count += item["quantity"]
        preparation_time += item["prep_time"] * item["quantity"]

    reasons = []

    if waiting_minutes >= 5:
        reasons.append("долгое ожидание")

    if items_count >= 3:
        reasons.append("много позиций")

    if preparation_time >= 15:
        reasons.append("долгое приготовление")

    if not reasons:
        reasons.append("обычный приоритет")

    return ", ".join(reasons)

@app.get("/analytics/training-data")
def get_training_data():
    db = SessionLocal()

    finished_orders = db.query(models.Order).filter(
        models.Order.finished_at.isnot(None)
    ).all()

    result = []

    for order in finished_orders:
        created = datetime.fromisoformat(order.created_at)
        finished = datetime.fromisoformat(order.finished_at)

        actual_time = (
            finished - created
        ).total_seconds() / 60

        items_count = 0
        kitchen_items = 0
        bar_items = 0
        planned_time = 0

        for item in order.items:
            items_count += item.quantity

            total_item_time = (
                item.menu_item.prep_time * item.quantity
            )

            planned_time += total_item_time

            if item.menu_item.station == "Кухня":
                kitchen_items += item.quantity

            elif item.menu_item.station == "Бар":
                bar_items += item.quantity

        result.append({
            "order_id": order.id,
            "items_count": items_count,
            "kitchen_items": kitchen_items,
            "bar_items": bar_items,
            "planned_time": planned_time,
            "actual_time": round(actual_time, 2)
        })

    db.close()

    return result

@app.post("/analytics/generate-test-data")
def generate_test_data():
    db = SessionLocal()

    menu_items = db.query(models.MenuItem).all()

    if not menu_items:
        db.close()

        return {
            "message": "Меню пустое"
        }

    # Удаляем только старые тестовые заказы.
    # Реальные заказы пользователя НЕ удаляются.
    old_test_orders = db.query(models.Order).filter(
        models.Order.is_test == True
    ).all()

    for order in old_test_orders:
        db.delete(order)

    db.commit()

    created_orders = []

    # ==========================================================
    # 1. ЗАВЕРШЁННЫЕ ТЕСТОВЫЕ ЗАКАЗЫ ДЛЯ ML И АНАЛИТИКИ
    # ==========================================================

    for i in range(24):

        menu_item_1 = menu_items[i % len(menu_items)]
        menu_item_2 = menu_items[(i + 1) % len(menu_items)]

        quantity_1 = (i % 3) + 1
        quantity_2 = (i % 2) + 1

        planned_time = (
            menu_item_1.prep_time * quantity_1
            + menu_item_2.prep_time * quantity_2
        )

        delay = (i % 7) - 2

        actual_minutes = max(
            planned_time + delay,
            3
        )

        finished_at = datetime.now()

        created_at = (
            finished_at
            - timedelta(minutes=actual_minutes)
        )

        order = models.Order(
            table_number=(i % 10) + 1,
            created_at=created_at.isoformat(),
            status="Выдан",
            finished_at=finished_at.isoformat(),
            is_test=True
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        order_item_1 = models.OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_1.id,
            quantity=quantity_1
        )

        order_item_2 = models.OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_2.id,
            quantity=quantity_2
        )

        db.add(order_item_1)
        db.add(order_item_2)

        db.commit()

        created_orders.append(order.id)

    # ==========================================================
    # 2. АКТИВНЫЕ ЗАКАЗЫ ДЛЯ БАРА И КУХНИ
    # ==========================================================

    active_statuses = [
        "Новый",
        "Принят",
        "Готовится",
        "Новый",
        "Принят",
        "Готовится"
    ]

    for i in range(6):

        menu_item_1 = menu_items[i % len(menu_items)]
        menu_item_2 = menu_items[(i + 1) % len(menu_items)]

        quantity_1 = (i % 2) + 1
        quantity_2 = 1

        created_at = (
            datetime.now()
            - timedelta(minutes=2 + i * 2)
        )

        order = models.Order(
            table_number=((i + 1) % 10) + 1,
            created_at=created_at.isoformat(),
            status=active_statuses[i],
            finished_at=None,
            is_test=True
        )

        db.add(order)
        db.commit()
        db.refresh(order)

        order_item_1 = models.OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_1.id,
            quantity=quantity_1
        )

        order_item_2 = models.OrderItem(
            order_id=order.id,
            menu_item_id=menu_item_2.id,
            quantity=quantity_2
        )

        db.add(order_item_1)
        db.add(order_item_2)

        db.commit()

        created_orders.append(order.id)

    db.close()

    return {
        "message": "Тестовые данные успешно созданы",
        "completed_orders_for_ml": 24,
        "active_orders_for_bar_and_kitchen": 6,
        "total_test_orders": len(created_orders),
        "order_ids": created_orders
    }


@app.get("/analytics/ml/train")
def train_ml_model():
    db = SessionLocal()

    finished_orders = db.query(models.Order).filter(
        models.Order.finished_at.isnot(None),
        models.Order.is_test == True
        ).all()

    training_data = []

    for order in finished_orders:

        created = datetime.fromisoformat(order.created_at)
        finished = datetime.fromisoformat(order.finished_at)

        actual_time = (
            finished - created
        ).total_seconds() / 60

        items_count = 0
        kitchen_items = 0
        bar_items = 0
        planned_time = 0

        for item in order.items:

            items_count += item.quantity

            total_item_time = (
                item.menu_item.prep_time * item.quantity
            )

            planned_time += total_item_time

            if item.menu_item.station == "Кухня":
                kitchen_items += item.quantity

            elif item.menu_item.station == "Бар":
                bar_items += item.quantity

        training_data.append({
            "items_count": items_count,
            "kitchen_items": kitchen_items,
            "bar_items": bar_items,
            "planned_time": planned_time,
            "actual_time": actual_time
        })

    db.close()

    model = train_model(training_data)

    if model is None:
        return {
            "message": "Недостаточно данных для обучения",
            "training_rows": len(training_data)
        }

    return {
        "message": "ML-модель обучена",
        "training_rows": len(training_data),
        "features": [
            "items_count",
            "kitchen_items",
            "bar_items",
            "planned_time"
        ]
    }

@app.get("/analytics/ml/predict/{order_id}")
def predict_order_time(order_id: int):
    db = SessionLocal()

    selected_order = db.query(models.Order).filter(
        models.Order.id == order_id
    ).first()

    if selected_order is None:
        db.close()

        return {
            "message": "Заказ не найден"
        }

    finished_orders = db.query(models.Order).filter(
        models.Order.finished_at.isnot(None),
        models.Order.is_test == True
        ).all()

    training_data = []

    for order in finished_orders:

        created = datetime.fromisoformat(order.created_at)
        finished = datetime.fromisoformat(order.finished_at)

        actual_time = (
            finished - created
        ).total_seconds() / 60

        items_count = 0
        kitchen_items = 0
        bar_items = 0
        planned_time = 0

        for item in order.items:

            items_count += item.quantity

            total_item_time = (
                item.menu_item.prep_time * item.quantity
            )

            planned_time += total_item_time

            if item.menu_item.station == "Кухня":
                kitchen_items += item.quantity

            elif item.menu_item.station == "Бар":
                bar_items += item.quantity

        training_data.append({
            "items_count": items_count,
            "kitchen_items": kitchen_items,
            "bar_items": bar_items,
            "planned_time": planned_time,
            "actual_time": actual_time
        })

    model = train_model(training_data)

    if model is None:
        db.close()

        return {
            "message": "Недостаточно данных для прогноза"
        }

    items_count = 0
    kitchen_items = 0
    bar_items = 0
    planned_time = 0

    for item in selected_order.items:

        items_count += item.quantity

        total_item_time = (
            item.menu_item.prep_time * item.quantity
        )

        planned_time += total_item_time

        if item.menu_item.station == "Кухня":
            kitchen_items += item.quantity

        elif item.menu_item.station == "Бар":
            bar_items += item.quantity

    prediction = predict_time(
        model,
        items_count,
        kitchen_items,
        bar_items,
        planned_time
    )
    
    # Защита от нереалистичного прогноза.
    # ML не должен выдавать тысячи минут
    # для обычного ресторанного заказа.
    max_prediction = max(
    planned_time + 30,
    planned_time * 2
    )
    prediction = max(
        1,
        min(
            prediction,
            max_prediction
        )
    )
    prediction = round(
        prediction,
        2
        )
    db.close()

    return {
        "order_id": order_id,
        "items_count": items_count,
        "kitchen_items": kitchen_items,
        "bar_items": bar_items,
        "planned_time": planned_time,
        "predicted_minutes": prediction
        }

# ==========================================================
# ИИ-ПОМОЩНИК / ИНТЕЛЛЕКТУАЛЬНЫЕ РЕКОМЕНДАЦИИ
# ==========================================================

@app.get("/ai/recommendations")
def get_ai_recommendations():
    db = SessionLocal()

    # Получаем активные заказы
    active_statuses = [
        "Новый",
        "Принят",
        "Готовится"
    ]

    orders_db = db.query(models.Order).filter(
        models.Order.status.in_(active_statuses)
    ).all()

    recommendations = []

    kitchen_orders = []
    bar_orders = []

    # ------------------------------------------------------
    # Анализируем активные заказы
    # ------------------------------------------------------

    for order in orders_db:

        order_items = []

        kitchen_items_count = 0
        bar_items_count = 0
        planned_time = 0
        items_count = 0

        for item in order.items:

            quantity = item.quantity

            items_count += quantity
            planned_time += item.menu_item.prep_time * quantity

            order_items.append({
                "menu_item_id": item.menu_item_id,
                "name": item.menu_item.name,
                "quantity": quantity,
                "station": item.menu_item.station,
                "prep_time": item.menu_item.prep_time
            })

            if item.menu_item.station == "Кухня":
                kitchen_items_count += quantity

            if item.menu_item.station == "Бар":
                bar_items_count += quantity

        if not order_items:
            continue

        order_data = {
            "id": order.id,
            "created_at": order.created_at,
            "items": order_items,
            "items_count": items_count,
            "planned_time": planned_time,
            "kitchen_items": kitchen_items_count,
            "bar_items": bar_items_count
        }

        # Рассчитываем приоритет
        priority = calculate_priority(order_data)

        order_data["priority"] = priority

        # Определяем станцию
        if kitchen_items_count > 0:
            kitchen_orders.append(order_data)

        if bar_items_count > 0:
            bar_orders.append(order_data)

    # ------------------------------------------------------
    # Загружаем ML-модель
    # ------------------------------------------------------

    training_data = []

    completed_orders = db.query(models.Order).filter(
        models.Order.finished_at.isnot(None),
        models.Order.is_test == True
    ).all()

    for order in completed_orders:

        items_count = 0
        kitchen_items = 0
        bar_items = 0
        planned_time = 0

        for item in order.items:

            quantity = item.quantity

            items_count += quantity
            planned_time += item.menu_item.prep_time * quantity

            if item.menu_item.station == "Кухня":
                kitchen_items += quantity

            if item.menu_item.station == "Бар":
                bar_items += quantity

        if order.finished_at and order.created_at:

            created = datetime.fromisoformat(order.created_at)
            finished = datetime.fromisoformat(order.finished_at)

            actual_time = (
                finished - created
            ).total_seconds() / 60

            if 1 <= actual_time <= 120:
                training_data.append({
                "items_count": items_count,
                "kitchen_items": kitchen_items,
                "bar_items": bar_items,
                "planned_time": planned_time,
                "actual_time": actual_time
                })

    model = train_model(training_data)

    # ------------------------------------------------------
    # Анализ кухни
    # ------------------------------------------------------

    if kitchen_orders:

        kitchen_orders.sort(
            key=lambda order: order["priority"],
            reverse=True
        )

        highest_priority = kitchen_orders[0]

        recommendations.append({
            "type": "kitchen",
            "title": "Кухня",
            "message": (
                f"На кухне находится "
                f"{len(kitchen_orders)} активных заказов. "
                f"Заказ №{highest_priority['id']} "
                f"имеет самый высокий приоритет."
            ),
            "priority": "high"
        })

    else:

        recommendations.append({
            "type": "kitchen",
            "title": "Кухня",
            "message": "Активных заказов на кухне нет.",
            "priority": "normal"
        })

    # ------------------------------------------------------
    # Анализ бара
    # ------------------------------------------------------

    if bar_orders:

        bar_orders.sort(
            key=lambda order: order["priority"],
            reverse=True
        )

        highest_priority = bar_orders[0]

        recommendations.append({
            "type": "bar",
            "title": "Бар",
            "message": (
                f"На баре находится "
                f"{len(bar_orders)} активных заказов. "
                f"Заказ №{highest_priority['id']} "
                f"имеет самый высокий приоритет."
            ),
            "priority": "high"
        })

    else:

        recommendations.append({
            "type": "bar",
            "title": "Бар",
            "message": "Активных заказов на баре нет.",
            "priority": "normal"
        })

    # ------------------------------------------------------
    # Анализ ожидания
    # ------------------------------------------------------

    for order in orders_db:

        waiting_minutes = (
            datetime.now()
            - datetime.fromisoformat(order.created_at)
        ).total_seconds() / 60

        if waiting_minutes >= 10:

            recommendations.append({
                "type": "delay",
                "title": "Долгое ожидание",
                "message": (
                    f"Заказ №{order.id} ожидает "
                    f"{round(waiting_minutes)} минут. "
                    f"Рекомендуется обработать его в первую очередь."
                ),
                "priority": "high"
            })

    # ------------------------------------------------------
    # ML-прогноз
    # ------------------------------------------------------

    if model:

        for order in orders_db:

            items_count = 0
            kitchen_items = 0
            bar_items = 0
            planned_time = 0

            for item in order.items:

                quantity = item.quantity

                items_count += quantity
                planned_time += (
                    item.menu_item.prep_time
                    * quantity
                )

                if item.menu_item.station == "Кухня":
                    kitchen_items += quantity

                if item.menu_item.station == "Бар":
                    bar_items += quantity

            prediction = predict_time(
                model,
                items_count,
                kitchen_items,
                bar_items,
                planned_time
            )
            prediction = max(
                1,
                min(prediction,120)
            )

            if prediction > planned_time * 1.3:

                recommendations.append({
                    "type": "prediction",
                    "title": "ML-прогноз",
                    "message": (
                        f"Для заказа №{order.id} "
                        f"модель прогнозирует около "
                        f"{round(prediction)} минут приготовления "
                        f"при плановом времени "
                        f"{round(planned_time)} минут."
                    ),
                    "priority": "medium"
                })

    # ------------------------------------------------------
    # Общая рекомендация
    # ------------------------------------------------------

    if not orders_db:

        recommendations.append({
            "type": "general",
            "title": "Система",
            "message": (
                "Все текущие заказы обработаны. "
                "Кухня и бар свободны."
            ),
            "priority": "normal"
        })

    else:

        recommendations.append({
            "type": "general",
            "title": "Рекомендация системы",
            "message": (
                "Следует контролировать заказы "
                "с высоким приоритетом и большим временем ожидания."
            ),
            "priority": "medium"
        })

    db.close()

    return {
        "assistant": "AI-помощник ресторана",
        "active_orders": len(orders_db),
        "kitchen_orders": len(kitchen_orders),
        "bar_orders": len(bar_orders),
        "recommendations": recommendations
    }

# ==========================================================
# ОЧИСТКА СТАРЫХ АКТИВНЫХ ЗАКАЗОВ
# ==========================================================

@app.post("/analytics/cleanup-old-active-orders")
def cleanup_old_active_orders():
    db = SessionLocal()

    active_statuses = [
        "Новый",
        "Принят",
        "Готовится"
    ]

    orders_db = db.query(models.Order).filter(
        models.Order.status.in_(active_statuses)
    ).all()

    updated_orders = []

    for order in orders_db:

        created_at = datetime.fromisoformat(order.created_at)

        waiting_minutes = (
            datetime.now() - created_at
        ).total_seconds() / 60

        # Если заказ старше 60 минут,
        # считаем его старым и завершаем.
        if waiting_minutes > 60:

            order.status = "Выдан"

            if order.finished_at is None:
                order.finished_at = datetime.now().isoformat()

            updated_orders.append({
                "order_id": order.id,
                "old_waiting_minutes": round(waiting_minutes, 2)
            })

    db.commit()
    db.close()

    return {
        "message": "Старые активные заказы обработаны",
        "updated_orders_count": len(updated_orders),
        "updated_orders": updated_orders
    }