const API = "";


/* =========================
   DATE
========================= */

function setDate() {

    const date = new Date();

    document.getElementById(
        "currentDate"
    ).textContent =
        date.toLocaleDateString(
            "ru-RU",
            {
                weekday: "long",
                day: "numeric",
                month: "long"
            }
        );
}


/* =========================
   API
========================= */

async function getData(url) {

    const response =
        await fetch(API + url);

    if (!response.ok) {

        throw new Error(
            `API error: ${response.status}`
        );
    }

    return await response.json();
}


/* =========================
   TOAST
========================= */

function showToast(message) {

    const toast =
        document.getElementById("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(
        () => {
            toast.classList.remove("show");
        },
        2200
    );
}


/* =========================
   NAVIGATION
========================= */

function showPage(
    pageId,
    button
) {

    document
        .querySelectorAll(".page")
        .forEach(
            page =>
                page.classList.remove(
                    "active-page"
                )
        );


    const page =
        document.getElementById(
            pageId
        );


    if (page) {

        page.classList.add(
            "active-page"
        );
    }


    document
        .querySelectorAll(".nav-item")
        .forEach(
            item =>
                item.classList.remove(
                    "active"
                )
        );


    if (button) {

        button.classList.add(
            "active"
        );
    }


    if (pageId === "dashboard") {

        loadDashboard();
    }


    if (pageId === "orders") {

        loadOrders();
    }


    if (pageId === "kitchen") {

        loadKitchen();
    }


    if (pageId === "bar") {

        loadBar();
    }


    if (pageId === "analytics") {

        loadAnalytics();
    }
}


function showPageByName(pageId) {

    const buttons =
        document.querySelectorAll(
            ".nav-item"
        );


    let targetButton = null;


    buttons.forEach(button => {

        const text =
            button.textContent
                .toLowerCase();


        if (
            pageId === "prediction" &&
            text.includes("ml-прогноз")
        ) {

            targetButton = button;
        }


        if (
            pageId === "orders" &&
            text.includes("заказы")
        ) {

            targetButton = button;
        }

    });


    showPage(
        pageId,
        targetButton
    );
}


/* =========================
   STATUS
========================= */

function statusClass(status) {

    if (status === "Новый") {

        return "status-new";
    }


    if (
        status === "Принят" ||
        status === "Готовится"
    ) {

        return "status-preparing";
    }


    if (status === "Готов") {

        return "status-ready";
    }


    if (status === "Выдан") {

        return "status-served";
    }


    return "status-new";
}


/* =========================
   DASHBOARD
========================= */

async function loadDashboard() {

    try {

        const [
            analytics,
            revenue,
            average,
            workload,
            orders
        ] = await Promise.all([

            getData(
                "/analytics"
            ),

            getData(
                "/analytics/revenue"
            ),

            getData(
                "/analytics/average-preparation-time"
            ),

            getData(
                "/workload"
            ),

            getData(
                "/orders"
            )

        ]);


        document.getElementById(
            "totalOrders"
        ).textContent =
            analytics.total_orders;


        document.getElementById(
            "revenue"
        ).textContent =
            Number(
                revenue.total_revenue
            ).toLocaleString(
                "ru-RU"
            );


        document.getElementById(
            "averageTime"
        ).textContent =
            average.average_preparation_minutes;


        const active =
            orders.filter(
                order =>
                    ![
                        "Готов",
                        "Выдан"
                    ].includes(
                        order.status
                    )
            ).length;


        document.getElementById(
            "activeOrders"
        ).textContent =
            active;


        const kitchen =
            workload.kitchen;


        const bar =
            workload.bar;


        document.getElementById(
            "kitchenLoadText"
        ).textContent =
            kitchen.load_percent + "%";


        document.getElementById(
            "barLoadText"
        ).textContent =
            bar.load_percent + "%";


        document.getElementById(
            "kitchenProgress"
        ).style.width =
            Math.min(
                kitchen.load_percent,
                100
            ) + "%";


        document.getElementById(
            "barProgress"
        ).style.width =
            Math.min(
                bar.load_percent,
                100
            ) + "%";


        document.getElementById(
            "kitchenStatus"
        ).textContent =
            kitchen.status;


        document.getElementById(
            "barStatus"
        ).textContent =
            bar.status;


        renderRecentOrders(
            orders
                .slice()
                .reverse()
                .slice(0, 6)
        );


        // AI-ПОМОЩНИК
        loadAIRecommendations();
        loadRestaurantSituation();


    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось загрузить данные"
        );
    }
}


