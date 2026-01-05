# prepare_data.py
import numpy as np

def prepare_data(text_file, vocab_file, data_file):
    """
    Prepares data for CharRNN training.

    Args:
        text_file (str): Path to the text file to train on.
        vocab_file (str): Path to save the character vocabulary to.
        data_file (str): Path to save the processed data to.
    """

    with open(text_file, 'r', encoding='utf-8') as f:
        text = f.read()

    # 1. Create the character set
    chars = sorted(list(set(text)))
    with open(vocab_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(chars)) # Write one char per line

    # 2. Create character-to-index and index-to-character mappings
    char_to_index = {ch: i for i, ch in enumerate(chars)}
    index_to_char = {i: ch for i, ch in enumerate(chars)}

    # 3. Prepare the data
    seq_length = 100  # Adjust as needed
    dataX = []
    dataY = []
    for i in range(0, len(text) - seq_length, 1):
        seq_in = text[i:i + seq_length]
        seq_out = text[i + seq_length]
        dataX.append([char_to_index[char] for char in seq_in])
        dataY.append(char_to_index[seq_out])

    X = np.array(dataX)
    y = np.array(dataY)

    np.save(data_file, {'X': X, 'y': y, 'char_to_index': char_to_index, 'index_to_char': index_to_char})

# Usage
prepare_data("training_data/cleaned_training_data.txt", "training_data/vocab.txt", "training_data/data.npz")
