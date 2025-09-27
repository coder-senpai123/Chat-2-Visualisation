const clients = new Set();
let pingTimer = null;


export function initSSE(app) {
    app.get('/api/stream', (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', process.env.CLIENT_URL || '*');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();


clients.add(res);
res.write(`event: connected\n`);
res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);


req.on('close', () => {
clients.delete(res);
});


if (!pingTimer) {
pingTimer = setInterval(() => {
for (const c of clients) c.write(`: ping\n\n`);
if (clients.size === 0) { clearInterval(pingTimer); pingTimer = null; }
}, 20000);
}
});
}


export function broadcast(event, payload) {
const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
for (const c of clients) c.write(data);
}