/* =========================
   RECENT ORDERS
========================= */

function renderRecentOrders(
    orders
) {

    const container =
        document.getElementById(
            "recentOrders"
        );


    if (!orders.length) {

        container.innerHTML = `
            <div class="empty">
                Пока нет заказов
            </div>
        `;

        return;
    }


    container.innerHTML =
        orders.map(
            order => `

            <div class="order-row">

                <div class="order-number">
                    #${order.id}
                </div>

                <div class="order-info">

                    <strong>
                        Стол ${order.table_number}
                    </strong>

                    <small>
                        ${order.items.length}
                        поз.
                    </small>

                </div>

                <span
                    class="
                        status
                        ${statusClass(
                            order.status
                        )}
                    "
                >
                    ${order.status}
                </span>

            </div>

        `
        ).join("");
}


/* =========================
   ALL ORDERS
========================= */

async function loadOrders() {

    try {

        const orders =
            await getData(
                "/orders"
            );


        const container =
            document.getElementById(
                "allOrders"
            );


        container.innerHTML =
            orders
                .slice()
                .reverse()
                .map(
                    order => `

                    <div class="order-row">

                        <div class="order-number">
                            #${order.id}
                        </div>

                        <div class="order-info">

                            <strong>
                                Стол
                                ${order.table_number}
                            </strong>

                            <small>
                                ${
                                    order.items
                                        .map(
                                            item =>
                                                `${item.name} × ${item.quantity}`
                                        )
                                        .join(", ")
                                }
                            </small>

                        </div>

                        <span
                            class="
                                status
                                ${statusClass(
                                    order.status
                                )}
                            "
                        >
                            ${order.status}
                        </span>

                    </div>

                `
                )
                .join("");


    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка загрузки заказов"
        );
    }
}


/* =========================
   KITCHEN
========================= */

async function loadKitchen() {

    try {

        const orders =
            await getData(
                "/kitchen/orders"
            );


        renderStationOrders(
            "kitchenOrders",
            orders
        );


    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка загрузки кухни"
        );
    }
}


/* =========================
   BAR
========================= */

async function loadBar() {

    try {

        const orders =
            await getData(
                "/bar/orders"
            );


        renderStationOrders(
            "barOrders",
            orders
        );


    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка загрузки бара"
        );
    }
}


/* =========================
   STATION ORDERS
========================= */

function renderStationOrders(
    containerId,
    orders
) {

    const container =
        document.getElementById(
            containerId
        );


    if (!orders.length) {

        container.innerHTML = `

            <div class="dark-card">

                <div class="small-title">
                    QUEUE
                </div>

                <h2>
                    Очередь пуста ♡
                </h2>

                <p
                    style="
                        color:#6f636b;
                        font-size:9px;
                    "
                >
                    Сейчас активных
                    заказов нет.
                </p>

            </div>

        `;

        return;
    }


    container.innerHTML =
        orders.map(
            order => `

            <div class="order-card">

                <div class="order-card-top">

                    <div>

                        <div
                            class="order-card-id"
                        >
                            Заказ #${order.id}
                        </div>
                        <div class="order-waiting">
                        <span class="order-waiting-label">
                        Ожидание
                        </span>
                        <span
                        class="order-waiting-time"
                        data-created-at="${order.created_at}"
                        >
                        ${formatWaitingTime(order.created_at)}
                        </span>
                        </div>

                        <div
                            class="order-card-table"
                        >
                            Стол
                            ${order.table_number}
                        </div>

                    </div>

                    <span class="priority">
                        ${order.priority}
                    </span>

                </div>


                <div class="order-items">

                    ${
                        order.items
                            .map(
                                item => `

                                <div
                                    class="order-item"
                                >

                                    <span>
                                        ${item.name}
                                    </span>

                                    <span>
                                        ×
                                        ${item.quantity}
                                    </span>

                                </div>

                            `
                            )
                            .join("")
                    }

                </div>


                <div class="reason">
                    ✦
                    ${order.priority_reason}
                </div>


                <div class="order-actions">

                    <button
                        onclick="
                            changeStatus(
                                ${order.id},
                                'Принят'
                            )
                        "
                    >
                        Принять
                    </button>


                    <button
                        onclick="
                            changeStatus(
                                ${order.id},
                                'Готовится'
                            )
                        "
                    >
                        Готовится
                    </button>


                    <button
                        onclick="
                            changeStatus(
                                ${order.id},
                                'Готов'
                            )
                        "
                    >
                        Готов
                    </button>

                </div>

            </div>

        `
        ).join("");
}


