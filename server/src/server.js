// server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import Question from './models/Question.js';
import Answer from './models/Answer.js';
import { llmGenerate } from './services/llm.js';
import { initSSE, broadcast } from './sse.js';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json({ limit: '1mb' }));

const origins = process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : ['http://localhost:5173'];
app.use(cors({ origin: origins }));

app.get('/', (_req, res) => res.type('text/plain').send('API OK'));

initSSE(app);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PostQuestionSchema = z.object({
  userId: z.string().min(1),
  question: z.string().min(3),
});

app.post('/api/questions', async (req, res) => {
  try {
    const { userId, question } = PostQuestionSchema.parse(req.body);

    const qid = `q_${nanoid(8)}`;
    const newQ = await Question.create({ qid, userId, question });

    broadcast('question_created', {
      question: { id: newQ.qid, userId: newQ.userId, question: newQ.question },
    });

    
    const aid = `a_${nanoid(8)}`;

    res.status(201).json({ questionId: qid, answerId: aid });

    const llmOut = await llmGenerate(question);
    const text = llmOut?.text ?? '';
    const visualization = llmOut?.visualization ?? null;

    await Answer.create({ aid, text, visualization });

   
    const chunkSize = 60; 
    const intervalMs = 120; 

    let offset = 0;
    const total = text.length;

    let sentVisualization = false;

    const sendChunk = (chunkText, doneFlag) => {
      const payload = {
        answerId: aid,
        questionId: qid,
        chunk: chunkText,
        done: doneFlag,
        visualization: !sentVisualization ? visualization : null,
      };
      broadcast('answer_stream', payload);
      sentVisualization = true;
    };

    if (total === 0) {
      sendChunk('', true);
    } else {
      const interval = setInterval(() => {
        offset = Math.min(total, offset + chunkSize);
        const chunk = text.slice(0, offset); 
        const done = offset >= total;
        sendChunk(chunk, done);
        if (done) clearInterval(interval);
      }, intervalMs);
    }

    setTimeout(() => {
      broadcast('answer_created', {
        answer: { id: aid, text, visualization, questionId: qid },
      });
    }, Math.max(1000, Math.min(3000, Math.ceil((total / chunkSize) * intervalMs) + 300)));
  } catch (err) {
    console.error(err);
    const message = err?.issues?.[0]?.message || err.message || 'Invalid request';
    res.status(400).json({ error: message });
  }
});

app.get('/api/questions', async (_req, res) => {
  try {
    const docs = await Question.find().sort({ createdAt: -1 }).lean();
    const result = docs.map((d) => ({
      id: d.qid,
      userId: d.userId,
      question: d.question,
      answerId: d.answerId || null,
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

app.get('/api/answers/:id', async (req, res) => {
  try {
    const aid = req.params.id;
    const doc = await Answer.findOne({ aid }).lean();
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json({ id: doc.aid, text: doc.text, visualization: doc.visualization });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch answer' });
  }
});

if (!process.env.MONGODB_URI) {
  console.error('❌ MONGODB_URI missing in environment');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
  })
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✅ Server running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
