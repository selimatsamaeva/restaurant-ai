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