/* =========================
   STATUS UPDATE
========================= */

async function changeStatus(
    orderId,
    status
) {

    try {

        const response =
            await fetch(
                `/orders/${orderId}/status?status=${encodeURIComponent(
                    status
                )}`,
                {
                    method: "PATCH"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Status update failed"
            );
        }


        showToast(
            "Статус обновлён ♡"
        );


        loadDashboard();

        loadOrders();

        loadKitchen();

        loadBar();


    } catch (error) {

        console.error(error);

        showToast(
            "Не удалось изменить статус"
        );
    }
}


/* =========================
   ANALYTICS
========================= */

async function loadAnalytics() {

    try {

        const [
            analytics,
            revenue,
            popular
        ] = await Promise.all([

            getData(
                "/analytics"
            ),

            getData(
                "/analytics/revenue"
            ),

            getData(
                "/analytics/popular-items"
            )

        ]);


        document.getElementById(
            "analyticsTotal"
        ).textContent =
            analytics.total_orders;


        document.getElementById(
            "analyticsNew"
        ).textContent =
            analytics.statuses.new;


        document.getElementById(
            "analyticsPreparing"
        ).textContent =
            analytics.statuses.preparing;


        document.getElementById(
            "analyticsServed"
        ).textContent =
            analytics.statuses.served;


        document.getElementById(
            "analyticsRevenue"
        ).textContent =
            Number(
                revenue.total_revenue
            ).toLocaleString(
                "ru-RU"
            );


        const container =
            document.getElementById(
                "popularItems"
            );


        if (!popular.length) {

            container.innerHTML = `
                <div class="empty">
                    Пока нет данных
                </div>
            `;

            return;
        }


        container.innerHTML =
            popular.map(
                item => `

                <div class="popular-row">

                    <span>
                        ${item.name}
                    </span>

                    <span
                        class="
                            popular-quantity
                        "
                    >
                        ${item.quantity}
                    </span>

                </div>

            `
            ).join("");


    } catch (error) {

        console.error(error);

        showToast(
            "Ошибка аналитики"
        );
    }
}


/* =========================
   ML
========================= */

async function getPrediction() {

    const input =
        document.getElementById(
            "predictionOrderId"
        );


    const orderId =
        input.value.trim();


    if (!orderId) {

        showToast(
            "Введите ID заказа"
        );

        return;
    }


    const result =
        document.getElementById(
            "predictionResult"
        );


    result.classList.remove(
        "hidden"
    );


    result.innerHTML = `

        <div class="prediction-label">
            ✦ Анализируем заказ...
        </div>

    `;


    try {

        const data =
            await getData(
                `/analytics/ml/predict/${orderId}`
            );


        if (data.message) {

            result.innerHTML = `

                <div class="prediction-label">
                    ${data.message}
                </div>

            `;

            return;
        }


        result.innerHTML = `

            <div class="prediction-number">

                ${data.predicted_minutes}

                <span>
                    мин
                </span>

            </div>


            <div class="prediction-label">
                прогноз времени приготовления
            </div>


            <div class="prediction-details">

                Заказ #${data.order_id}

                <br>

                Позиций:
                ${data.items_count}

                <br>

                Кухня:
                ${data.kitchen_items}

                <br>

                Бар:
                ${data.bar_items}

                <br>

                Плановое время:
                ${data.planned_time}
                мин

            </div>

        `;


    } catch (error) {

        console.error(error);

        result.innerHTML = `

            <div class="prediction-label">
                Заказ не найден
                или произошла ошибка
            </div>

        `;
    }
}


