from sklearn.linear_model import LinearRegression


def prepare_training_data(training_data):
    X = []
    y = []

    for row in training_data:
        X.append([
            row["items_count"],
            row["kitchen_items"],
            row["bar_items"],
            row["planned_time"]
        ])

        y.append(row["actual_time"])

    return X, y


def train_model(training_data):
    if len(training_data) < 5:
        return None

    X, y = prepare_training_data(training_data)

    model = LinearRegression()

    model.fit(X, y)

    return model


def predict_time(model, items_count, kitchen_items, bar_items, planned_time):
    prediction = model.predict([
        [
            items_count,
            kitchen_items,
            bar_items,
            planned_time
        ]
    ])

    return round(float(prediction[0]), 2)