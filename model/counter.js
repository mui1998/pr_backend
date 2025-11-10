import mongoose from 'mongoose';

const CounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq_value: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', CounterSchema);

export const getNextSequence = async (name) => {
  const counter = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq_value: 1 } },
    { new: true, upsert: true } // create if not exists
  );
  return counter.seq_value;
}
