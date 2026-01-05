# train.py
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Embedding
from tensorflow.keras.optimizers import Adam

# Load the prepared data
data = np.load("training_data/data.npz")
X = data['X']
y = data['y']
char_to_index = data['char_to_index']
index_to_char = data['index_to_char']
num_chars = len(char_to_index)
seq_length = X.shape[1]

# Model definition (adjust parameters as needed)
model = Sequential()
model.add(Embedding(num_chars, 128, input_length=seq_length))
model.add(LSTM(256, return_sequences=True))
model.add(LSTM(256))
model.add(Dense(num_chars, activation='softmax'))  # Softmax for character probabilities

# Compile the model
model.compile(loss='sparse_categorical_crossentropy', optimizer=Adam(learning_rate=0.001))

# Train the model
epochs = 10
batch_size = 64
model.fit(X, y, epochs=epochs, batch_size=batch_size)

# Save the model
model.save("char_rnn_model.h5")

print("Model trained and saved as char_rnn_model.h5")
