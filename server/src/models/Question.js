import mongoose from 'mongoose';


const QuestionSchema = new mongoose.Schema(
{
qid: { type: String, index: true, unique: true },
userId: { type: String, required: true },
question: { type: String, required: true },
answerId: { type: String }
},
{ timestamps: true }
);


export default mongoose.model('Question', QuestionSchema);