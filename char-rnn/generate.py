# generate.py
import numpy as np
import tensorflow as tf

# Load the model
model = tf.keras.models.load_model("char_rnn_model.h5")

# Load the vocabulary
data = np.load("training_data/data.npz")
index_to_char = data['index_to_char']
num_chars = len(index_to_char)


def generate_text(seed_text, length):
    """Generates text from the trained model."""

    seed = [char_to_index[c] for c in seed_text]
    output_text = seed_text

    for _ in range(length):
        # Predict the next character
        prediction = model.predict(np.array([seed]))
        predicted_index = np.argmax(prediction)
        predicted_char = index_to_char[predicted_index]

        # Update the seed
        seed = seed[1:] + [predicted_index]
        output_text += predicted_char

    return output_text

# Generate some text
seed_text = "This is a test"
generated_text = generate_text(seed_text, 100)
print(generated_text)