/* =========================
   START
========================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setDate();

        loadDashboard();

    }
);
/* ==========================================================
   AI ASSISTANT
   ========================================================== */

async function loadAIRecommendations() {

    const container = document.getElementById(
        "aiRecommendations"
    );

    const summary = document.getElementById(
        "aiSummary"
    );

    if (!container) {
        return;
    }

    try {

        container.innerHTML = `
            <div class="empty">
                AI анализирует текущую ситуацию...
            </div>
        `;


        const response = await fetch(
            "/ai/recommendations"
        );


        if (!response.ok) {
            throw new Error(
                "Ошибка загрузки AI-рекомендаций"
            );
        }


        const data = await response.json();


        if (summary) {

            summary.textContent =
                `Активных заказов: ${data.active_orders} · ` +
                `Кухня: ${data.kitchen_orders} · ` +
                `Бар: ${data.bar_orders}`;

        }


        if (
            !data.recommendations ||
            data.recommendations.length === 0
        ) {

            container.innerHTML = `
                <div class="empty">
                    Сейчас система не выявила проблем.
                </div>
            `;

            return;
        }


        /*
         * Показываем максимум 6 рекомендаций,
         * чтобы dashboard не становился огромным.
         */

        const recommendations =
            data.recommendations.slice(0, 6);


        container.innerHTML =
            recommendations.map(
                recommendation => {

                    let priorityClass =
                        "ai-rec-normal";


                    if (
                        recommendation.priority === "high"
                    ) {

                        priorityClass =
                            "ai-rec-high";

                    }


                    if (
                        recommendation.priority === "medium"
                    ) {

                        priorityClass =
                            "ai-rec-medium";

                    }


                    return `
                        <div
                            class="ai-rec-item ${priorityClass}"
                        >

                            <div
                                class="ai-rec-dot"
                            ></div>

                            <div>

                                <strong>
                                    ${recommendation.title}
                                </strong>

                                <p>
                                    ${recommendation.message}
                                </p>

                            </div>

                        </div>
                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "AI recommendations error:",
            error
        );


        container.innerHTML = `
            <div class="empty">
                Не удалось получить рекомендации AI.
            </div>
        `;

        if (summary) {

            summary.textContent =
                "Сервис рекомендаций временно недоступен.";

        }

    }
}

async function loadRestaurantSituation() {

    const container =
        document.getElementById(
            "restaurantSituation"
        );

    if (!container) {
        return;
    }

    try {

        const [
            workload,
            orders,
            recommendations
        ] = await Promise.all([

            getData("/workload"),

            getData("/orders"),

            getData("/ai/recommendations")

        ]);


        const activeOrders =
            orders.filter(
                order =>
                    ![
                        "Готов",
                        "Выдан"
                    ].includes(
                        order.status
                    )
            );


        const kitchenLoad =
            workload.kitchen.load_percent;

        const barLoad =
            workload.bar.load_percent;


        const longWaitingOrders =
            activeOrders.filter(order => {

                const created =
                    new Date(
                        order.created_at
                    );

                const now =
                    new Date();

                const minutes =
                    (
                        now - created
                    ) / 60000;

                return minutes >= 10;

            });


        let situation =
            "Рабочая нагрузка находится под контролем.";

        let details =
            "Активных заказов: " +
            activeOrders.length;


        if (
            kitchenLoad >= 75
        ) {

            situation =
                "Высокая нагрузка на кухню.";

            details =
                "Кухня загружена на " +
                kitchenLoad +
                "%. Рекомендуется контролировать заказы с высоким приоритетом.";

        }
        else if (
            barLoad >= 75
        ) {

            situation =
                "Высокая нагрузка на бар.";

            details =
                "Бар загружен на " +
                barLoad +
                "%. Следует контролировать очередь напитков.";

        }
        else if (
            longWaitingOrders.length > 0
        ) {

            situation =
                "Есть заказы с длительным ожиданием.";

            details =
                longWaitingOrders.length +
                " заказ(а) ожидают более 10 минут.";

        }
        else if (
            activeOrders.length === 0
        ) {

            situation =
                "Активных заказов нет.";

            details =
                "Кухня и бар готовы принимать новые заказы.";

        }


        const topRecommendations =
            recommendations.recommendations
                ? recommendations.recommendations
                    .slice(0, 2)
                : [];


        container.innerHTML = `

            <div class="situation-main">

                <div class="situation-indicator">
                    ●
                </div>

                <div>

                    <strong>
                        ${situation}
                    </strong>

                    <p>
                        ${details}
                    </p>

                </div>

            </div>


            <div class="situation-metrics">

                <div class="situation-metric">

                    <span>
                        Активные заказы
                    </span>

                    <strong>
                        ${activeOrders.length}
                    </strong>

                </div>


                <div class="situation-metric">

                    <span>
                        Кухня
                    </span>

                    <strong>
                        ${kitchenLoad}%
                    </strong>

                </div>


                <div class="situation-metric">

                    <span>
                        Бар
                    </span>

                    <strong>
                        ${barLoad}%
                    </strong>

                </div>


                <div class="situation-metric">

                    <span>
                        Ожидание >10 мин
                    </span>

                    <strong>
                        ${longWaitingOrders.length}
                    </strong>

                </div>

            </div>

        `;

    }
    catch (error) {

        console.error(
            "Situation error:",
            error
        );

        container.innerHTML = `

            <div class="empty">
                Не удалось определить состояние ресторана.
            </div>

        `;

    }
}

// ==========================================================
// PREMIUM NUMBER ANIMATION
// ==========================================================

function animateNumber(element, target) {

    if (!element) {
        return;
    }

    const numericTarget =
        Number(target);

    if (!Number.isFinite(numericTarget)) {
        return;
    }

    const start =
        Number(
            element.dataset.currentValue || 0
        );

    const duration = 700;

    const startTime =
        performance.now();


    function update(currentTime) {

        const progress =
            Math.min(
                (currentTime - startTime)
                / duration,
                1
            );


        const eased =
            1 -
            Math.pow(
                1 - progress,
                3
            );


        const value =
            start +
            (
                numericTarget - start
            ) * eased;


        element.textContent =
            Math.round(value);


        if (progress < 1) {

            requestAnimationFrame(
                update
            );

        }
        else {

            element.textContent =
                numericTarget;

            element.dataset.currentValue =
                numericTarget;

        }

    }


    requestAnimationFrame(
        update
    );
}
// ==========================================================
// ORDER WAITING TIMER
// ==========================================================

function formatWaitingTime(createdAt) {

    if (!createdAt) {
        return "00:00";
    }

    const created =
        new Date(createdAt);

    const now =
        new Date();

    let seconds =
        Math.floor(
            (now - created) / 1000
        );

    if (seconds < 0) {
        seconds = 0;
    }

    const minutes =
        Math.floor(
            seconds / 60
        );

    const remainingSeconds =
        seconds % 60;

    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(remainingSeconds).padStart(2, "0")
    );
}


// ==========================================================
// UPDATE ALL WAITING TIMERS
// ==========================================================

function updateWaitingTimers() {

    const timers =
        document.querySelectorAll(
            "[data-created-at]"
        );

    timers.forEach(timer => {

        const createdAt =
            timer.dataset.createdAt;

        timer.textContent =
            formatWaitingTime(
                createdAt
            );

    });

}

// ==========================================================
// WAITING TIMER STATUS
// ==========================================================

function updateWaitingTimerStatus() {

    const timers =
        document.querySelectorAll(
            ".order-waiting-time"
        );

    timers.forEach(timer => {

        const createdAt =
            timer.dataset.createdAt;

        if (!createdAt) {
            return;
        }

        const created =
            new Date(createdAt);

        const now =
            new Date();

        const minutes =
            (
                now - created
            ) / 60000;

        timer.classList.remove(
            "waiting-normal",
            "waiting-warning",
            "waiting-danger"
        );

        if (minutes >= 10) {

            timer.classList.add(
                "waiting-danger"
            );

        }
        else if (minutes >= 5) {

            timer.classList.add(
                "waiting-warning"
            );

        }
        else {

            timer.classList.add(
                "waiting-normal"
            );

        }

    });

}


// обновляем каждую секунду

setInterval(
    updateWaitingTimers,
    1000
);

setInterval(
    updateWaitingTimerStatus,
    1000
);