import mongoose from 'mongoose';


const AnswerSchema = new mongoose.Schema(
{
aid: { type: String, index: true, unique: true },
text: { type: String, required: true },
visualization: { type: Object, required: true }
},
{ timestamps: true }
);


export default mongoose.model('Answer', AnswerSchema);